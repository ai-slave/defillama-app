import * as Ariakit from '@ariakit/react'
import {
	Elements,
	EmbeddedCheckout,
	EmbeddedCheckoutProvider,
	PaymentElement,
	useElements,
	useStripe
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { STRIPE_PUBLISHABLE_KEY } from '~/constants'
import { scheduleConfirmationReads } from '~/containers/Account/utils'
import { usePlanRecord } from '~/containers/Subscription/purchaseReturn'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import {
	forgetPendingUpgrade,
	isUnderWay,
	type UnderWayStatus,
	type UpgradePricing,
	withUpgradeLock
} from './pendingUpgrade'
import { checkoutReturnPath, type StripeCheckout } from './useStripeCheckout'

const stripeInstance = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null
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
		case 'canceled':
			return 'Payment was canceled. Try again when you are ready.'
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

const PLAN_NAMES = { api: 'API', llamafeed: 'Pro' } as const
const INTERVAL_NAMES = { month: 'monthly', year: 'yearly' } as const

// Reports a payment that is under way or stands in the way of a new one; there is nothing to pay from here.
function PaymentOutcomeStep({
	isOpen,
	onClose,
	title,
	description
}: {
	isOpen: boolean
	onClose: () => void
	title: string
	description: string
}) {
	return (
		<Dialog size="sm" open={isOpen} onClose={onClose} portal unmountOnHide>
			<DialogHeader title={title} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">{description}</Ariakit.DialogDescription>
			</DialogBody>
			<DialogFooter>
				<Ariakit.DialogDismiss autoFocus render={<Button variant="primary" size="md" />}>
					Done
				</Ariakit.DialogDismiss>
			</DialogFooter>
		</Dialog>
	)
}

// Reads the session the caller's useStripeCheckout created; nothing rendered here creates one.
export function StripeCheckoutModal({ checkout }: { checkout: StripeCheckout }) {
	const { isOpen, session, close, retry } = checkout

	if (stripeInstance == null) {
		return (
			<Dialog size="md" open={isOpen} onClose={close} portal unmountOnHide>
				<DialogHeader title="Checkout" />
				<DialogBody>
					<InlineStatus variant="error">
						Stripe is not configured. Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in your environment.
					</InlineStatus>
				</DialogBody>
			</Dialog>
		)
	}

	// A caller may keep the modal mounted before its first opening, when there is no session to show.
	const request = session.variables
	if (!request) return null
	const result = session.data

	if (result?.kind === 'openUpgrade') {
		return (
			<PaymentOutcomeStep
				isOpen={isOpen}
				onClose={close}
				title="Earlier upgrade still open"
				description={
					result.stale
						? 'An upgrade payment you started over a day ago can still be paid, and its price may be out of date. Contact support to cancel it before upgrading again.'
						: `Your ${PLAN_NAMES[result.plan]} ${INTERVAL_NAMES[result.interval]} upgrade from earlier can still be paid. Finish that upgrade, or contact support to cancel it before choosing another plan.`
				}
			/>
		)
	}

	if (result?.kind === 'pendingUpgrade') {
		return (
			<PaymentOutcomeStep
				isOpen={isOpen}
				onClose={close}
				title={UNDER_WAY_STEPS[result.status].title}
				description={
					result.stale
						? "This upgrade payment started over a week ago and hasn't cleared, so contact support before paying again."
						: UNDER_WAY_STEPS[result.status].earlier
				}
			/>
		)
	}

	if (result?.kind === 'paidUpgrade') {
		return (
			<Elements stripe={stripeInstance} options={{ clientSecret: result.clientSecret }}>
				<UpgradePaymentDialog
					isOpen={isOpen}
					onClose={close}
					plan={request.type}
					billingInterval={request.billingInterval}
					clientSecret={result.clientSecret}
					pricing={result.pricing}
					awaitingVerification={result.awaitingVerification}
					postCheckoutPath={checkoutReturnPath(request)}
				/>
			</Elements>
		)
	}

	// The embedded checkout loads and grows inside its iframe, so the phone sheet keeps its full height.
	return (
		<Dialog size="md" fullSheet open={isOpen} onClose={close} portal unmountOnHide>
			<DialogHeader title="Complete your purchase" />
			{session.isError ? (
				<>
					<DialogBody>
						<InlineStatus variant="error">{session.error.message}</InlineStatus>
					</DialogBody>
					<DialogFooter>
						<Button type="button" variant="primary" size="md" onClick={retry}>
							Try again
						</Button>
					</DialogFooter>
				</>
			) : (
				<DialogBody kind="flush">
					<div className="relative min-h-[400px]">
						{/* The checkout draws nothing until the session arrives, so the wait needs its own label. */}
						{result?.kind === 'checkout' ? (
							<EmbeddedSessionCheckout stripe={stripeInstance} clientSecret={result.clientSecret} />
						) : (
							<div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center">
								<LoadingIndicator label="Loading checkout" />
							</div>
						)}
					</div>
				</DialogBody>
			)}
		</Dialog>
	)
}

// The provider gets the session that already exists, so mounting it again reuses that session. Stripe keeps the
// options it mounted with and warns when they change.
function EmbeddedSessionCheckout({
	stripe,
	clientSecret
}: {
	stripe: NonNullable<typeof stripeInstance>
	clientSecret: string
}) {
	const [options] = useState(() => ({ fetchClientSecret: () => Promise.resolve(clientSecret) }))
	return (
		<EmbeddedCheckoutProvider stripe={stripe} options={options}>
			<EmbeddedCheckout />
		</EmbeddedCheckoutProvider>
	)
}

function UpgradePaymentDialog({
	isOpen,
	onClose,
	plan,
	billingInterval,
	clientSecret,
	pricing,
	awaitingVerification,
	postCheckoutPath
}: {
	isOpen: boolean
	onClose: () => void
	plan: 'api' | 'llamafeed'
	billingInterval: 'year' | 'month'
	clientSecret: string
	pricing: UpgradePricing | null
	awaitingVerification: boolean
	postCheckoutPath: string
}) {
	const stripe = useStripe()
	const elements = useElements()
	const queryClient = useQueryClient()
	const { user } = useAuthContext()
	const planLabel = `${plan === 'api' ? 'API' : 'Pro'} - ${billingInterval === 'year' ? 'Annual' : 'Monthly'}`
	// The API plan being upgraded, read by type.
	const currentApiPlan = usePlanRecord(plan === 'api' ? 'api' : null)
	// The upgrade webhook turns extra usage charges on for every API plan, including one that had them switched off.
	const turnsOverageBackOn = currentApiPlan?.type === 'api' && currentApiPlan.overage === false

	const paymentMutation = useMutation({
		mutationFn: async (): Promise<UnderWayStatus> => {
			if (!stripe || !elements) throw new Error('Stripe not loaded')
			if (!user) throw new Error("You're signed out. Sign in and try again.")

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
			}
			throw new Error(confirmResult.error?.message || getFriendlyPaymentStatus(status))
		},
		onSuccess: (status) => {
			if (status !== 'succeeded') scheduleConfirmationReads(queryClient, ['subscription'])
		}
	})

	// A charged payment stays locked while the page navigates away, so it cannot be submitted twice.
	const paying = paymentMutation.isPending || paymentMutation.data === 'succeeded'

	const handleSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		if (paying) return
		paymentMutation.mutate(undefined, {
			// A mutate() callback, unlike the hook's onSuccess, is dropped once this dialog unmounts on close.
			onSuccess: (status) => {
				if (status === 'succeeded') window.location.href = `${window.location.origin}${postCheckoutPath}`
			}
		})
	}

	const underWay = paymentMutation.data
	if (underWay === 'processing' || underWay === 'requires_capture') {
		return (
			<PaymentOutcomeStep
				isOpen={isOpen}
				onClose={onClose}
				title={UNDER_WAY_STEPS[underWay].title}
				description={UNDER_WAY_STEPS[underWay].justPaid}
			/>
		)
	}

	// The payment cannot be cancelled once confirmPayment starts, so the dialog stays open until it settles. The card
	// form grows as it loads, so the phone sheet keeps its full height unless only a bank check is left.
	return (
		<Dialog
			size="md"
			fullSheet={!awaitingVerification}
			open={isOpen}
			onClose={onClose}
			pending={paying}
			portal
			unmountOnHide
		>
			<form onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
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
							Upgrading turns extra usage charges back on ($0.60 per 1,000 calls past your included limit). You can
							switch them off again in API access afterwards.
						</InlineStatus>
					) : null}
					{awaitingVerification ? null : <PaymentElement />}
					{paymentMutation.error ? <InlineStatus variant="error">{paymentMutation.error.message}</InlineStatus> : null}
				</DialogBody>
				<DialogFooter leading={stripe ? null : <p className="body-sm text-secondary">Loading payment form…</p>}>
					<Button
						type="submit"
						variant="primary"
						size="md"
						disabled={!stripe}
						pendingLabel={paying ? 'Processing…' : null}
					>
						{awaitingVerification ? 'Complete verification' : 'Complete upgrade'}
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{paying ? 'Processing payment' : ''}
				</span>
			</form>
		</Dialog>
	)
}
