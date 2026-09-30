import type { ProtocolRankingsCanonicalSnapshot } from './server/tableData.server'

/**
 * Publication gate for protocol ranking snapshots.
 *
 * Every adapter fetch inside getProtocolsByChain swallows its own failure, so
 * a fees or DEX outage produces a complete-looking result with the affected
 * columns null. Because snapshots are pinned (55-minute pointer, 4-hour
 * blob), publishing such a result locks the degradation in for every reader.
 * A snapshot that fails these checks must never be written and must never
 * advance the `:latest` pointer — the previous snapshot keeps serving until a
 * healthy build succeeds.
 *
 * Checks compare what was EXPECTED against what arrived: emptiness and
 * missing-source checks catch total failures, the ratio guard catches partial
 * ones (a protocols list that silently lost a third of its rows), and the
 * expected-source checks catch the silent-adapter-failure case specifically.
 *
 * There is deliberately no TVL check: TVL arrives in the same protocols
 * response as the rows (whose failure throws), and chain metadata keeps
 * dimension-only chains visible, so a snapshot with no TVL is real data.
 */

/** Reject a rebuild whose row count fell below this fraction of the previous snapshot's. */
const MIN_PREVIOUS_ROW_RATIO = 0.7

export class ProtocolRankingSnapshotValidationError extends Error {
	constructor(
		message: string,
		readonly check: string
	) {
		super(message)
		this.name = 'ProtocolRankingSnapshotValidationError'
	}
}

export function assertPublishableSnapshot(
	snapshot: ProtocolRankingsCanonicalSnapshot,
	context: {
		/** From getProtocolRankingSourceOptions — whether this chain should have DEX data. */
		expectDexs: boolean
		/** From getProtocolRankingSourceOptions — whether this chain should have perps data. */
		expectPerps: boolean
		/** Row count of the last published snapshot, when one is available to compare against. */
		previousProtocolCount?: number | null
	}
): void {
	const fail = (check: string, message: string) => {
		throw new ProtocolRankingSnapshotValidationError(`${snapshot.chain}: ${message}`, check)
	}

	if (snapshot.protocols.length === 0) {
		fail('protocols-empty', 'snapshot has no protocols')
	}
	const previous = context.previousProtocolCount
	if (previous != null && previous > 0 && snapshot.protocols.length < previous * MIN_PREVIOUS_ROW_RATIO) {
		fail(
			'protocols-dropped',
			`protocol count dropped from ${previous} to ${snapshot.protocols.length} (floor ${MIN_PREVIOUS_ROW_RATIO})`
		)
	}
	if (context.expectDexs && !snapshot.source.dexs) {
		fail('dexs-missing', 'chain expects DEX data but the snapshot has none')
	}
	if (context.expectPerps && !snapshot.source.perps) {
		fail('perps-missing', 'chain expects perps data but the snapshot has none')
	}
	if (snapshot.source.chains.length === 0) {
		fail('chains-empty', 'snapshot has no chain list')
	}
}
