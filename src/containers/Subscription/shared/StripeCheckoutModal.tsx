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
import { useCallback } from 'react'
import { useAuthContext } from '~/auth'
import { getReferrer } from '~/auth/referrer'
import { AUTH_SERVER, STRIPE_PUBLISHABLE_KEY } from '~/constants'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { handleSimpleFetchResponse } from '~/utils/async'
import { formatNumber } from '~/utils/numberFormat'

const stripeInstance = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null
const formatAmount = (cents: number, currency: string) => {
	const amount = cents / 100
	const currencyCode = currency.toUpperCase()
	return formatNumber(amount, { currency: currencyCode })
}

const getFriendlyPaymentStatus = (status: string) => {
	switch (status) {
		case 'requires_action':
			return 'Your payment needs additional authentication. Complete the verification step and try again.'
		case 'processing':
			return 'Your payment is processing. This can take a few minutes, so check your account shortly.'
		case 'requires_capture':
			return 'Payment is authorized and awaiting final confirmation.'
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

interface UpgradePricing {
	amount: number
	currency: string
	prorationCredit: number
	newSubscriptionPrice: number
}

type SubscriptionResult =
	| { kind: 'checkout'; clientSecret: string }
	| { kind: 'freeUpgrade' }
	| { kind: 'paidUpgrade'; clientSecret: string; pricing: UpgradePricing | null }

interface StripeCheckoutModalProps {
	isOpen: boolean
	onClose: () => void
	paymentMethod: 'stripe'
	type: 'api' | 'llamafeed'
	billingInterval?: 'year' | 'month'
	isTrial?: boolean
	isUpgradeFlow?: boolean
	upgradeReturnPath?: string
}

// Each opening asks for a fresh checkout session, and a closing dialog keeps its last step through the fade-out
// instead of mounting a new checkout that would ask for another session.
export function StripeCheckoutModal(props: StripeCheckoutModalProps) {
	return <StripeCheckoutDialog key={useOpeningKey(props.isOpen)} {...props} />
}

function StripeCheckoutDialog({
	isOpen,
	onClose,
	paymentMethod,
	type,
	billingInterval = 'month',
	isTrial = false,
	isUpgradeFlow = false,
	upgradeReturnPath
}: StripeCheckoutModalProps) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	// The return page confirms an upgrade only once the subscription reads as the plan bought here. The base only
	// parses the relative path; the query merges with any the caller's path already has.
	const upgradeReturn = new URL(upgradeReturnPath ?? '/account?success=true', 'https://defillama.com')
	upgradeReturn.searchParams.set('plan', type)
	upgradeReturn.searchParams.set('interval', billingInterval)
	const postCheckoutPath = isUpgradeFlow ? `${upgradeReturn.pathname}${upgradeReturn.search}` : '/welcome'

	const subscriptionMutation = useMutation({
		mutationFn: async (): Promise<SubscriptionResult> => {
			if (typeof window !== 'undefined' && !isUpgradeFlow) {
				sessionStorage.setItem('onboarding_returnUrl', window.location.pathname)
			}
			const response = await authorizedFetch(
				`${AUTH_SERVER}/subscription/create`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						redirectUrl: `${window.location.origin}${postCheckoutPath}`,
						cancelUrl: `${window.location.origin}/subscription`,
						provider: paymentMethod,
						subscriptionType: type,
						billingInterval,
						isTrial,
						referralCode: getReferrer()
					})
				},
				true
			)

			if (!response) throw new Error('Not authenticated')

			const data = await handleSimpleFetchResponse(response).then((res) => res.json())

			if (data.isUpgrade) {
				if (!data.requiresPayment) {
					return { kind: 'freeUpgrade' }
				}
				if (!data.clientSecret) throw new Error('No client secret returned for upgrade payment')

				let pricing: UpgradePricing | null = null
				if (data.amount !== undefined && data.currency) {
					pricing = {
						amount: data.amount,
						currency: data.currency,
						prorationCredit: data.prorationCredit || 0,
						newSubscriptionPrice: data.newSubscriptionPrice || 0
					}
				}

				return { kind: 'paidUpgrade', clientSecret: data.clientSecret, pricing }
			}

			if (!data.clientSecret) throw new Error('No client secret returned from server')
			return { kind: 'checkout', clientSecret: data.clientSecret }
		},
		onSuccess: async (result) => {
			if (result.kind === 'freeUpgrade') {
				await queryClient.invalidateQueries({ queryKey: ['subscription'] })
				onClose()
			}
		}
	})

	const createSubscription = subscriptionMutation.mutateAsync

	const fetchClientSecret = useCallback(async (): Promise<string> => {
		const result = await createSubscription()
		if (result.kind === 'checkout') return result.clientSecret
		throw new Error(`Unexpected subscription kind: ${result.kind}`)
	}, [createSubscription])

	const result = subscriptionMutation.data
	const errorMessage = subscriptionMutation.error?.message ?? null

	if (stripeInstance == null) {
		return (
			<Dialog size="md" open={isOpen} onClose={onClose} portal unmountOnHide>
				<DialogHeader title="Checkout" />
				<DialogBody>
					<InlineStatus variant="error">
						Stripe is not configured. Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in your environment.
					</InlineStatus>
				</DialogBody>
			</Dialog>
		)
	}

	if (result?.kind === 'paidUpgrade') {
		return (
			<Elements stripe={stripeInstance} options={{ clientSecret: result.clientSecret }}>
				<UpgradePaymentDialog
					isOpen={isOpen}
					onClose={onClose}
					planLabel={`${type === 'api' ? 'API' : 'Pro'} - ${billingInterval === 'year' ? 'Annual' : 'Monthly'}`}
					pricing={result.pricing}
					billingInterval={billingInterval}
					postCheckoutPath={postCheckoutPath}
				/>
			</Elements>
		)
	}

	// The embedded checkout loads and grows inside its iframe, so the phone sheet keeps its full height.
	return (
		<Dialog size="md" fullSheet open={isOpen} onClose={onClose} portal unmountOnHide>
			<DialogHeader title="Complete Your Purchase" />
			{errorMessage ? (
				<>
					<DialogBody>
						<InlineStatus variant="error">{errorMessage}</InlineStatus>
					</DialogBody>
					<DialogFooter>
						{/* A fresh checkout provider asks the server for a new session. */}
						<Button type="button" variant="primary" size="md" onClick={subscriptionMutation.reset}>
							Try Again
						</Button>
					</DialogFooter>
				</>
			) : (
				<DialogBody kind="flush">
					<div className="relative min-h-[400px]">
						{/* The checkout draws nothing until the session arrives, so the wait needs its own label. */}
						{result ? null : (
							<div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center">
								<LoadingIndicator label="Loading checkout" />
							</div>
						)}
						<EmbeddedCheckoutProvider stripe={stripeInstance} options={{ fetchClientSecret }}>
							<EmbeddedCheckout />
						</EmbeddedCheckoutProvider>
					</div>
				</DialogBody>
			)}
		</Dialog>
	)
}

