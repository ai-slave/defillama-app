import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { useQuery } from '@tanstack/react-query'
import { type QueryRetry, queryReadFailed } from '~/utils/query'
import { getDuckDB } from './duckdb'

export type UseDuckDBResult =
	| { status: 'loading'; conn: null }
	| { status: 'ready'; conn: AsyncDuckDBConnection }
	/** The error stays through `retry`, so the notice and its waiting Try again stay on screen until the engine loads. */
	| { status: 'error'; conn: null; retry: QueryRetry }

export type DuckDBStatus = UseDuckDBResult['status']

// One engine per page: the handle never goes stale or leaves the cache. A failed load loads again from the error's
// Try again, or the next time a SQL surface mounts (getDuckDB forgets a failed attempt), not in a retry loop that
// would hold the error back.
const duckDBQuery = {
	queryKey: ['duckdb'],
	queryFn: getDuckDB,
	staleTime: Infinity,
	gcTime: Infinity,
	retry: false
} as const

export function useDuckDB(): UseDuckDBResult {
	const query = useQuery(duckDBQuery)
	if (queryReadFailed(query)) {
		return { status: 'error', conn: null, retry: { refetch: query.refetch, isFetching: query.isFetching } }
	}
	if (query.data) return { status: 'ready', conn: query.data.conn }
	return { status: 'loading', conn: null }
}
