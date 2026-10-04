import { useAuthContext } from '~/auth'
import type { Subscription } from '~/auth/subscriptionStatus'
import { useSubscribe } from '~/auth/useSubscribe'
import { useIsClient } from '~/hooks/useIsClient'
import type { BillingCycle, PlanKey } from './types'

interface PageState {
	isAuthenticated: boolean
	currentPlan: PlanKey | null
	isTrial: boolean
	userBillingCycle: BillingCycle | null
	isManualSubscription: boolean
	// Provider of the active plan; self-serve Stripe changes are only valid for
	// Stripe-billed personal subscriptions.
	currentProvider: string | null
	isTeamProvided: boolean
	// The plan is unknown, not Free: don't offer plan changes until a read succeeds.
	isSubscriptionError: boolean
	isLoading?: boolean
}

type SubscribedPlan = {
	currentPlan: PlanKey
	userBillingCycle: BillingCycle | null
	isManualSubscription: boolean
	currentProvider: string | null
	isTeamProvided: boolean
}

/** The plan a signed-in reader's subscription puts them on. */
export function readSubscribedPlan(subscription: Subscription | null): SubscribedPlan {
	const active =
		subscription?.status === 'active' && (subscription.type === 'api' || subscription.type === 'llamafeed')
			? subscription
			: null
	return {
		currentPlan: !active ? 'free' : active.type === 'api' ? 'api' : 'pro',
		userBillingCycle: !active ? null : active.billing_interval === 'year' ? 'yearly' : 'monthly',
		isManualSubscription: subscription?.provider === 'manual',
		currentProvider: active?.provider ?? null,
		isTeamProvided: Boolean(active?.team_id)
	}
}

const PLAN_TIER: Record<PlanKey, number> = { free: 0, pro: 1, api: 2, enterprise: 3 }

/** What stops a signed-in reader's checkout for `plan`: a message saying why, 'skip' when the plan or a higher one is
    already theirs, or null when the checkout may start. */
export function planCheckoutBlock(
	plan: PlanKey,
	{
		currentPlan,
		isTrial,
		isManualSubscription,
		isTeamProvided,
		currentProvider
	}: Omit<SubscribedPlan, 'userBillingCycle'> & { isTrial: boolean }
): string | 'skip' | null {
	// Plans not billed through the reader's own Stripe account can't change through self-serve checkout.
	if (isTeamProvided) return 'Your plan is provided through your team. Ask your team admin about plan changes.'
	if (isManualSubscription)
		return "Your plan was set up by the DefiLlama team, so it can't be changed here. Email support@defillama.com to change it."
	if (currentPlan !== 'free' && currentProvider !== 'stripe')
		return currentProvider === 'llamapay' || currentProvider === 'legacy'
			? 'Your plan is billed through LlamaPay. Manage it at subscriptions.llamapay.io first.'
			: 'Your plan is billed through the app store. Manage it there first.'
	if (plan === currentPlan || (isTrial && plan === 'pro') || PLAN_TIER[plan] < PLAN_TIER[currentPlan]) return 'skip'
	return null
}

export function useSubscriptionPageState(): PageState {
	const isClient = useIsClient()
	const { isAuthenticated, isTrial, loaders } = useAuthContext()
	const { isSubscriptionLoading, isSubscriptionError, subscription } = useSubscribe()

	const isLoading = isClient && (loaders.userLoading || (isAuthenticated && (isSubscriptionLoading || !subscription)))
	const plan = readSubscribedPlan(subscription)
	const knowsPlan = isAuthenticated && !isSubscriptionError

	return {
		isAuthenticated,
		currentPlan: knowsPlan ? plan.currentPlan : null,
		isTrial,
		userBillingCycle: knowsPlan ? plan.userBillingCycle : null,
		isManualSubscription: plan.isManualSubscription,
		currentProvider: knowsPlan ? plan.currentProvider : null,
		isTeamProvided: knowsPlan && plan.isTeamProvided,
		isSubscriptionError: isAuthenticated && isSubscriptionError,
		isLoading
	}
}