function UpgradePaymentDialog({
	isOpen,
	onClose,
	planLabel,
	pricing,
	billingInterval,
	postCheckoutPath
}: {
	isOpen: boolean
	onClose: () => void
	planLabel: string
	pricing: UpgradePricing | null
	billingInterval: 'year' | 'month'
	postCheckoutPath: string
}) {
	const stripe = useStripe()
	const elements = useElements()

	const paymentMutation = useMutation({
		mutationFn: async () => {
			if (!stripe || !elements) throw new Error('Stripe not loaded')

			const submitResult = await elements.submit()
			if (submitResult.error) {
				throw new Error(submitResult.error.message || 'Payment failed')
			}

			const confirmResult = await stripe.confirmPayment({
				elements,
				confirmParams: {
					return_url: `${window.location.origin}${postCheckoutPath}`
				},
				redirect: 'if_required'
			})

			if (confirmResult.error) {
				throw new Error(confirmResult.error.message || 'Payment failed')
			}

			if (!confirmResult.paymentIntent) {
				throw new Error('Unexpected payment response. Check your account or try again.')
			}

			if (confirmResult.paymentIntent.status !== 'succeeded') {
				throw new Error(getFriendlyPaymentStatus(confirmResult.paymentIntent.status))
			}

			return confirmResult.paymentIntent
		}
	})

	// A charged payment stays locked while the page navigates away, so it cannot be submitted twice.
	const paying = paymentMutation.isPending || paymentMutation.isSuccess

	const handleSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		if (paying) return
		paymentMutation.mutate(undefined, {
			// A mutate() callback, unlike the hook's onSuccess, is dropped once this dialog unmounts on close.
			onSuccess: () => {
				window.location.href = `${window.location.origin}${postCheckoutPath}`
			}
		})
	}

	// The payment cannot be cancelled once confirmPayment starts, so the dialog stays open until it settles.
	return (
		<Dialog size="md" fullSheet open={isOpen} onClose={onClose} pending={paying} portal unmountOnHide>
			<form onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title="Complete Your Upgrade" />
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
						{pricing
							? "You'll be charged immediately and your subscription will be updated."
							: 'Enter your payment details below to complete the upgrade.'}
					</p>
					<PaymentElement />
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
						Complete Upgrade
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{paying ? 'Processing payment' : ''}
				</span>
			</form>
		</Dialog>
	)
}
