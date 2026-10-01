import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { useQuery } from '@tanstack/react-query'
import { getDuckDB } from './duckdb'

export type DuckDBStatus = 'loading' | 'ready' | 'error'

export interface UseDuckDBResult {
	conn: AsyncDuckDBConnection | null
	status: DuckDBStatus
	error: string | null
}

// One engine per page: the handle never goes stale or leaves the cache. A failed load loads again the next time
// a SQL surface mounts (getDuckDB forgets a failed attempt), not in a retry loop that would hold the error back.
const duckDBQuery = {
	queryKey: ['duckdb'],
	queryFn: getDuckDB,
	staleTime: Infinity,
	gcTime: Infinity,
	retry: false
} as const

export function useDuckDB(): UseDuckDBResult {
	const { data, error } = useQuery(duckDBQuery)
	return {
		conn: data?.conn ?? null,
		status: error ? 'error' : data ? 'ready' : 'loading',
		error: error ? error.message : null
	}
}
