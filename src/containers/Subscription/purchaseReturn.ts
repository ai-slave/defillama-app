import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { fetchSubscriptionStatus, subscriptionStatusQueryKey } from '~/auth/subscriptionStatus'

// A checkout's return URL is user-editable, so only a plan the checkout sells is trusted as the purchase.
export const PURCHASABLE_PLANS = new Set(['api', 'llamafeed'])

export const queryValue = (value: string | Array<string> | undefined) => (Array.isArray(value) ? value[0] : value)

/* One plan's own subscription record. The untyped status read returns only the first active plan, so a user with Pro
   and API reads the plan in question by type. It sits under the subscription key, so every subscription re-read
   refreshes it too. */
export function usePlanRecord(plan: string | null) {
	const { user, authToken } = useAuthContext()
	return useQuery({
		queryKey: [...subscriptionStatusQueryKey(user?.id ?? null), 'plan', plan],
		queryFn: ({ signal }) => fetchSubscriptionStatus({ token: authToken!, signal, subscriptionType: plan! }),
		enabled: plan !== null && authToken !== null,
		retry: false
	}).data
}
