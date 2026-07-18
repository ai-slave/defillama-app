import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'

export interface SqlAllowedState {
	isAllowed: boolean
	isAuthenticated: boolean
	isTrial: boolean
	loading: boolean
}

export function useIsSqlAllowed(): SqlAllowedState {
	const { isAuthenticated, isTrial, loaders, user } = useAuthContext()
	const { subscription, isSubscriptionLoading } = useSubscribe()

	const isApiPlan = subscription?.type === 'api' && subscription?.status === 'active'
	const isLlama = !!user?.flags?.is_llama
	const isAllowed = isAuthenticated && (isApiPlan || isLlama)
	const loading = loaders.userLoading || (isAuthenticated && isSubscriptionLoading && !isLlama)

	return { isAllowed, isAuthenticated, isTrial, loading }
}
