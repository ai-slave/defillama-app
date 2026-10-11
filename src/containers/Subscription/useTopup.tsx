import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AUTH_SERVER } from '~/constants'
import { handleSimpleFetchResponse, httpErrorMessage } from '~/utils/async'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'

interface AiBalance {
	freeRemaining: string
	toppedUpBalance: string
	freeLimit: string
	freeSpent: string
}

interface TopupRequest {
	amount: number
	provider: 'stripe' | 'llamapay'
	redirectUrl: string
	cancelUrl: string
}

type TopupResult = { provider: 'stripe'; clientSecret: string } | { provider: 'llamapay'; checkoutUrl: string }

export const AI_BALANCE_QUERY_KEY = 'ai-balance'

export const TOPUP_CONFIG = {
	minAmount: 1,
	maxAmount: 500,
	quickAmounts: [5, 10, 25, 50]
} as const

export const useAiBalance = () => {
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()!

	const balanceQuery = useQuery<AiBalance>({
		queryKey: [AI_BALANCE_QUERY_KEY, user?.id],
		queryFn: async () => {
			const data = await authorizedFetch(`${AUTH_SERVER}/user/ai-balance`, {
				method: 'GET'
			})
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())

			return data
		},
		enabled: isAuthenticated,
		staleTime: 1000 * 60 * 5,
		refetchOnWindowFocus: false
	})

	const { data: balance, isLoading, isFetching, refetch } = balanceQuery
	const totalAvailable = balance ? parseFloat(balance.freeRemaining) + parseFloat(balance.toppedUpBalance) : 0

	// A top-up return polls and refreshes over a loaded balance: a failed check leaves the balance unknown, not unchanged.
	const readFailed = queryReadFailed(balanceQuery) || queryRefreshFailed(balanceQuery)
	return { balance, totalAvailable, isLoading, isFetching, readFailed, refetch }
}

/** `isErrorShown` says whether the form that started the top-up still shows its error inline. */
export const useCreateTopup = (isErrorShown: () => boolean) => {
	const { isAuthenticated, authorizedFetch } = useAuthContext()!
	const queryClient = useQueryClient()

	return useMutation<TopupResult, Error, TopupRequest>({
		mutationFn: async (topupData) => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const response = await authorizedFetch(
				`${AUTH_SERVER}/topup/create`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(topupData)
				},
				true
			)

			if (!response) {
				throw new Error('Not authenticated')
			}

			const normalizedResponse = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(httpErrorMessage(error, "Couldn't create the top-up."))
			})

			return normalizedResponse.json()
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [AI_BALANCE_QUERY_KEY] })
		},
		// Hook-level, so it still runs after the form unmounts. A payment write is never retried for the user.
		onError: (error) => {
			if (!isErrorShown()) toast.error(`Top-up failed: ${error.message}`)
		}
	})
}
