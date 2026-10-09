import type { QueryObserverResult } from '@tanstack/react-query'

/** A read that a Try again reruns and waits on: any query result, or a caller's run over several queries. */
export interface QueryRetry {
	refetch: () => unknown
	isFetching: boolean
}

/** Whether a query's last attempt failed. A retry from an error with no data moves the query back to pending, which
    clears `isError` and `error` while it runs; the attempt times keep the failure until an attempt succeeds, so the
    error and its waiting Try again stay on screen. Check it before loading. */
export function queryReadFailed(query: Pick<QueryObserverResult, 'errorUpdatedAt' | 'dataUpdatedAt'>) {
	return query.errorUpdatedAt > query.dataUpdatedAt
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
