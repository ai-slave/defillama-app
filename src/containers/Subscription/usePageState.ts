import { useAuthContext } from '~/auth'
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

export function useSubscriptionPageState(): PageState {
	const isClient = useIsClient()
	const { isAuthenticated, isTrial, loaders } = useAuthContext()
	const { apiSubscription, llamafeedSubscription, isSubscriptionLoading, isSubscriptionError, subscription } =
		useSubscribe()

	const isLoading = isClient && (loaders.userLoading || (isAuthenticated && (isSubscriptionLoading || !subscription)))

	let currentPlan: PlanKey | null = null
	let userBillingCycle: BillingCycle | null = null
	let currentSubscription = null

	if (isAuthenticated && !isSubscriptionError) {
		if (apiSubscription?.status === 'active') {
			currentPlan = 'api'
			userBillingCycle = apiSubscription.billing_interval === 'year' ? 'yearly' : 'monthly'
			currentSubscription = apiSubscription
		} else if (llamafeedSubscription?.status === 'active') {
			currentPlan = 'pro'
			userBillingCycle = llamafeedSubscription.billing_interval === 'year' ? 'yearly' : 'monthly'
			currentSubscription = llamafeedSubscription
		} else {
			currentPlan = 'free'
		}
	}

	const isManualSubscription = subscription?.provider === 'manual'

	return {
		isAuthenticated,
		currentPlan,
		isTrial,
		userBillingCycle,
		isManualSubscription,
		currentProvider: currentSubscription?.provider ?? null,
		isTeamProvided: Boolean(currentSubscription?.team_id),
		isSubscriptionError: isAuthenticated && isSubscriptionError,
		isLoading
	}
}
