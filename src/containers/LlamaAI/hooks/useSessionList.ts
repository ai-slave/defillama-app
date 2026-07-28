import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import {
	flattenSessionListData,
	mapSessionListPage,
	mergeOptimisticSessions,
	moveSessionToTopInInfiniteData,
	SESSIONS_QUERY_KEY,
	type SessionListData,
	type SessionListInfiniteData,
	type SessionListPage,
	type SessionListResponse
} from '~/containers/LlamaAI/hooks/sessionListCache'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { handleSimpleFetchResponse } from '~/utils/async'

export { SESSIONS_QUERY_KEY }
export type { SessionListData, SessionListInfiniteData }

const AWAITING_TITLE_MAX_AGE_MS = 10 * 60 * 1000

function isAwaitingTitle(session: ChatSession): boolean {
	if (!session.titleIsPlaceholder) return false
	const lastActivity = Date.parse(session.lastActivity)
	return Number.isFinite(lastActivity) && Date.now() - lastActivity < AWAITING_TITLE_MAX_AGE_MS
}

export function useSessionList() {
	const { user, authorizedFetch, isAuthenticated } = useAuthContext()
	const queryClient = useQueryClient()

	const {
		data: queryData,
		isLoading,
		error: queryError,
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
		fetchNextPage
	} = useInfiniteQuery<SessionListPage, Error, SessionListInfiniteData, [string, string | undefined], number>({
		queryKey: [SESSIONS_QUERY_KEY, user?.id],
		queryFn: async ({ pageParam }) => {
			try {
				if (!user) return { sessions: [], usage: null, factCheckedUsage: null, alertsUsage: null, hasMore: false }
				const responseData = (await authorizedFetch(`${AI_SERVER}/user/sessions?offset=${pageParam}`)
					.then((response) => assertResponse(response, 'Failed to fetch sessions'))
					.then(handleSimpleFetchResponse)
					.then((res) => res.json())) as SessionListResponse

				const page = mapSessionListPage(responseData)
				if (pageParam !== 0) return page

				const existingData = queryClient.getQueryData<SessionListInfiniteData>([SESSIONS_QUERY_KEY, user.id])
				return mergeOptimisticSessions(page, existingData)
			} catch (error) {
				console.log('Failed to fetch sessions:', error)
				throw new Error(`Failed to fetch sessions: ${error instanceof Error ? error.message : String(error)}`)
			}
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
		enabled: isAuthenticated && !!user,
		refetchOnWindowFocus: true,
		staleTime: 10000,
		refetchInterval: (query) => {
			const sessions = query.state.data?.pages.flatMap((page) => page.sessions) ?? []
			return sessions.some(isAwaitingTitle) ? 15000 : false
		}
	})

	const data = useMemo(() => flattenSessionListData(queryData), [queryData])

	const moveSessionToTop = useCallback(
		(sessionId: string) => {
			if (!user) return

			queryClient.setQueryData([SESSIONS_QUERY_KEY, user.id], (old: SessionListInfiniteData | undefined) =>
				moveSessionToTopInInfiniteData(old, sessionId, new Date().toISOString())
			)
		},
		[user, queryClient]
	)

	return {
		sessions: data.sessions,
		researchUsage: data.usage,
		factCheckedUsage: data.factCheckedUsage,
		alertsUsage: data.alertsUsage,
		isLoading,
		error: !isFetchNextPageError && queryError instanceof Error ? queryError.message : null,
		hasNextPage,
		isFetchingNextPage,
		loadMoreSessionsError: isFetchNextPageError && queryError instanceof Error ? queryError.message : null,
		fetchNextPage,
		moveSessionToTop
	}
}
