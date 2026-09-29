import { queryOptions } from '@tanstack/react-query'
import { AUTH_SERVER } from '~/constants'
import { handleSimpleFetchResponse } from '~/utils/async'

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

interface PersistedSubscriptionStatus {
	userId: string
	value: Subscription | null
	updatedAt: number
}

const SUBSCRIPTION_STATUS_STORAGE_PREFIX = 'subscription-status:'

export const subscriptionStatusQueryKey = (userId: string | null) => ['subscription', userId] as const

const subscriptionStatusStorageKey = (userId: string) => `${SUBSCRIPTION_STATUS_STORAGE_PREFIX}${userId}`

function readPersistedSubscriptionStatus(userId: string | null): PersistedSubscriptionStatus | null {
	if (!userId || typeof window === 'undefined') return null

	try {
		const raw = localStorage.getItem(subscriptionStatusStorageKey(userId))
		if (!raw) return null
		const stored = JSON.parse(raw) as PersistedSubscriptionStatus
		if (stored.userId !== userId || typeof stored.updatedAt !== 'number') return null
		return stored
	} catch {
		return null
	}
}

function persistSubscriptionStatus(userId: string, value: Subscription | null) {
	if (typeof window === 'undefined') return

	try {
		localStorage.setItem(
			subscriptionStatusStorageKey(userId),
			JSON.stringify({ userId, value, updatedAt: Date.now() } satisfies PersistedSubscriptionStatus)
		)
	} catch {
		// Storage can be unavailable or full; the feature degrades silently.
	}
}

export function clearPersistedSubscriptionStatus(userId: string | null | undefined) {
	if (!userId || typeof window === 'undefined') return

	try {
		localStorage.removeItem(subscriptionStatusStorageKey(userId))
	} catch {
		// Storage can be unavailable or full; the feature degrades silently.
	}
}

export async function fetchSubscriptionStatus({
	token,
	signal,
	subscriptionType
}: {
	token: string
	signal?: AbortSignal
	/** Reads that plan's record. Without it the server returns the first active plan, whichever that is. */
	subscriptionType?: string
}): Promise<Subscription | null> {
	const response = await fetch(`${AUTH_SERVER}/subscription/status`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		...(subscriptionType ? { body: JSON.stringify({ subscriptionType }) } : {}),
		signal
	})

	if (response.status === 404) return null

	const normalized = await handleSimpleFetchResponse(response).catch((error) => {
		throw new Error(error instanceof Error && error.message ? error.message : 'Failed to load subscription')
	})
	const data: SubscriptionResponse = await normalized.json()
	if (data.subscription.status !== 'active') {
		throw new Error('Subscription status returned an unexpected inactive subscription')
	}
	return data.subscription
}

export function subscriptionStatusQueryOptions({ userId, token }: { userId: string | null; token: string | null }) {
	const persisted = readPersistedSubscriptionStatus(userId)

	return queryOptions({
		queryKey: subscriptionStatusQueryKey(userId),
		queryFn: async ({ signal }) => {
			if (!userId || !token) throw new Error('Missing subscription session')
			const subscription = await fetchSubscriptionStatus({ token, signal })
			if (signal.aborted) throw new DOMException('Subscription request aborted', 'AbortError')
			persistSubscriptionStatus(userId, subscription)
			return subscription
		},
		enabled: userId != null && token != null,
		initialData: persisted?.value,
		initialDataUpdatedAt: 0,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(250 * 2 ** attemptIndex, 5000),
		refetchInterval: (query) => (query.state.status === 'error' ? 30_000 : false),
		refetchOnWindowFocus: false,
		staleTime: 1000 * 60 * 15
	})
}
