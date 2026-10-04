import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { FEATURES_SERVER } from '~/constants'
import { handleSimpleFetchResponse } from '~/utils/async'
import pb from '~/utils/pocketbase'
import { queryReadFailed } from '~/utils/query'

export type MetricType =
	| 'tvl'
	| 'fees'
	| 'revenue'
	| 'holders-revenue'
	| 'volume'
	| 'perps'
	| 'mcap'
	| 'stablecoins'
	| 'fdv'
	| 'ofdv'
	| 'price'

export interface NotificationSettings {
	chains?: Record<string, Array<MetricType>>
	protocols?: Record<string, Array<MetricType>>
}

interface NotificationPreference {
	id: string
	userId: string
	settings: NotificationSettings
	frequency: 'daily' | 'weekly'
	active: boolean
	created: string
	updated: string
}

interface SaveNotificationPreferencesRequest {
	portfolioName: string
	settings: NotificationSettings
	frequency: 'daily' | 'weekly'
}

export const useEmailNotifications = (portfolioName?: string) => {
	const { authorizedFetch } = useAuthContext()!
	const queryClient = useQueryClient()
	const isAuthenticated = !!pb.authStore.token

	const preferencesQuery = useQuery<NotificationPreference | null>({
		queryKey: ['notifications', 'preferences', pb.authStore.record?.id, portfolioName],
		queryFn: async () => {
			if (!isAuthenticated || !portfolioName) {
				return null
			}

			const url = new URL(`${FEATURES_SERVER}/watchlist/preferences`)
			url.searchParams.append('portfolioName', portfolioName)

			const response = await authorizedFetch(url.toString(), {
				method: 'GET'
			})

			if (!response) throw new Error('Not authenticated')

			if (!response.ok) {
				if (response.status === 404) {
					return null
				}
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
			}
			await handleSimpleFetchResponse(response)

			const data: { preferences?: NotificationPreference | null } | null = await response.json().catch(() => null)
			return data?.preferences ?? null
		},
		enabled: isAuthenticated && !!portfolioName,
		staleTime: 1000 * 60 * 5, // 5 minutes
		refetchOnWindowFocus: false,
		retry: 0
	})

	const savePreferences = useMutation<NotificationPreference, Error, SaveNotificationPreferencesRequest>({
		mutationFn: async (preferencesData) => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const response = await authorizedFetch(
				`${FEATURES_SERVER}/watchlist/preferences`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(preferencesData)
				},
				true
			)

			if (!response) throw new Error('Not authenticated')

			await handleSimpleFetchResponse(response)

			const data = await response.json()
			return data.preferences
		},
		onSuccess: (data, variables) => {
			queryClient.setQueryData(['notifications', 'preferences', pb.authStore.record?.id, variables.portfolioName], data)
		}
	})

	const updateStatus = useMutation<void, Error, { portfolioName: string; active: boolean }>({
		mutationFn: async ({ portfolioName: portfolioNameToUpdate, active }) => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const response = await authorizedFetch(
				`${FEATURES_SERVER}/watchlist/status`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ portfolioName: portfolioNameToUpdate, active })
				},
				true
			)

			if (!response) throw new Error('Not authenticated')

			await handleSimpleFetchResponse(response)
		},
		onSuccess: (_, variables) => {
			void queryClient.invalidateQueries({
				queryKey: ['notifications', 'preferences', pb.authStore.record?.id, variables.portfolioName]
			})
		}
	})

	const deletePreferences = useMutation<void, Error, { portfolioName: string }>({
		mutationFn: async ({ portfolioName: portfolioNameToDelete }) => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const url = new URL(`${FEATURES_SERVER}/watchlist/preferences`)
			url.searchParams.append('portfolioName', portfolioNameToDelete)

			const response = await authorizedFetch(
				url.toString(),
				{
					method: 'DELETE'
				},
				true
			)

			if (!response) throw new Error('Not authenticated')

			await handleSimpleFetchResponse(response)
		},
		onSuccess: (_, variables) => {
			queryClient.setQueryData(['notifications', 'preferences', pb.authStore.record?.id, variables.portfolioName], null)
		}
	})

	const { data: preferences, isLoading, isFetching, refetch } = preferencesQuery
	return {
		preferences,
		isLoading,
		isFetching,
		readFailed: queryReadFailed(preferencesQuery),
		refetch,
		savePreferences,
		updateStatus,
		deletePreferences
	}
}
