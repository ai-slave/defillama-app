import { YIELDS_SNAPSHOT_FILES } from './snapshot.contract'
import type { BorrowMarketRow, DepegRow, EarnRow, LoopRow, RouteRow, TokenKeys, Trend, YieldsMeta } from './types'

/** Storage-neutral view of one pinned Yields generation, passed through server transforms. */
export interface YieldsSnapshot {
	/** Immutable generation identity — keys per-generation caches (e.g. prepared table rows). */
	readonly generationId: string
	/** When the generation was built — dates ISR-seeded data so client staleness is honest. */
	readonly generatedAt: number
	readJson<T>(relativePath: string): Promise<T>
}

export function readEarn(snapshot: YieldsSnapshot): Promise<EarnRow[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.earn)
}

export function readTrends(snapshot: YieldsSnapshot): Promise<Trend[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.trends)
}

export function readBorrowMarkets(snapshot: YieldsSnapshot): Promise<BorrowMarketRow[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.borrowMarkets)
}

export function readBorrowRoutes(snapshot: YieldsSnapshot): Promise<RouteRow[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.borrowRoutes)
}

export function readLoops(snapshot: YieldsSnapshot): Promise<LoopRow[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.loops)
}

export function readTokenKeys(snapshot: YieldsSnapshot): Promise<TokenKeys[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.tokenKeys)
}

export function readYieldsMeta(snapshot: YieldsSnapshot): Promise<YieldsMeta> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.meta)
}

export function readYieldsDepegs(snapshot: YieldsSnapshot): Promise<DepegRow[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.depegs)
}

export function readYieldsExploits(snapshot: YieldsSnapshot): Promise<string[]> {
	return snapshot.readJson(YIELDS_SNAPSHOT_FILES.exploits)
}
