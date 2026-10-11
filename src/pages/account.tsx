import * as Ariakit from '@ariakit/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { ManageAccount } from '~/containers/Account/ManageAccount'
import { savePendingTeamCheckout } from '~/containers/Account/Team/pendingTeamCheckout'
import { scheduleConfirmationReads } from '~/containers/Account/utils'
import { PURCHASABLE_PLANS, queryValue, usePlanRecord } from '~/containers/Subscription/purchaseReturn'
import { forgetFinishedUpgrade } from '~/containers/Subscription/shared/useStripeCheckout'
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
	confirmed: 'Payment successful',
	unconfirmed: 'Payment still confirming',
	failed: 'Payment not completed',
	processing: 'Payment processing',
	processingUnconfirmed: 'Payment processing'
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

export default function Account() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { isAuthenticated, user, authToken } = useAuthContext()
	const userId = user?.id ?? null
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

	// Handle ?topup=success
	useEffect(() => {
		if (topupSuccess !== 'success') {
			// A later return with the same param is a new payment.
			topupProcessedRef.current = false
			return
		}
		if (!isAuthenticated || topupProcessedRef.current) return
		topupProcessedRef.current = true
		scheduleConfirmationReads(queryClient, ['ai-balance'])
		toast.success('Top-up payment received! Your External Data Balance will update shortly.')
		const { topup: _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [topupSuccess, isAuthenticated, queryClient, router])

	// Handle ?success=true (post-upgrade redirect from Stripe). The dialog opens at once and
	// follows the re-reads below: a single read can race the webhook and cache a premature
	// 404 as confirmed Free.
	useEffect(() => {
		if (success !== 'true') {
			successProcessedRef.current = false
			return
		}
		if (!isAuthenticated || successProcessedRef.current) return
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

	// An upgrade starts from an active plan (a trial, or monthly before yearly), so only the bought plan confirms it.
	// The untyped status read returns just the first active plan, so a user with Pro and API reads the bought one
	// by type. It sits under the subscription key, so the reads below refresh it with the rest.
	const purchase = paymentReturn !== null && paymentReturn.outcome !== 'failed' ? paymentReturn.purchase : null
	const purchasedSubscription = usePlanRecord(purchase?.plan ?? null)
	// The trial flag arrives as Stripe metadata, which the plan cards read as a string too.
	const paymentConfirmed = purchase
		? purchasedSubscription != null &&
			purchasedSubscription.type === purchase.plan &&
			purchasedSubscription.billing_interval === purchase.interval &&
			String(purchasedSubscription.metadata?.isTrial) !== 'true'
		: hasActiveSubscription

	// Once the bought plan shows, this browser's record of an open upgrade payment may be finished. It is judged on
	// that payment's own Stripe status, since a return can belong to another payment for the same plan. A failed
	// check keeps the record, and the next upgrade opening checks it again.
	const purchaseConfirmed = purchase !== null && paymentConfirmed
	useEffect(() => {
		if (userId && authToken && purchaseConfirmed) void forgetFinishedUpgrade(userId, authToken).catch(() => {})
	}, [purchaseConfirmed, userId, authToken])

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
		if (teamCheckout !== 'success') {
			teamCheckoutProcessedRef.current = false
			return
		}
		if (!isAuthenticated || teamCheckoutProcessedRef.current) return
		teamCheckoutProcessedRef.current = true
		scheduleConfirmationReads(queryClient, ['team'])
		// The seat count and plan ride in the return URL for the message and the purchase hold only; the re-reads decide
		// what the seats card shows.
		const seats = Number(queryValue(router.query.seats))
		const type = queryValue(router.query.type)
		if (userId && type && PURCHASABLE_PLANS.has(type) && Number.isInteger(seats) && seats > 0) {
			savePendingTeamCheckout(userId, type, { seats, startedAt: Date.now() })
		}
		toast.success(
			Number.isInteger(seats) && seats > 0
				? `Payment received. ${seats} seat${seats === 1 ? '' : 's'} will be available shortly.`
				: 'Payment received! Your team seats will be available shortly.'
		)
		const { 'team-checkout': _ignored, seats: _seats, type: _type, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [teamCheckout, isAuthenticated, queryClient, router, userId])

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
						{/* The same button across steps keeps focus in place when the outcome arrives. A confirmed payment waits
						    on Done with no timed redirect: the reader reads the outcome and stays on the page that shows the plan. */}
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
