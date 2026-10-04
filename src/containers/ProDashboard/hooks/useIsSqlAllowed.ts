import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'

export interface SqlAllowedState {
	isAllowed: boolean
	isAuthenticated: boolean
	isTrial: boolean
	loading: boolean
	/** The subscription read failed — access is unknown, not "not on API". */
	isUnknown: boolean
	isRetrying: boolean
	retry: () => void
}

export function useIsSqlAllowed(): SqlAllowedState {
	const { isAuthenticated, isTrial, loaders, user } = useAuthContext()
	const { subscription, isSubscriptionLoading, isSubscriptionError, isSubscriptionRetrying, refetchSubscription } =
		useSubscribe()

	const isApiPlan = subscription?.type === 'api' && subscription?.status === 'active'
	const isLlama = !!user?.flags?.is_llama
	const isAllowed = isAuthenticated && (isApiPlan || isLlama)
	const loading = loaders.userLoading || (isAuthenticated && isSubscriptionLoading && !isLlama)
	// Only a subscription that never loaded is unknown (the session still reads as loading); a failed refresh keeps
	// the last answer, so it never unmounts an open SQL tab.
	const isUnknown = isAuthenticated && isSubscriptionError && loaders.userLoading && !isLlama

	return {
		isAllowed,
		isAuthenticated,
		isTrial,
		loading,
		isUnknown,
		isRetrying: isSubscriptionRetrying,
		retry: () => void refetchSubscription()
	}
}
