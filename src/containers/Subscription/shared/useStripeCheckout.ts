import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { getReferrer } from '~/auth/referrer'
import { fetchSubscriptionStatus } from '~/auth/subscriptionStatus'
import { AUTH_SERVER } from '~/constants'
import { handleSimpleFetchResponse } from '~/utils/async'
import pb from '~/utils/pocketbase'
import {
	decideEarlierUpgrade,
	forgetPendingUpgrade,
	isFinished,
	type PendingUpgrade,
	readPendingUpgrade,
	savePendingUpgrade,
	type UnderWayStatus,
	type UpgradePricing,
	withUpgradeLock
} from './pendingUpgrade'
import { CARD_PAYMENTS_UNAVAILABLE, loadStripeOnce } from './stripeClient'

export interface CheckoutRequest {
	type: 'api' | 'llamafeed'
	billingInterval: 'year' | 'month'
	isTrial?: boolean
	isUpgradeFlow?: boolean
	upgradeReturnPath?: string
}

export type CheckoutSession =
	| { kind: 'checkout'; clientSecret: string }
	// `awaitingVerification`: a resumed payment whose bank check is still outstanding, finished by that check rather
	// than a new card entry.
	| { kind: 'paidUpgrade'; clientSecret: string; pricing: UpgradePricing | null; awaitingVerification: boolean }
	// An earlier upgrade payment from this browser may still be moving money, so no new one is created.
	| { kind: 'pendingUpgrade'; status: UnderWayStatus; stale: boolean }
	// An earlier upgrade intent from this browser can still be paid but is too old or for another plan to resume.
	| { kind: 'openUpgrade'; plan: PendingUpgrade['plan']; interval: PendingUpgrade['interval']; stale: boolean }

// The return page confirms a purchase only once the subscription reads as the plan bought here. The base only parses
// the relative path; the query merges with any the caller's path already has.
export function checkoutReturnPath(request: CheckoutRequest) {
	const base = request.isUpgradeFlow ? (request.upgradeReturnPath ?? '/account?success=true') : '/welcome'
	const returnUrl = new URL(base, 'https://defillama.com')
	returnUrl.searchParams.set('plan', request.type)
	returnUrl.searchParams.set('interval', request.billingInterval)
	return `${returnUrl.pathname}${returnUrl.search}`
}

const ACCOUNT_SWITCHED = 'The signed-in account changed while the checkout was starting. Try again.'

async function readPaymentStatus(clientSecret: string) {
	const stripe = await loadStripeOnce()
	if (!stripe) throw new Error(CARD_PAYMENTS_UNAVAILABLE)
	const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret)
	if (error) throw new Error("Couldn't check your earlier upgrade payment. Try again.")
	return paymentIntent.status
}

// The facts the stored intent is judged on: Stripe's status for it and, once it succeeded, whether its plan shows.
async function checkEarlierUpgrade(userId: string, token: string) {
	const record = readPendingUpgrade(userId)
	if (!record) return null
	const status = await readPaymentStatus(record.clientSecret)
	let targetApplied = false
	if (status === 'succeeded') {
		const current = await fetchSubscriptionStatus({ token, subscriptionType: record.plan })
		targetApplied = current?.type === record.plan && current.billing_interval === record.interval
	}
	return { record, status, targetApplied }
}

// A return page drops the stored intent on the same facts an opening uses, never on its own URL or plan.
export function forgetFinishedUpgrade(userId: string, token: string) {
	return withUpgradeLock(userId, async () => {
		const earlier = await checkEarlierUpgrade(userId, token)
		if (earlier && isFinished(earlier.status, earlier.targetApplied))
			forgetPendingUpgrade(userId, earlier.record.clientSecret)
	})
}

/* Creating a checkout session is a backend write, so only a user's click starts one: `open` creates exactly one
   session per opening and `retry` one more after a failure. The dialog only reads the session. Nothing it mounts,
   remounts or closes asks for another, and closing keeps the session so the dialog leaves showing what it showed. */
