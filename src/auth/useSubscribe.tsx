import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { getReferrer } from '~/auth/referrer'
import { AUTH_SERVER } from '~/constants'
import { getStorageItem, removeStorageItem, setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { handleSimpleFetchResponse } from '~/utils/async'
import pb from '~/utils/pocketbase'

interface SubscriptionRequest {
	redirectUrl: string
	cancelUrl: string
	provider: string
	subscriptionType: string
	billingInterval?: 'year' | 'month'
	isTrial?: boolean
	referralCode?: string | null
}

interface SubscriptionCreateResponse {
	subscriptionId: string
	checkoutUrl: string
}

export interface Subscription {
	PK: string
	checkoutUrl: string
	id: string
	status: string
	updatedAt: string
	expires_at: string
	started_at?: string
	type: string
	provider: string
	billing_interval?: 'year' | 'month'
	overage?: boolean
	// Set on seat-derived records billed through a team, not the user's own provider account
	team_id?: string
	metadata?: {
		isTrial?: boolean
		trial_started_at?: string
		isCanceled?: string
		isPastDue?: string
	}
}

interface SubscriptionResponse {
	subscription: Subscription
}

interface Credits {
	credits: number
	maxCredits: number
	monthKey: string
}
const defaultInactiveSubscription: Subscription = {
	status: 'inactive',
	id: '',
	PK: '',
	checkoutUrl: '',
	updatedAt: '',
	expires_at: '',
	type: '',
	provider: ''
}

const API_KEY_LOCAL_STORAGE_KEY = 'pro_apikey'

const normalizeHttpErrorMessage = (message: string | undefined, fallbackMessage: string): string => {
	if (!message) return fallbackMessage
	if (!message.startsWith('[HTTP] [error]')) return message
	const colonIndex = message.indexOf(':')
	if (colonIndex === -1) return fallbackMessage
	const details = message.slice(colonIndex + 1).trim()
	return details || fallbackMessage
}

const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
	error instanceof Error ? normalizeHttpErrorMessage(error.message, fallbackMessage) : fallbackMessage

const syncApiKeyStorage = (apiKey: string | null) => {
	const currentApiKey = getStorageItem(API_KEY_LOCAL_STORAGE_KEY, null)
	if (apiKey === currentApiKey) return
	if (apiKey === null) {
		removeStorageItem(API_KEY_LOCAL_STORAGE_KEY)
		return
	}
	setStorageItem(API_KEY_LOCAL_STORAGE_KEY, apiKey)
}

const parseFetchedApiKey = (payload: unknown): string | null => {
	if (payload == null || typeof payload !== 'object') return null
	const apiKeyPayload = (payload as { apiKey?: unknown }).apiKey
	if (apiKeyPayload == null || typeof apiKeyPayload !== 'object') return null
	const value = (apiKeyPayload as { api_key?: unknown }).api_key
	return typeof value === 'string' && value.length > 0 ? value : null
}

const parseGeneratedApiKey = (payload: unknown): string | null => {
	if (payload == null || typeof payload !== 'object') return null
	const value = (payload as { apiKey?: unknown }).apiKey
	return typeof value === 'string' && value.length > 0 ? value : null
}

// A 404 is the only response that proves "no active subscription"; any other
// failure is unknown and must surface as an error, never render as Free.
async function fetchSubscription({ isAuthenticated }: { isAuthenticated: boolean }): Promise<Subscription> {
	if (!isAuthenticated) {
		return defaultInactiveSubscription
	}

	const response = await fetch(`${AUTH_SERVER}/subscription/status`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${pb.authStore.token}`
		}
	})

	if (response.status === 404) {
		return defaultInactiveSubscription
	}

	const normalized = await handleSimpleFetchResponse(response).catch((error) => {
		throw new Error(getErrorMessage(error, 'Failed to load subscription'))
	})
	const data: SubscriptionResponse = await normalized.json()
	return data.subscription
}

// Same contract: 404 means "no past-due subscription", anything else is unknown.
async function fetchPastDueSubscription({
	isAuthenticated
}: {
	isAuthenticated: boolean
}): Promise<Subscription | null> {
	if (!isAuthenticated) return null

	const response = await fetch(`${AUTH_SERVER}/subscription/past-due`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${pb.authStore.token}`
		}
	})

	if (response.status === 404) return null

	const normalized = await handleSimpleFetchResponse(response).catch((error) => {
		throw new Error(getErrorMessage(error, 'Failed to check payment status'))
	})
	const data: SubscriptionResponse = await normalized.json()
	return data.subscription ?? null
}

