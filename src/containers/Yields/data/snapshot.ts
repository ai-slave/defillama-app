import { YIELDS_SNAPSHOT_FILES } from './snapshot.contract'
import type {
	BorrowMarketRow,
	DepegRow,
	EarnRow,
	LoopRow,
	RouteRow,
	TokenKeys,
	Trend,
	VerifiedRow,
	YieldsMeta
} from './types'

/** Storage-neutral view of one pinned Yields generation, passed through server transforms. */
export interface YieldsSnapshot {
	/** Immutable generation identity — keys per-generation caches (e.g. prepared table rows). */
	readonly generationId: string
	/** When the generation was built — dates ISR-seeded data so client staleness is honest. */
	readonly generatedAt: number
	readJson<T>(relativePath: string): Promise<T>
}

// The handle memoizes each artifact, so the raw rows array identifies the generation. The
// enrich.server.ts caches compare earn arrays by reference, so the join must be stable per generation.
const joinedEarn = new WeakMap<Array<EarnRow>, Array<EarnRow>>()
const verifiedEarnIds = new WeakMap<Array<EarnRow>, Set<string>>()

/** Earn rows with the measured block joined on by pool id, so `row.verified` stays the feature flag. */
export async function readEarn(snapshot: YieldsSnapshot): Promise<Array<EarnRow>> {
	const [rows, verified] = await Promise.all([
		snapshot.readJson<Array<EarnRow>>(YIELDS_SNAPSHOT_FILES.earn),
		snapshot.readJson<Array<VerifiedRow>>(YIELDS_SNAPSHOT_FILES.earnVerified)
	])
	if (!Array.isArray(verified) || verified.length === 0) return rows
	let joined = joinedEarn.get(rows)
	if (!joined) {
		const byId = new Map(verified.map(({ id, ...block }) => [id, block]))
		// Unmeasured rows pass through by reference.
		joined = rows.map((row) => {
			const block = byId.get(row.id)
			return block ? { ...row, verified: block } : row
		})
		joinedEarn.set(rows, joined)
	}
	return joined
}

/** Cheap membership lookup after the generation's earn/verified join has been memoized. */
export async function hasVerifiedEarnPool(snapshot: YieldsSnapshot, id: string): Promise<boolean> {
	const rows = await readEarn(snapshot)
	let ids = verifiedEarnIds.get(rows)
	if (!ids) {
		ids = new Set(rows.flatMap((row) => (row.verified != null ? [row.id] : [])))
		verifiedEarnIds.set(rows, ids)
	}
	return ids.has(id)
}

export function readTrends(snapshot: YieldsSnapshot): Promise<Array<Trend>> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.trends)
}

export function readBorrowMarkets(snapshot: YieldsSnapshot): Promise<Array<BorrowMarketRow>> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.borrowMarkets)
}

export function readBorrowRoutes(snapshot: YieldsSnapshot): Promise<Array<RouteRow>> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.borrowRoutes)
}

export function readLoops(snapshot: YieldsSnapshot): Promise<Array<LoopRow>> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.loops)
}

export function readTokenKeys(snapshot: YieldsSnapshot): Promise<Array<TokenKeys>> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.tokenKeys)
}

export function readYieldsMeta(snapshot: YieldsSnapshot): Promise<YieldsMeta> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.meta)
}

export function readYieldsDepegs(snapshot: YieldsSnapshot): Promise<Array<DepegRow>> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.depegs)
}

export function readYieldsExploits(snapshot: YieldsSnapshot): Promise<Array<string>> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.exploits)
}