export function useStripeCheckout() {
	const { authorizedFetch, user, authToken } = useAuthContext()
	const queryClient = useQueryClient()
	const [isOpen, setIsOpen] = useState(false)

	const session = useMutation({
		retry: false,
		mutationFn: async (request: CheckoutRequest): Promise<CheckoutSession> => {
			if (!user) throw new Error("You're signed out. Sign in and try again.")
			const userId = user.id
			const createSession = async (): Promise<CheckoutSession> => {
				const earlier = await checkEarlierUpgrade(userId, authToken!)
				// The checkout belongs to the account that clicked. The lock and the earlier-payment check are awaited, and
				// another tab can sign in as someone else or sign out meanwhile. Every branch below hands out that
				// account's payment or creates one, so none runs once another account is signed in. Nothing below awaits
				// before the create request, and authorizedFetch reads its token synchronously.
				if (pb.authStore.record?.id !== userId) throw new Error(ACCOUNT_SWITCHED)
				if (earlier) {
					const { record } = earlier
					const decision = decideEarlierUpgrade(
						record,
						earlier.status,
						earlier.targetApplied,
						{ plan: request.type, interval: request.billingInterval },
						Date.now()
					)
					switch (decision.kind) {
						case 'resume':
							return {
								kind: 'paidUpgrade',
								clientSecret: record.clientSecret,
								pricing: record.pricing,
								awaitingVerification: decision.awaitingVerification
							}
						case 'underWay':
							return { kind: 'pendingUpgrade', status: decision.status, stale: decision.stale }
						case 'hold':
							return { kind: 'openUpgrade', plan: record.plan, interval: record.interval, stale: decision.stale }
						case 'forget':
							forgetPendingUpgrade(userId, record.clientSecret)
					}
				}

				if (!request.isUpgradeFlow) sessionStorage.setItem('onboarding_returnUrl', window.location.pathname)
				const response = await authorizedFetch(
					`${AUTH_SERVER}/subscription/create`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							redirectUrl: `${window.location.origin}${checkoutReturnPath(request)}`,
							cancelUrl: `${window.location.origin}/subscription`,
							provider: 'stripe',
							subscriptionType: request.type,
							billingInterval: request.billingInterval,
							isTrial: request.isTrial ?? false,
							referralCode: getReferrer()
						})
					},
					true
				)

				if (!response) throw new Error('Not authenticated')

				const data = await handleSimpleFetchResponse(response).then((res) => res.json())

				// Every upgrade asks for a payment; a response without a client secret is an error, never a free upgrade.
				if (data.isUpgrade) {
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

					// Recorded as soon as it exists, so another tab or a reload resumes this intent instead of creating one. It
					// is the clicking account's intent even if the session changed while it was created.
					savePendingUpgrade(userId, {
						plan: request.type,
						interval: request.billingInterval,
						clientSecret: data.clientSecret,
						pricing,
						createdAt: Date.now()
					})
					if (pb.authStore.record?.id !== userId) throw new Error(ACCOUNT_SWITCHED)
					return { kind: 'paidUpgrade', clientSecret: data.clientSecret, pricing, awaitingVerification: false }
				}

				if (!data.clientSecret) throw new Error('No client secret returned from server')
				if (pb.authStore.record?.id !== userId) throw new Error(ACCOUNT_SWITCHED)
				return { kind: 'checkout', clientSecret: data.clientSecret }
			}
			// Two first openings cannot both find no record and each create an intent.
			return withUpgradeLock(userId, createSession)
		},
		onSuccess: (result) => {
			// The earlier payment may have cleared since the page last read the plan.
			if (result.kind === 'pendingUpgrade') void queryClient.invalidateQueries({ queryKey: ['subscription'] })
		}
	})

	return {
		isOpen,
		session,
		open: (request: CheckoutRequest) => {
			setIsOpen(true)
			session.mutate(request)
		},
		retry: () => session.mutate(session.variables!),
		close: () => setIsOpen(false)
	}
}

export type StripeCheckout = ReturnType<typeof useStripeCheckout>
