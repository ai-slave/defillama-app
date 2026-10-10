import type { QueryObserverResult } from '@tanstack/react-query'

/** A read that a Try again reruns and waits on: any query result, or a caller's run over several queries. */
export interface QueryRetry {
	refetch: () => unknown
	isFetching: boolean
}

type ReadState = { data?: unknown } & Pick<
	QueryObserverResult,
	'isPlaceholderData' | 'errorUpdatedAt' | 'dataUpdatedAt'
>

// The attempt times outlive a retry: a retry from an error with no data moves the query back to pending, which clears
// `isError`, `isLoadingError` and `error` while it runs, but the last failure stays newer than the last success.
function lastAttemptFailed(query: ReadState) {
	return query.errorUpdatedAt > query.dataUpdatedAt
}

/** The read has nothing to show and its last attempt failed: render the error in place of the content. It stays true
    while a Try again runs, so the error and its waiting button stay on screen; check it before loading. Data from an
    earlier success (server-rendered initialData included) is something to show; a placeholder (the previous page of a
    pager) is not. */
export function queryReadFailed(query: ReadState) {
	return (query.data === undefined || query.isPlaceholderData) && lastAttemptFailed(query)
}

/** The read is showing data from an earlier success and its latest refetch failed: keep the data on screen and add a
    quiet notice with a Try again (ProCardRefreshFailed on a dashboard card), never the error in its place. */
export function queryRefreshFailed(query: ReadState) {
	return query.data !== undefined && !query.isPlaceholderData && lastAttemptFailed(query)
}

/** One Try again for a chart drawn from several reads: each entry is a read that failed, or null. It reruns the
    failed ones and waits while any of them runs; null when none failed. */
export function mergeFailedReads(reads: Array<QueryRetry | null>): QueryRetry | null {
	const failed = reads.filter((read) => read != null)
	if (failed.length === 0) return null
	return {
		refetch: () => {
			for (const read of failed) void read.refetch()
		},
		isFetching: failed.some((read) => read.isFetching)
	}
}
