import { createHash } from 'node:crypto'
import { cachedResult, type CachedResultOptions } from '~/server/api/resultCache'

/**
 * The expensive step of serving a table page: filter + sort the snapshot's
 * rows for one canonical query. It runs once per (domain, version, signature)
 * and every page of that combination is then a slice — see offsetPage.server.ts
 * and cursorPage.server.ts.
 *
 * The prepared payload is usually a row array, but a surface may carry
 * derived aggregates of the same preparation alongside it (e.g. Yields'
 * median APY over the filtered set) — hence the generic Prepared type.
 *
 * Namespace convention: `table-pages:<surface>:prepared-rows` for
 * new surfaces; pre-kernel namespaces keep their historical strings.
 */

/** Compact hash of a query signature, embedded in cursors and cache keys. */
export function hashTableQuerySignature(signature: string): string {
	return createHash('sha256').update(signature).digest('base64url').slice(0, 22)
}

export function prepareTableRows<Prepared>({
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
	/** Canonical query signature (defineTableQuery().signature or canonicalQuerySignature). */
	signature: string
	memory: CachedResultOptions
	prepare: () => Prepared | Promise<Prepared>
	measureBytes?: (prepared: Prepared) => number
}): Promise<Prepared> {
	return cachedResult(
		namespace,
		`${domain}:${version}:${signature}`,
		memory,
		async () => prepare(),
		measureBytes ?? (() => 0)
	)
}
