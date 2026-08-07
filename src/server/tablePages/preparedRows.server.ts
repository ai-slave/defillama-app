import { createHash } from 'node:crypto'
import { cachedResult, type CachedResultOptions } from '~/server/api/resultCache'

/**
 * The expensive step of serving a table page: filter + sort the snapshot's
 * rows for one canonical query. It runs once per (domain, version, signature)
 * and every page of that combination is then a slice — see offsetPage.server.ts
 * and cursorPage.server.ts.
 *
 * Namespace convention (plan D4): `table-pages:<surface>:prepared-rows` for
 * new surfaces; pre-kernel namespaces keep their historical strings.
 */

/** Compact hash of a query signature, embedded in cursors and cache keys. */
export function hashTableQuerySignature(signature: string): string {
	return createHash('sha256').update(signature).digest('base64url').slice(0, 22)
}

export function prepareTableRows<Row>({
	namespace,
	domain,
	version,
	signature,
	memory,
	prepare,
	measureBytes
}: {
	namespace: string
	/** Partition within the surface, e.g. a chain slug. Use a constant for unpartitioned datasets. */
	domain: string
	/** The immutable dataset version the rows come from. */
	version: string
	/** Canonical query signature from defineTableQuery().signature. */
	signature: string
	memory: CachedResultOptions
	prepare: () => Row[] | Promise<Row[]>
	measureBytes?: (rows: Row[]) => number
}): Promise<Row[]> {
	return cachedResult(
		namespace,
		`${domain}:${version}:${signature}`,
		memory,
		async () => prepare(),
		measureBytes ?? (() => 0)
	)
}