export const useSubscribe = () => {
	const router = useRouter()
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()!
	const queryClient = useQueryClient()

	const createSubscription = useMutation<SubscriptionCreateResponse, Error, SubscriptionRequest>({
		mutationFn: async (subscriptionData) => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const response = await authorizedFetch(
				`${AUTH_SERVER}/subscription/create`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(subscriptionData)
				},
				true
			)

			if (!response) {
				throw new Error('Not authenticated')
			}

			const normalizedResponse = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to create subscription'))
			})

			return normalizedResponse.json()
		}
	})

	const handleSubscribe = useCallback(
		async (
			paymentMethod: 'stripe' | 'llamapay',
			type: 'api' | 'llamafeed',
			onSuccess?: (checkoutUrl: string) => void,
			billingInterval: 'year' | 'month' = 'month',
			useEmbedded: boolean = false,
			isTrial: boolean = false
		) => {
			if (!isAuthenticated) {
				toast.error('Please sign in to subscribe')
				return
			}

			const subscriptionType = type || 'api'

			const subscriptionData: SubscriptionRequest = {
				redirectUrl: `${window.location.origin}/welcome`,
				cancelUrl: `${window.location.origin}/subscription?subscription=cancelled`,
				provider: paymentMethod,
				subscriptionType,
				billingInterval,
				isTrial,
				referralCode: getReferrer()
			}

			const result = await createSubscription.mutateAsync(subscriptionData).catch((error) => {
				console.log('Subscription error:', error)
				throw error
			})

			// For embedded mode, return the result instead of redirecting
			if (useEmbedded) {
				return result
			}

			// Navigate to checkout URL in same window
			if (result.checkoutUrl) {
				if (onSuccess) {
					onSuccess(result.checkoutUrl)
				}
				window.location.href = result.checkoutUrl
			}
		},
		[isAuthenticated, createSubscription]
	)

	const topupMutation = useMutation<void, Error, { type: 'api' | 'llamafeed'; billingInterval?: 'year' | 'month' }>({
		mutationFn: async ({ type, billingInterval = 'month' }) => {
			if (!isAuthenticated) {
				throw new Error('Please sign in to top up')
			}

			const topupData: SubscriptionRequest = {
				redirectUrl: `${window.location.origin}/account`,
				cancelUrl: `${window.location.origin}/account`,
				provider: 'llamapay',
				subscriptionType: type,
				billingInterval
			}

			const response = await authorizedFetch(
				`${AUTH_SERVER}/subscription/topup`,
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

			const result: SubscriptionCreateResponse = await handleSimpleFetchResponse(response)
				.then((res) => res.json())
				.catch((error) => {
					throw new Error(getErrorMessage(error, 'Failed to create top-up link'))
				})

			if (result?.checkoutUrl) {
				window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer')
			}
		},
		onError: (error) => {
			console.log('Top-up error:', error)
			toast.error(getErrorMessage(error, 'Failed to create top-up link'))
		}
	})

	const subscriptionQuery = useQuery({
		queryKey: ['subscription', user?.id],
		queryFn: () => fetchSubscription({ isAuthenticated }),
		retry: false,
		refetchOnWindowFocus: false,
		enabled: isAuthenticated,
		staleTime: 1000 * 60 * 15
	})

	const subscriptionData = subscriptionQuery?.data ?? null

	// A subscription can keep access (status active) while its latest payment failed
	// (metadata.isPastDue), so payment health is queried independently of access.
	const pastDueSubscriptionQuery = useQuery({
		queryKey: ['subscription', 'past-due', user?.id],
		queryFn: () => fetchPastDueSubscription({ isAuthenticated }),
		retry: false,
		refetchOnWindowFocus: false,
		enabled: isAuthenticated && router.pathname === '/account',
		staleTime: 1000 * 60 * 15
	})

	const apiSubscription = subscriptionData?.type === 'api' ? subscriptionData : defaultInactiveSubscription

	const llamafeedSubscription = subscriptionData?.type === 'llamafeed' ? subscriptionData : defaultInactiveSubscription

	useEffect(() => {
		if (subscriptionData?.status === 'active' && !user?.has_active_subscription) {
			void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
		}
	}, [subscriptionData?.status, user?.has_active_subscription, queryClient])

	const isSubscriptionLoading = subscriptionQuery.isLoading && subscriptionData == null
	const isSubscriptionError = subscriptionQuery.isError && !subscriptionData

	const trialAvailabilityQuery = useQuery({
		queryKey: ['subscription', 'trial-available', user?.id],
		queryFn: async (): Promise<{ trialAvailable: boolean }> => {
			// A failed read is unknown, not "no trial": throw so the query retries
			// and recovers instead of caching trialAvailable=false for 15 minutes.
			const response = await authorizedFetch(`${AUTH_SERVER}/subscription/trial-available`)
				.then(handleSimpleFetchResponse)
				.catch((error) => {
					throw new Error(getErrorMessage(error, 'Failed to check trial availability'))
				})
			return response.json()
		},
		enabled: isAuthenticated,
		staleTime: 1000 * 60 * 15,
		refetchOnWindowFocus: false
	})

	// Runs for the side effect: fetches the key and mirrors it into local storage,
	// which `apiKey` below subscribes to.
	useQuery({
		queryKey: ['subscription', 'api-key', user?.id],
		queryFn: async () => {
			const newApiKey = await authorizedFetch(`${AUTH_SERVER}/auth/get-api-key`)
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())
				.then(parseFetchedApiKey)
				.catch((error) => {
					throw new Error(getErrorMessage(error, 'Failed to fetch API key'))
				})

			syncApiKeyStorage(newApiKey)
			return newApiKey
		},
		staleTime: 24 * 60 * 60 * 1000, // 24 hours
		refetchOnWindowFocus: false,
		enabled: isAuthenticated && apiSubscription?.status === 'active' && router.pathname === '/account'
	})

	const generateNewKeyMutation = useMutation({
		mutationFn: async () => {
			const newApiKey = await authorizedFetch(`${AUTH_SERVER}/auth/generate-api-key`, {
				method: 'POST'
			})
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())
				.then(parseGeneratedApiKey)
				.catch((error) => {
					throw new Error(getErrorMessage(error, 'Failed to generate API key'))
				})

			syncApiKeyStorage(newApiKey)
			return newApiKey
		}
	})

	const apiKey = useStorageItem(API_KEY_LOCAL_STORAGE_KEY, null)

	const { data: credits } = useQuery<Credits>({
		queryKey: ['subscription', 'credits', user?.id, apiKey],
		queryFn: async () => {
			const data = await authorizedFetch(`${AUTH_SERVER}/user/credits`, {
				method: 'GET'
			})
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())

			return data
		},
		enabled: isAuthenticated && router.pathname === '/account',
		staleTime: 1000 * 60 * 5,
		refetchOnWindowFocus: false,
		retry: false
	})

	const usageStatsQuery = useQuery({
		queryKey: ['subscription', 'usage-stats', user?.id],
		queryFn: async () => {
			const response = await authorizedFetch(`${AUTH_SERVER}/user/usage-stats`, {
				method: 'GET'
			})

			if (!response) {
				return null
			}

			const data = await handleSimpleFetchResponse(response).then((res) => res.json())

			return data
		},
		enabled: isAuthenticated && apiSubscription?.status === 'active' && router.pathname === '/account',
		staleTime: 1000 * 60 * 5,
		refetchOnWindowFocus: false,
		retry: false
	})

	const createPortalSessionMutation = useMutation({
		mutationFn: async () => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const data = await authorizedFetch(
				`${AUTH_SERVER}/subscription/billing-portal`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						returnUrl: window.location.href
					})
				},
				true
			)
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())
				.catch((error) => {
					throw new Error(getErrorMessage(error, 'Failed to open the billing portal'))
				})

			if (!data?.url) {
				throw new Error('Failed to open the billing portal')
			}
			return data.url as string
		},
		onError: (error) => {
			console.log('Failed to create portal session:', error)
			toast.error(getErrorMessage(error, 'Failed to open the billing portal. Please try again.'))
		}
	})

	// Navigation helper on top of the mutation: opening the portal always redirects.
	const createPortalSessionAsync = createPortalSessionMutation.mutateAsync
	const createPortalSession = useCallback(async () => {
		try {
			const url = await createPortalSessionAsync()
			window.location.href = url
			return url
		} catch {
			// The mutation's onError already surfaced the failure.
			return null
		}
	}, [createPortalSessionAsync])

	const endTrialMutation = useMutation({
		mutationFn: async () => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const response = await authorizedFetch(`${AUTH_SERVER}/subscription/end-trial`, {
				method: 'POST'
			})

			if (!response) {
				throw new Error('Not authenticated')
			}

			const normalizedResponse = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to end trial subscription'))
			})

			return normalizedResponse.json()
		},
		onSuccess: async () => {
			// The modal that runs this mutation shows the success state itself.
			await queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
			await queryClient.invalidateQueries({ queryKey: ['subscription'] })
		},
		onError: (error) => {
			console.log('End trial subscription error:', error)
		}
	})

	const enableOverageMutation = useMutation({
		mutationFn: async () => {
			if (!isAuthenticated) {
				throw new Error('Please sign in to enable overage')
			}

			if (apiSubscription.status !== 'active') {
				throw new Error('No active API subscription found')
			}

			const data = await authorizedFetch(
				`${AUTH_SERVER}/subscription/enable-overage`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				},
				true
			)
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())

			return data
		},
		onSuccess: () => {
			// The toggle reflects the new state after the refetch; errors render inline next to it.
			void queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
		},
		onError: (error) => {
			console.log('Failed to enable overage:', error)
		}
	})

	const disableOverageMutation = useMutation({
		mutationFn: async () => {
			if (!isAuthenticated) {
				throw new Error('Please sign in to disable overage')
			}

			if (apiSubscription.status !== 'active') {
				throw new Error('No active API subscription found')
			}

			const data = await authorizedFetch(
				`${AUTH_SERVER}/subscription/disable-overage`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				},
				true
			)
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())

			return data
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
		},
		onError: (error) => {
			console.log('Failed to disable overage:', error)
		}
	})

	const cancelSubscriptionMutation = useMutation<
		{ message?: string; cancelled_immediately?: boolean; cancel_at_period_end?: boolean },
		Error,
		string | undefined
	>({
		mutationFn: async (message?: string) => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const response = await authorizedFetch(
				`${AUTH_SERVER}/subscription/cancel`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ message })
				},
				true
			)

			if (!response) {
				throw new Error('Not authenticated')
			}

			const normalizedResponse = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to cancel subscription'))
			})

			return normalizedResponse.json()
		},
		onSuccess: (data) => {
			// The modal that runs this mutation shows the scheduled/immediate result itself.
			if (data?.cancelled_immediately) {
				void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
			}
			void queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
			void queryClient.invalidateQueries({ queryKey: ['subscription', 'past-due', user?.id] })
		},
		onError: (error) => {
			console.log('Cancel subscription error:', error)
		}
	})

	return {
		handleSubscribe,
		topupMutation,
		subscription: subscriptionData ?? defaultInactiveSubscription,
		hasActiveSubscription: subscriptionData?.status === 'active',
		// Which checkout button is in flight, derived from the mutations themselves
		loading: createSubscription.isPending
			? createSubscription.variables?.provider === 'llamapay'
				? ('llamapay' as const)
				: ('stripe' as const)
			: topupMutation.isPending
				? ('llamapay' as const)
				: null,
		isSubscriptionLoading,
		isSubscriptionError,
		isSubscriptionRetrying: subscriptionQuery.isFetching,
		refetchSubscription: subscriptionQuery.refetch,
		isPastDueError: pastDueSubscriptionQuery.isError && pastDueSubscriptionQuery.data == null,
		refetchPastDueSubscription: pastDueSubscriptionQuery.refetch,
		apiKey,
		generateNewKeyMutation,
		credits: credits?.credits,
		createPortalSession,
		createPortalSessionMutation,
		endTrialMutation,
		enableOverageMutation,
		disableOverageMutation,
		cancelSubscriptionMutation,
		apiSubscription: apiSubscription,
		llamafeedSubscription: llamafeedSubscription,
		isTrialAvailable: isAuthenticated ? (trialAvailabilityQuery.data?.trialAvailable ?? false) : true,
		usageStats: usageStatsQuery.data ?? null,
		isUsageStatsLoading: usageStatsQuery.isLoading,
		isUsageStatsError: usageStatsQuery.isError,
		pastDueSubscription: pastDueSubscriptionQuery.data ?? null
	}
}
