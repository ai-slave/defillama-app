import * as Ariakit from '@ariakit/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { fetchSubscriptionStatus, subscriptionStatusQueryKey } from '~/auth/subscriptionStatus'
import { useSubscribe } from '~/auth/useSubscribe'
import { ManageAccount } from '~/containers/Account/ManageAccount'
import Layout from '~/layout'
import { ClientOnly } from '~/layout/ClientOnly'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { LoadingIndicator } from '~/ui/Status'

// Reads of the subscription after a ?success=true return, as WelcomeOnboarding budgets them: one at once, then
// one every four seconds until it reads the bought plan.
const PAYMENT_CONFIRMATION_READS = 6

const PAYMENT_TITLES = {
	confirming: 'Confirming your payment',
	confirmed: 'Payment Successful',
	unconfirmed: 'Payment still confirming',
	failed: 'Payment Not Completed',
	processing: 'Payment Processing',
	processingUnconfirmed: 'Payment Processing'
} as const

const PAYMENT_DESCRIPTIONS = {
	confirmed: 'Your payment went through. Any plan changes will be reflected on your account shortly.',
	unconfirmed: 'Your payment is still being confirmed. Refresh the page in a minute to see your plan.',
	failed: "Your payment didn't go through, so your plan hasn't changed.",
	processing: 'Your bank is still processing the payment. Your plan updates once it clears.',
	processingUnconfirmed: 'Your bank is still processing the payment. Refresh the page later to see your plan.'
} as const

// The checkout's own return params and the ones Stripe appends after a paid upgrade.
const CHECKOUT_RETURN_PARAMS = [
	'success',
	'plan',
	'interval',
	'redirect_status',
	'payment_intent',
	'payment_intent_client_secret'
]

// A failed payment is final for this visit. A paid or still-processing one waits for the webhook: `purchase` is the
// plan the checkout bought (null on an older link without it), `reads` the subscription reads completed so far.
type PaymentReturn =
	| { outcome: 'failed' }
	| { outcome: 'paid' | 'processing'; purchase: { plan: string; interval: string } | null; reads: number }

// The return URL is user-editable, so only a plan the checkout sells is trusted as the purchase.
const PURCHASABLE_PLANS = new Set(['api', 'llamafeed'])

const queryValue = (value: string | Array<string> | undefined) => (Array.isArray(value) ? value[0] : value)

