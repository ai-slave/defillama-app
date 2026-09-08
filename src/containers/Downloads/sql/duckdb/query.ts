import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { Table } from 'apache-arrow'

const pendingQueries = new WeakMap<AsyncDuckDBConnection, Promise<void>>()

export function queryDuckDB(conn: AsyncDuckDBConnection, sql: string, signal?: AbortSignal): Promise<Table> {
	// One connection has one pending result. Preserve query()'s serialization while send() yields
	// to cancellation; another tab or schema operation must not replace the active result.
	const previous = pendingQueries.get(conn) ?? Promise.resolve()
	const result = previous.then(async () => {
		signal?.throwIfAborted()
		if (!signal) return conn.query(sql)
		const cancel = () => {
			void conn.cancelSent().catch(() => undefined)
		}
		signal.addEventListener('abort', cancel, { once: true })
		try {
			// query() blocks the worker; only send() yields to cancelSent(). Collect the full result.
			const reader = await conn.send(sql, false)
			const batches = await reader.readAll()
			signal.throwIfAborted()
			return new Table(reader.schema, batches)
		} finally {
			signal.removeEventListener('abort', cancel)
		}
	})
	const done = result.then(
		() => {},
		() => {}
	)
	pendingQueries.set(conn, done)
	void done.then(() => {
		if (pendingQueries.get(conn) === done) pendingQueries.delete(conn)
	})
	return result
}
