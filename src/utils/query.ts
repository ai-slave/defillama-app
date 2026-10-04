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