export default function Account() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { isAuthenticated, user, authToken } = useAuthContext()
	const { hasActiveSubscription } = useSubscribe()
	const topupProcessedRef = useRef(false)
	const successProcessedRef = useRef(false)
	const teamCheckoutProcessedRef = useRef(false)
	// Null when the page did not open from a checkout return.
	const [paymentReturn, setPaymentReturn] = useState<PaymentReturn | null>(null)
	const [showPaymentDialog, setShowPaymentDialog] = useState(false)

	const topupSuccess = queryValue(router.query.topup)
	const success = queryValue(router.query.success)
	const teamCheckout = queryValue(router.query['team-checkout'])

	// The checkout redirect lands before the webhook applies the purchase, so
	// re-read the affected data a bounded number of times instead of announcing
	// the result as already applied.
	const scheduleConfirmationReads = useCallback(
		(queryKey: Array<string>) => {
			void queryClient.invalidateQueries({ queryKey })
			for (const delay of [4000, 12_000]) {
				window.setTimeout(() => void queryClient.invalidateQueries({ queryKey }), delay)
			}
		},
		[queryClient]
	)

	// Handle ?topup=success
	useEffect(() => {
		if (topupSuccess !== 'success' || !isAuthenticated || topupProcessedRef.current) return
		topupProcessedRef.current = true
		scheduleConfirmationReads(['ai-balance'])
		toast.success('Top-up payment received! Your External Data Balance will update shortly.')
		const { topup: _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [topupSuccess, isAuthenticated, scheduleConfirmationReads, router])

	useEffect(() => {
		if (topupSuccess !== 'success') {
			topupProcessedRef.current = false
		}
	}, [topupSuccess])

	// Handle ?success=true (post-upgrade redirect from Stripe). The dialog opens at once and
	// follows the re-reads below: a single read can race the webhook and cache a premature
	// 404 as confirmed Free.
	useEffect(() => {
		if (success !== 'true' || !isAuthenticated || successProcessedRef.current) return
		successProcessedRef.current = true
		const redirectStatus = queryValue(router.query.redirect_status)
		const plan = queryValue(router.query.plan)
		const interval = queryValue(router.query.interval)
		const purchase = plan && interval && PURCHASABLE_PLANS.has(plan) ? { plan, interval } : null
		// Stripe reports a declined redirect payment as `failed` or `requires_payment_method`; a processing one can
		// still clear while the page is open, so it waits for the plan like a paid one.
		setPaymentReturn(
			redirectStatus === 'failed' || redirectStatus === 'requires_payment_method'
				? { outcome: 'failed' }
				: { outcome: redirectStatus === 'processing' ? 'processing' : 'paid', purchase, reads: 0 }
		)
		setShowPaymentDialog(true)
		const nextQuery = { ...router.query }
		for (const key of CHECKOUT_RETURN_PARAMS) delete nextQuery[key]
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [success, isAuthenticated, router])

	useEffect(() => {
		if (success !== 'true') {
			successProcessedRef.current = false
		}
	}, [success])

	// An upgrade starts from an active plan (a trial, or monthly before yearly), so only the bought plan confirms it.
	// The untyped status read returns just the first active plan, so a user with Pro and API reads the bought one
	// by type. It sits under the subscription key, so the reads below refresh it with the rest.
	const purchase = paymentReturn !== null && paymentReturn.outcome !== 'failed' ? paymentReturn.purchase : null
	const purchasedSubscription = useQuery({
		queryKey: [...subscriptionStatusQueryKey(user?.id ?? null), 'purchase', purchase?.plan ?? null],
		queryFn: ({ signal }) => fetchSubscriptionStatus({ token: authToken!, signal, subscriptionType: purchase!.plan }),
		enabled: purchase !== null && authToken !== null,
		retry: false
	}).data
	// The trial flag arrives as Stripe metadata, which the plan cards read as a string too.
	const paymentConfirmed = purchase
		? purchasedSubscription != null &&
			purchasedSubscription.type === purchase.plan &&
			purchasedSubscription.billing_interval === purchase.interval &&
			String(purchasedSubscription.metadata?.isTrial) !== 'true'
		: hasActiveSubscription

	// A read counts once it settles, so the budget cannot run out while the last one is in flight.
	useEffect(() => {
		if (
			paymentReturn === null ||
			paymentReturn.outcome === 'failed' ||
			paymentConfirmed ||
			paymentReturn.reads >= PAYMENT_CONFIRMATION_READS
		)
			return
		const id = window.setTimeout(
			() =>
				void queryClient
					.invalidateQueries({ queryKey: ['subscription'] })
					.then(() => setPaymentReturn({ ...paymentReturn, reads: paymentReturn.reads + 1 })),
			paymentReturn.reads === 0 ? 0 : 4000
		)
		return () => window.clearTimeout(id)
	}, [paymentReturn, paymentConfirmed, queryClient])

	const readsDone =
		paymentReturn !== null && paymentReturn.outcome !== 'failed' && paymentReturn.reads >= PAYMENT_CONFIRMATION_READS
	const paymentStep =
		paymentReturn === null
			? 'confirming'
			: paymentReturn.outcome === 'failed'
				? 'failed'
				: paymentConfirmed
					? 'confirmed'
					: paymentReturn.outcome === 'processing'
						? readsDone
							? 'processingUnconfirmed'
							: 'processing'
						: readsDone
							? 'unconfirmed'
							: 'confirming'

	// Handle ?team-checkout=success
	useEffect(() => {
		if (teamCheckout !== 'success' || !isAuthenticated || teamCheckoutProcessedRef.current) return
		teamCheckoutProcessedRef.current = true
		scheduleConfirmationReads(['team'])
		toast.success('Payment received! Your team seats will be available shortly.')
		const { 'team-checkout': _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [teamCheckout, isAuthenticated, scheduleConfirmationReads, router])

	useEffect(() => {
		if (teamCheckout !== 'success') {
			teamCheckoutProcessedRef.current = false
		}
	}, [teamCheckout])

	return (
		<ClientOnly>
			<Layout
				title="Manage Account - DefiLlama"
				description="Manage your DefiLlama account settings and authentication."
				canonicalUrl="/account"
			>
				<div className="mx-auto w-full max-w-[720px] py-6">
					<ManageAccount />
				</div>

				<Dialog size="sm" open={showPaymentDialog} onClose={() => setShowPaymentDialog(false)} portal unmountOnHide>
					<DialogHeader title={PAYMENT_TITLES[paymentStep]} />
					<DialogBody>
						{/* One live region for every step, so the outcome is announced when the reads settle. */}
						<div role="status">
							{paymentStep === 'confirming' ? (
								<LoadingIndicator label="Checking your payment" />
							) : (
								<Ariakit.DialogDescription className="body-sm text-secondary">
									{PAYMENT_DESCRIPTIONS[paymentStep]}
								</Ariakit.DialogDescription>
							)}
						</div>
					</DialogBody>
					<DialogFooter>
						{/* The same button across steps keeps focus in place when the outcome arrives. */}
						<Ariakit.DialogDismiss
							autoFocus
							render={<Button variant={paymentStep === 'confirming' ? 'secondary' : 'primary'} size="md" />}
						>
							{paymentStep === 'confirming' ? 'Close' : 'Done'}
						</Ariakit.DialogDismiss>
					</DialogFooter>
				</Dialog>
			</Layout>
		</ClientOnly>
	)
}
