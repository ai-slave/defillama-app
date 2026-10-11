import * as Ariakit from '@ariakit/react'
import { Elements, PaymentElement, useElements } from '@stripe/react-stripe-js'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Suspense, use, useState, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { scheduleConfirmationReads } from '~/containers/Account/utils'
import { usePlanRecord } from '~/containers/Subscription/purchaseReturn'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogDiscardGuard, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { InlineStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import { EmbeddedCardCheckout } from './EmbeddedCardCheckout'
import {
	forgetPendingUpgrade,
	isUnderWay,
	type UnderWayStatus,
	type UpgradePricing,
	withUpgradeLock
} from './pendingUpgrade'
import { CARD_PAYMENTS_UNAVAILABLE, loadStripeOnce } from './stripeClient'
import { checkoutReturnPath, type StripeCheckout } from './useStripeCheckout'

const formatAmount = (cents: number, currency: string) => {
	const amount = cents / 100
	const currencyCode = currency.toUpperCase()
	return formatNumber(amount, { currency: currencyCode })
}

// Statuses where no money moved, so the payment can be tried again.
const getFriendlyPaymentStatus = (status: string) => {
	switch (status) {
		case 'requires_action':
			return 'Your payment needs additional authentication. Complete the verification step and try again.'
		case 'requires_payment_method':
			return 'Payment failed. Use a different payment method and try again.'
		case 'requires_confirmation':
			return 'Payment needs confirmation. Submit again to continue.'
		default:
			return 'Payment is pending confirmation. Check your account for updates.'
	}
}

// Asynchronous payment methods can take days to settle, so none of these promise a time.
const UNDER_WAY_STEPS: Record<UnderWayStatus, { title: string; justPaid: string; earlier: string }> = {
	processing: {
		title: 'Payment processing',
		justPaid:
			'Your payment is processing. Some payment methods take a few business days, and your plan updates once it clears.',
		earlier:
			'Your earlier upgrade payment is still processing, so there is nothing to pay now. Your plan updates once it clears.'
	},
	requires_capture: {
		title: 'Payment authorized',
		justPaid: 'Your payment is authorized but not captured yet. Your plan updates once it is captured.',
		earlier: 'Your earlier upgrade payment is authorized but not captured yet, so there is nothing to pay now.'
	},
	succeeded: {
		title: 'Upgrade payment received',
		// A just-paid upgrade leaves for the return page, which confirms the plan there.
		justPaid: '',
		earlier: 'Your earlier upgrade payment went through and your plan is being updated, so there is nothing to pay now.'
	}
}

type UpgradeOutcome = UnderWayStatus | 'canceled'

type UpgradePayment = {
	/** The opening this payment belongs to, from the session's submittedAt. */
	openedAt: number
	stripe: Stripe
	elements: StripeElements
	clientSecret: string
	awaitingVerification: boolean
	postCheckoutPath: string
}

// A payment that is under way or stands in the way of a new one; there is nothing to pay from here.
function OutcomeStep({ title, description }: { title: string; description: string }) {
	return (
		<>
			<DialogHeader title={title} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">{description}</Ariakit.DialogDescription>
			</DialogBody>
			<DialogFooter>
				<Ariakit.DialogDismiss autoFocus render={<Button variant="primary" size="md" />}>
					Done
				</Ariakit.DialogDismiss>
			</DialogFooter>
		</>
	)
}

function CheckoutLoading() {
	return <SurfaceBodyLoadingStatus label="Loading checkout" className="absolute inset-0 min-h-0" />
}

// Reads the session the caller's useStripeCheckout created; nothing rendered here creates one. Every step renders in
// this one Dialog: a step swapped for another Dialog would leave nothing to hand focus back to when it closes.
export function StripeCheckoutModal({ checkout }: { checkout: StripeCheckout }) {
	const { isOpen, session, failure, close, retry } = checkout
	const queryClient = useQueryClient()
	const { user } = useAuthContext()

	const payment = useMutation({
		mutationFn: async ({
			stripe,
			elements,
			clientSecret,
			awaitingVerification,
			postCheckoutPath
		}: UpgradePayment): Promise<UpgradeOutcome> => {
			if (!user) throw new Error("You're signed out. Sign in and try again.")
			// The payment intent belongs to the account that opened checkout (useStripeCheckout checks it while creating
			// the session). Signing in as another account in a second tab after the form shows still pays for the first
			// account, which is the one the form was opened for; guarding that rare switch would add an account check and
			// a step to every payment for no reader who does not cause it on purpose.
			const confirmResult = awaitingVerification
				? // The bank check the earlier attempt left open; a new card entry would not finish it.
					await stripe.handleNextAction({ clientSecret })
				: await (async () => {
						const submitResult = await elements.submit()
						if (submitResult.error) throw new Error(submitResult.error.message || 'Payment failed')
						return stripe.confirmPayment({
							elements,
							confirmParams: { return_url: `${window.location.origin}${postCheckoutPath}` },
							redirect: 'if_required'
						})
					})()

			// A confirmation error can still leave money moving, so Stripe's own record of the payment decides.
			const status =
				confirmResult.paymentIntent?.status ??
				(await stripe.retrievePaymentIntent(clientSecret).then(
					(retrieved) => retrieved.paymentIntent?.status,
					() => undefined
				))
			if (status === undefined) {
				throw new Error("We couldn't confirm your payment. Check your account before trying again.")
			}
			if (isUnderWay(status)) return status

			// A canceled intent can never be paid, so the next opening creates a fresh one. Any other status stays open
			// and is resumed, so a retry never runs alongside a second intent.
			if (status === 'canceled') {
				const userId = user.id
				await withUpgradeLock(userId, async () => forgetPendingUpgrade(userId, clientSecret))
				return status
			}
			throw new Error(confirmResult.error?.message || getFriendlyPaymentStatus(status))
		},
		onSuccess: (status) => {
			if (status === 'processing' || status === 'requires_capture')
				scheduleConfirmationReads(queryClient, ['subscription'])
		}
	})

	// A caller may keep the modal mounted before its first opening, when there is no session to show.
	const request = session.variables
	if (!request) return null
	const result = session.data
	// A caller can keep this modal mounted between openings, and the payment mutation with it. Its outcome belongs to the
	// opening that paid: a later opening, even one resuming the same intent, starts from the form.
	const paid = payment.variables?.openedAt === session.submittedAt ? payment : null

	let surface: { size: 'sm' | 'md'; fullSheet: boolean; pending: boolean } = {
		size: 'sm',
		fullSheet: false,
		pending: false
	}
	let content: ReactNode
	if (result?.kind === 'pendingUpgrade') {
		content = (
			<OutcomeStep
				title={UNDER_WAY_STEPS[result.status].title}
				description={
					result.stale
						? "This upgrade payment started over a week ago and hasn't cleared, so contact support before paying again."
						: UNDER_WAY_STEPS[result.status].earlier
				}
			/>
		)
	} else if (result?.kind === 'paidUpgrade' && paid?.data === 'canceled') {
		content = (
			<OutcomeStep
				title="Payment canceled"
				description="This upgrade payment was canceled, so it can no longer be paid. Close this and start the upgrade again."
			/>
		)
	} else if (result?.kind === 'paidUpgrade' && (paid?.data === 'processing' || paid?.data === 'requires_capture')) {
		content = <OutcomeStep title={UNDER_WAY_STEPS[paid.data].title} description={UNDER_WAY_STEPS[paid.data].justPaid} />
	} else if (result?.kind === 'paidUpgrade') {
		const postCheckoutPath = checkoutReturnPath(request)
		// A charged payment stays locked while the page navigates away, so it cannot be submitted twice.
		const paying = paid !== null && (paid.isPending || paid.data === 'succeeded')
		// The payment cannot be cancelled once confirmPayment starts, so the dialog stays open until it settles. The card
		// form grows as it loads, so the phone sheet keeps its full height unless only a bank check is left.
		surface = { ...surface, size: 'md', fullSheet: !result.awaitingVerification, pending: paying }
		content = (
			<Suspense fallback={<UpgradeLoading />}>
				<UpgradeForm
					plan={request.type}
					billingInterval={request.billingInterval}
					clientSecret={result.clientSecret}
					pricing={result.pricing}
					awaitingVerification={result.awaitingVerification}
					paying={paying}
					onPay={(stripe, elements, onSettled) => {
						if (paying) return
						payment.mutate(
							{
								openedAt: session.submittedAt,
								stripe,
								elements,
								clientSecret: result.clientSecret,
								awaitingVerification: result.awaitingVerification,
								postCheckoutPath
							},
							{
								// A mutate() callback, unlike the hook's onSuccess, is dropped once this dialog unmounts on close.
								onSuccess: (status) => {
									if (status === 'succeeded') window.location.href = `${window.location.origin}${postCheckoutPath}`
								},
								onSettled: (_status, error) => onSettled(error)
							}
						)
					}}
				/>
			</Suspense>
		)
	} else {
		const paying = result?.kind === 'checkout'
		// The embedded checkout loads and grows inside its iframe, so the phone sheet keeps its full height. A failure is
		// one message and its retry, so that sheet fits its content.
		surface = { ...surface, size: 'md', fullSheet: !failure }
		content = (
			<>
				{/* Closing mid-payment asks first: Stripe may already be taking the payment, and leaving drops its outcome. The
				    guard also ignores outside taps, since Stripe owns the payment's submit state. */}
				<DialogDiscardGuard
					when={paying}
					title="Leave checkout?"
					description="Your plan isn't active until the payment finishes. Leaving closes this checkout."
					cancelLabel="Keep paying"
					confirmLabel="Leave"
				/>
				<DialogHeader title="Complete your purchase" />
				{failure ? (
					<>
						<DialogBody>
							<InlineStatus variant="error">{failure.message}</InlineStatus>
						</DialogBody>
						<DialogFooter>
							<Button
								type="button"
								variant="primary"
								size="md"
								onClick={retry}
								pendingLabel="Retrying…"
								pending={session.isPending}
							>
								Try again
							</Button>
						</DialogFooter>
					</>
				) : result?.kind === 'checkout' ? (
					<Suspense fallback={<EmbeddedLoadingBody />}>
						<EmbeddedCheckoutBody clientSecret={result.clientSecret} />
					</Suspense>
				) : (
					<EmbeddedLoadingBody />
				)}
			</>
		)
	}

	return (
		<Dialog
			size={surface.size}
			fullSheet={surface.fullSheet}
			open={isOpen}
			onClose={close}
			pending={surface.pending}
			portal
			unmountOnHide
		>
			{content}
		</Dialog>
	)
}

// The checkout draws nothing until the session arrives, so the wait needs its own label.
function EmbeddedLoadingBody() {
	return (
		<DialogBody kind="flush">
			<div className="relative min-h-[400px]">
				<CheckoutLoading />
			</div>
		</DialogBody>
	)
}

// Stripe's iframe fills a flush body; the message for a script that failed to load needs the usual padding.
function EmbeddedCheckoutBody({ clientSecret }: { clientSecret: string }) {
	const stripe = use(loadStripeOnce())
	if (!stripe) {
		return (
			<DialogBody>
				<InlineStatus variant="error">{CARD_PAYMENTS_UNAVAILABLE}</InlineStatus>
			</DialogBody>
		)
	}
	return (
		<DialogBody kind="flush">
			<div className="relative min-h-[400px]">
				<EmbeddedCardCheckout clientSecret={clientSecret} />
			</div>
		</DialogBody>
	)
}

function UpgradeLoading() {
	return (
		<>
			<DialogHeader title="Complete your upgrade" />
			<DialogBody>
				<div className="relative min-h-[200px]">
					<CheckoutLoading />
				</div>
			</DialogBody>
		</>
	)
}

type UpgradeFormProps = {
	plan: 'api' | 'llamafeed'
	billingInterval: 'year' | 'month'
	pricing: UpgradePricing | null
	awaitingVerification: boolean
	paying: boolean
	onPay: (stripe: Stripe, elements: StripeElements, onSettled: (error: Error | null) => void) => void
}

// Suspends until Stripe.js settles; a script that failed to load gets a message instead of a form that never draws.
function UpgradeForm({ clientSecret, ...props }: UpgradeFormProps & { clientSecret: string }) {
	const stripe = use(loadStripeOnce())
	if (!stripe) {
		return (
			<>
				<DialogHeader title="Complete your upgrade" />
				<DialogBody>
					<InlineStatus variant="error">{CARD_PAYMENTS_UNAVAILABLE}</InlineStatus>
				</DialogBody>
			</>
		)
	}
	return (
		<Elements stripe={stripe} options={{ clientSecret }}>
			<UpgradeFormFields stripe={stripe} {...props} />
		</Elements>
	)
}

function UpgradeFormFields({
	stripe,
	plan,
	billingInterval,
	pricing,
	awaitingVerification,
	paying,
	onPay
}: UpgradeFormProps & { stripe: Stripe }) {
	const elements = useElements()
	// The last failed payment, kept while a retry runs: the mutation clears its own error when the retry starts.
	const [error, setError] = useState<string | null>(null)
	const planLabel = `${plan === 'api' ? 'API' : 'Pro'} - ${billingInterval === 'year' ? 'Annual' : 'Monthly'}`
	// The API plan being upgraded, read by type.
	const currentApiPlan = usePlanRecord(plan === 'api' ? 'api' : null)
	// The upgrade webhook turns extra usage charges on for every API plan, including one that had them switched off.
	const turnsOverageBackOn = currentApiPlan?.type === 'api' && currentApiPlan.overage === false

	const handleSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		// Elements is ready as soon as it renders with a loaded Stripe instance.
		onPay(stripe, elements!, (failure) => setError(failure?.message ?? null))
	}

	return (
		<form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
			<DialogHeader title="Complete your upgrade" />
			<DialogBody>
				<div className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface-elevated-1 px-4 py-3">
					<div className="flex flex-col gap-1">
						<p className="label-sm text-secondary">Upgrading to</p>
						<p className="label-lg text-primary">{planLabel}</p>
					</div>

					{pricing ? (
						<div className="flex flex-col gap-2 body-sm">
							<div className="flex justify-between gap-2">
								<span className="text-secondary">New subscription price</span>
								<span className="text-primary">
									{formatAmount(pricing.newSubscriptionPrice, pricing.currency)}
									<span className="text-secondary">/{billingInterval === 'year' ? 'year' : 'month'}</span>
								</span>
							</div>

							{pricing.prorationCredit > 0 ? (
								<div className="flex justify-between gap-2">
									<span className="text-secondary">Proration credit</span>
									<span className="text-success">-{formatAmount(pricing.prorationCredit, pricing.currency)}</span>
								</div>
							) : null}

							<div className="flex justify-between gap-2 border-t border-subtle pt-2">
								<span className="label-md text-primary">Amount due today</span>
								<span className="label-md text-primary">{formatAmount(pricing.amount, pricing.currency)}</span>
							</div>
						</div>
					) : null}
				</div>
				<p className="body-sm text-secondary">
					{awaitingVerification
						? 'Your bank still needs to verify this payment. Complete the verification to finish the upgrade.'
						: pricing
							? "You'll be charged immediately and your subscription will be updated."
							: 'Enter your payment details below to complete the upgrade.'}
				</p>
				{turnsOverageBackOn ? (
					<InlineStatus variant="warning">
						Upgrading turns extra usage charges back on ($0.60 per 1,000 calls past your included limit). You can switch
						them off again in API access afterwards.
					</InlineStatus>
				) : null}
				{awaitingVerification ? null : <PaymentElement />}
				{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
			</DialogBody>
			<DialogFooter>
				<Button type="submit" variant="primary" size="md" pendingLabel="Processing…" pending={paying}>
					{awaitingVerification ? 'Complete verification' : 'Complete upgrade'}
				</Button>
			</DialogFooter>
			<span role="status" className="sr-only">
				{paying ? 'Processing payment' : ''}
			</span>
		</form>
	)
}
