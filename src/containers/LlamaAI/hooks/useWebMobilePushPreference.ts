import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { getAuthStoreSnapshot } from '~/auth/authStore'
import {
	getWebMobilePushStatus,
	setWebMobilePushEnabled,
	type WebMobilePushStatus
} from '~/containers/LlamaAI/api/mobilePush'
import { queryReadFailed, type QueryRetry } from '~/utils/query'

export type WebMobilePreference =
	| { kind: 'signed-out' }
	| { kind: 'loading' }
	| { kind: 'error'; retry: QueryRetry }
	| { kind: 'known'; available: boolean; enabled: boolean }

export function isWebMobileToggleVisible(
	preference: WebMobilePreference
): preference is { kind: 'known'; available: true; enabled: boolean } {
	return preference.kind === 'known' && preference.available
}

export function isWebMobilePushEnabled(preference: WebMobilePreference): boolean {
	return preference.kind === 'known' && preference.enabled
}

interface MutationLease {
	userId: string | null
}

export interface WebMobilePushEnabledMutation {
	mutateAsync: (enabled: boolean) => Promise<WebMobilePushStatus>
	isPending: boolean
	error: Error | null
}

export const WEB_MOBILE_PUSH_QUERY_KEY = ['llama-ai-web-mobile-push'] as const
export const WEB_MOBILE_PUSH_SYNC_STORAGE_KEY = 'llama-ai:web-mobile-push-status'

function readSyncedStatus(value: string | null): { userId: string; status: WebMobilePushStatus } | null {
	if (!value) return null
	try {
		const parsed = JSON.parse(value) as Record<string, unknown>
		const status = parsed.status as Record<string, unknown> | undefined
		if (
			typeof parsed.userId !== 'string' ||
			!status ||
			typeof status.available !== 'boolean' ||
			typeof status.enabled !== 'boolean'
		) {
			return null
		}
		return { userId: parsed.userId, status: { available: status.available, enabled: status.enabled } }
	} catch {
		return null
	}
}

function broadcastStatus(userId: string, status: WebMobilePushStatus) {
	try {
		window.localStorage.setItem(
			WEB_MOBILE_PUSH_SYNC_STORAGE_KEY,
			JSON.stringify({ userId, status, eventId: `${Date.now()}:${Math.random()}` })
		)
	} catch {
		// Storage can be unavailable in private or restricted browsing contexts.
	}
}

export function useWebMobilePushPreference() {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()
	const queryClient = useQueryClient()
	const userId = user?.id ?? null
	const currentUserIdRef = useRef(userId)
	// Written after commit rather than during render: a render-phase ref write costs the hook its
	// compiler optimization, and the mutation callbacks that read it run well after commit.
	useLayoutEffect(() => {
		currentUserIdRef.current = userId
	})
	const queryKey = [...WEB_MOBILE_PUSH_QUERY_KEY, userId] as const

	const statusQuery = useQuery({
		queryKey,
		queryFn: ({ signal }) => getWebMobilePushStatus(authorizedFetch, signal),
		enabled: isAuthenticated && !!userId,
		staleTime: 60_000,
		refetchOnWindowFocus: 'always'
	})

	const setEnabled = useMutation<WebMobilePushStatus, Error, boolean, MutationLease>({
		mutationFn: (enabled) => setWebMobilePushEnabled(authorizedFetch, enabled),
		onMutate: () => ({ userId }),
		onSuccess: async (status, _enabled, lease) => {
			if (!lease.userId || currentUserIdRef.current !== lease.userId || !getAuthStoreSnapshot().isValid) return
			const requestQueryKey = [...WEB_MOBILE_PUSH_QUERY_KEY, lease.userId] as const
			await queryClient.cancelQueries({ queryKey: requestQueryKey })
			if (currentUserIdRef.current !== lease.userId || !getAuthStoreSnapshot().isValid) return
			queryClient.setQueryData(requestQueryKey, status)
			broadcastStatus(lease.userId, status)
		},
		onError: (_error, _enabled, lease) => {
			if (!lease?.userId || currentUserIdRef.current !== lease.userId || !getAuthStoreSnapshot().isValid) return
			void queryClient.invalidateQueries({ queryKey: [...WEB_MOBILE_PUSH_QUERY_KEY, lease.userId] })
		}
	})

	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== WEB_MOBILE_PUSH_SYNC_STORAGE_KEY) return
			const synced = readSyncedStatus(event.newValue)
			if (!synced || synced.userId !== userId) return
			const syncedQueryKey = [...WEB_MOBILE_PUSH_QUERY_KEY, synced.userId] as const
			void queryClient.cancelQueries({ queryKey: syncedQueryKey }).then(() => {
				if (currentUserIdRef.current !== synced.userId) return
				queryClient.setQueryData(syncedQueryKey, synced.status)
			})
		}
		window.addEventListener('storage', handleStorage)
		return () => window.removeEventListener('storage', handleStorage)
	}, [queryClient, userId])

	let preference: WebMobilePreference
	if (!isAuthenticated || !userId) {
		preference = { kind: 'signed-out' }
	} else if (queryReadFailed(statusQuery)) {
		// Read isFetching here so the query re-renders this hook when the retry starts (React Query tracks read props).
		preference = { kind: 'error', retry: { refetch: statusQuery.refetch, isFetching: statusQuery.isFetching } }
	} else if (!statusQuery.data) {
		preference = { kind: 'loading' }
	} else {
		preference = {
			kind: 'known',
			available: statusQuery.data.available,
			enabled: statusQuery.data.enabled
		}
	}

	return { preference, setEnabled }
}
