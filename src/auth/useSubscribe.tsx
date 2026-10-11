import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { getReferrer } from '~/auth/referrer'
import { subscriptionStatusQueryOptions, type Subscription } from '~/auth/subscriptionStatus'
import { AUTH_SERVER } from '~/constants'
import { holdEndTrial } from '~/containers/Account/endTrialHold'
import { scheduleConfirmationReads } from '~/containers/Account/utils'
import { handleSimpleFetchResponse, HttpError, httpErrorMessage, ReaderError } from '~/utils/async'
import pb from '~/utils/pocketbase'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'

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

export type { Subscription } from '~/auth/subscriptionStatus'

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

const OVERAGE_UNCONFIRMED = "We couldn't confirm the change. The switch shows your current setting."
const CANCEL_UNCONFIRMED = "We couldn't confirm the cancellation. Check your plan before trying again."

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
		throw new Error(httpErrorMessage(error, "Couldn't check the payment status."))
	})
	const data: SubscriptionResponse = await normalized.json()
	return data.subscription ?? null
}

export const useSubscribe = () => {
	const router = useRouter()
	const { user, isAuthenticated, authToken, authorizedFetch } = useAuthContext()!
	const queryClient = useQueryClient()
	const subscriptionUserId = isAuthenticated ? (user?.id ?? null) : null
	const subscriptionToken = isAuthenticated ? authToken : null
	const subscriptionQueryConfig = useMemo(
		() => subscriptionStatusQueryOptions({ userId: subscriptionUserId, token: subscriptionToken }),
		[subscriptionUserId, subscriptionToken]
	)

	const createSubscription = useMutation<SubscriptionCreateResponse, Error, SubscriptionRequest>({
		mutationFn: async (subscriptionData) => {
			if (!isAuthenticated) throw new Error('Sign in to subscribe.')

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
			).catch(() => {
				throw new Error("Couldn't create the subscription.")
			})

			if (!response) throw new Error('Sign in to subscribe.')

			return handleSimpleFetchResponse(response)
				.then((res) => res.json())
				.catch((error) => {
					throw new Error(httpErrorMessage(error, "Couldn't create the subscription."))
				})
		}
	})

	const handleSubscribe = useCallback(
		async (paymentMethod: 'stripe' | 'llamapay', type: 'api' | 'llamafeed', billingInterval: 'year' | 'month') => {
			if (!isAuthenticated) {
				toast.error('Sign in to subscribe')
				return
			}

			const result = await createSubscription.mutateAsync({
				redirectUrl: `${window.location.origin}/welcome`,
				cancelUrl: `${window.location.origin}/subscription?subscription=cancelled`,
				provider: paymentMethod,
				subscriptionType: type,
				billingInterval,
				isTrial: false,
				referralCode: getReferrer()
			})

			// Navigate to checkout URL in same window
			if (result.checkoutUrl) window.location.href = result.checkoutUrl
		},
		[isAuthenticated, createSubscription]
	)

	const topupMutation = useMutation<void, Error, { type: 'api' | 'llamafeed'; billingInterval?: 'year' | 'month' }>({
		mutationFn: async ({ type, billingInterval = 'month' }) => {
			if (!isAuthenticated) {
				throw new ReaderError('Sign in to top up.')
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
				throw new ReaderError("You're signed out. Sign in and try again.")
			}

			const result: SubscriptionCreateResponse = await handleSimpleFetchResponse(response).then((res) => res.json())

			// Same tab, like subscribing: a new tab opened after these awaits is no longer a user gesture, and Safari blocks
			// it without telling the page. LlamaPay returns to the account page.
			if (result?.checkoutUrl) window.location.href = result.checkoutUrl
		},
		onError: (error) => {
			console.log('Top-up error:', error)
			toast.error(httpErrorMessage(error, "Couldn't create the top-up link."))
		}
	})

	const subscriptionQuery = useQuery(subscriptionQueryConfig)

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

	// Attempt times keep a failure, not a loading state, on screen while its retry runs. Billing state from before a
	// failed refetch may predate a change the reader just made (a cancellation), so any failed read is an error here.
	const isSubscriptionError =
		isAuthenticated && (queryReadFailed(subscriptionQuery) || queryRefreshFailed(subscriptionQuery))
	const isSubscriptionLoading = isAuthenticated && subscriptionQuery.data === undefined && !isSubscriptionError

	const trialAvailabilityQuery = useQuery({
		queryKey: ['subscription', 'trial-available', user?.id],
		queryFn: async (): Promise<{ trialAvailable: boolean }> => {
			// A failed read is unknown, not "no trial": throw so the query retries
			// and recovers instead of caching trialAvailable=false for 15 minutes.
			const response = await authorizedFetch(`${AUTH_SERVER}/subscription/trial-available`)
				.then(handleSimpleFetchResponse)
				.catch((error) => {
					throw new Error(httpErrorMessage(error, "Couldn't check trial availability."))
				})
			return response.json()
		},
		enabled: isAuthenticated,
		staleTime: 1000 * 60 * 15,
		refetchOnWindowFocus: false
	})

	// The key lives only in this account's query cache, so a response that lands after logout or an
	// account switch can never show up for someone else.
	const apiKeyQueryKey = ['subscription', 'api-key', user?.id]
	const { data: apiKey = null } = useQuery({
		queryKey: apiKeyQueryKey,
		queryFn: () =>
			authorizedFetch(`${AUTH_SERVER}/auth/get-api-key`)
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())
				.then(parseFetchedApiKey)
				.catch((error) => {
					throw new Error(httpErrorMessage(error, "Couldn't load your API key."))
				}),
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
					// A 4xx reason stays an HttpError so ApiAccessCard's confirm dialog shows it too.
					throw error instanceof HttpError && error.reason ? error : new Error("Couldn't generate an API key.")
				})

			queryClient.setQueryData(apiKeyQueryKey, newApiKey)
			return newApiKey
		}
	})

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

			// The usage chart anchors its window to when the stats arrived, so render never reads the clock.
			return data ? { ...data, fetchedAt: Date.now() } : null
		},
		enabled: isAuthenticated && apiSubscription?.status === 'active' && router.pathname === '/account',
		staleTime: 1000 * 60 * 5,
		refetchOnWindowFocus: false,
		retry: false
	})

	const createPortalSessionMutation = useMutation({
		mutationFn: async () => {
			if (!isAuthenticated) {
				throw new ReaderError("You're signed out. Sign in and try again.")
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

			// No url falls to onError's own line.
			if (!data?.url) throw new Error('Billing portal returned no url')
			return data.url as string
		},
		onError: (error) => {
			console.log('Failed to create portal session:', error)
			toast.error(httpErrorMessage(error, "Couldn't open the billing portal. Try again."))
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
			if (!isAuthenticated || !user) {
				throw new Error("You're signed out. Sign in and try again.")
			}
			// Ending a trial charges the card at once. Any answer that may have charged holds the button for the account
			// that clicked: a success, and a lost response or a 5xx whose outcome is unknown. Only the server's refusal
			// (4xx) leaves it free to try again. Written here, not in onSuccess, which sees whoever is signed in by then.
			const accountId = user.id
			const unconfirmed = () => {
				holdEndTrial(accountId)
				return new Error("We couldn't confirm the upgrade, so it may still go through. Check your plan in a minute.")
			}

			const response = await authorizedFetch(`${AUTH_SERVER}/subscription/end-trial`, {
				method: 'POST'
			}).catch(() => {
				throw unconfirmed()
			})

			if (!response) {
				throw new Error("You're signed out. Sign in and try again.")
			}
			if (response.status >= 500) throw unconfirmed()

			const normalizedResponse = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(httpErrorMessage(error, "Couldn't end the trial subscription."))
			})
			holdEndTrial(accountId)
			return normalizedResponse.json()
		},
		// Hook-level, so the re-reads survive the dialog unmounting mid-request. The webhook clears the trial after the
		// request returns, so both trial signals are re-read a few times, after an unknown outcome too.
		// The modal that runs this mutation shows the success state itself.
		onSettled: () => {
			scheduleConfirmationReads(queryClient, ['auth', 'status'])
			scheduleConfirmationReads(queryClient, ['subscription'])
		},
		onError: (error) => {
			console.log('End trial subscription error:', error)
		}
	})

	const setOverageMutation = useMutation({
		mutationFn: async (enabled: boolean) => {
			if (!isAuthenticated) throw new Error('Sign in to change extra usage charges')
			if (apiSubscription.status !== 'active') throw new Error('No active API subscription found')

			const response = await authorizedFetch(
				`${AUTH_SERVER}/subscription/${enabled ? 'enable' : 'disable'}-overage`,
				{ method: 'POST', headers: { 'Content-Type': 'application/json' } },
				true
			).catch(() => {
				throw new Error(OVERAGE_UNCONFIRMED)
			})
			if (!response) throw new Error('Sign in to change extra usage charges')
			// A 5xx, like a lost response, can come after the server applied the change.
			if (response.status >= 500) throw new Error(OVERAGE_UNCONFIRMED)
			await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(httpErrorMessage(error, `Couldn't ${enabled ? 'enable' : 'disable'} extra usage charges.`))
			})
		},
		// Returned, so the switch stays locked until the refetch shows the setting the server now holds. A failure is
		// read again too: a lost response may still have changed it.
		onSettled: () => queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
	})

	const cancelSubscriptionMutation = useMutation<
		{ message?: string; cancelled_immediately?: boolean; cancel_at_period_end?: boolean },
		Error,
		string | undefined
	>({
		mutationFn: async (message?: string) => {
			if (!isAuthenticated) {
				throw new Error("You're signed out. Sign in and try again.")
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
			).catch(() => {
				throw new Error(CANCEL_UNCONFIRMED)
			})

			if (!response) {
				throw new Error("You're signed out. Sign in and try again.")
			}
			// A 5xx, like a lost response, can come after the server cancelled. A cancel that went through stays
			// cancelled, so trying again is safe; the plan is read again either way.
			if (response.status >= 500) throw new Error(CANCEL_UNCONFIRMED)

			const normalizedResponse = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(httpErrorMessage(error, "Couldn't cancel the subscription."))
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
			scheduleConfirmationReads(queryClient, ['subscription'])
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
		// No past-due subscription (null) is what a failed check cannot confirm: the notice exists so a failure never
		// reads as "no payment problems".
		isPastDueError:
			queryReadFailed(pastDueSubscriptionQuery) ||
			(pastDueSubscriptionQuery.data === null && queryRefreshFailed(pastDueSubscriptionQuery)),
		isPastDueRetrying: pastDueSubscriptionQuery.isFetching,
		refetchPastDueSubscription: pastDueSubscriptionQuery.refetch,
		apiKey,
		generateNewKeyMutation,
		credits: credits?.credits,
		createPortalSession,
		createPortalSessionMutation,
		endTrialMutation,
		setOverageMutation,
		cancelSubscriptionMutation,
		apiSubscription,
		llamafeedSubscription,
		isTrialAvailable: isAuthenticated ? (trialAvailabilityQuery.data?.trialAvailable ?? false) : true,
		usageStatsQuery,
		pastDueSubscription: pastDueSubscriptionQuery.data ?? null
	}
}
