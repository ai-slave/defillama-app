/** Typed Markets reads and pure lookups over the current immutable snapshot. */
import type { MasterDirectoryResponse } from '~/containers/Exchanges/master.types'
import type { TokenMarketsListResponse, TokenMarketSummary } from '~/containers/Markets/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { acquireDatasetSnapshot } from '~/server/datasetSnapshots/refresh.server'
import type { DatasetSnapshotHandle } from '~/server/datasetSnapshots/store'
import {
	hasTokenMarketsGeckoId,
	resolveExchangeByDefillamaCexSlug as resolveExchangeByDefillamaCexSlugFromIndex,
	type CexExchangeSlugIndex,
	type CexExchangeSlugIndexEntry,
	type TokenMarketsGeckoIdIndex
} from './dataset.index'

const MARKET_FILES = DATASET_SNAPSHOT_CONTRACT.markets.files

// Each export serves one response and reads every artifact it needs from this one handle.
async function acquireMarketsSnapshot(): Promise<DatasetSnapshotHandle> {
	return (await acquireDatasetSnapshot('markets', 'blocking')).handle
}

export async function fetchExchangeDirectory(): Promise<MasterDirectoryResponse> {
	return (await acquireMarketsSnapshot()).readJson<MasterDirectoryResponse>(MARKET_FILES.exchangeDirectory)
}

export async function fetchTokenMarketsList(): Promise<TokenMarketsListResponse> {
	return (await acquireMarketsSnapshot()).readJson<TokenMarketsListResponse>(MARKET_FILES.tokensList)
}

export async function fetchCexExchangeSlugIndex(): Promise<CexExchangeSlugIndex> {
	return (await acquireMarketsSnapshot()).readJson<CexExchangeSlugIndex>(MARKET_FILES.cexByDefillamaSlug)
}

export async function resolveExchangeByDefillamaCexSlug(
	defillamaSlug: string
): Promise<CexExchangeSlugIndexEntry | null> {
	const index = await fetchCexExchangeSlugIndex()
	return resolveExchangeByDefillamaCexSlugFromIndex(index, defillamaSlug)
}

export type TokenMarkets = {
	summary: TokenMarketSummary | null
	hasMarkets: boolean
}

export async function getTokenMarkets(geckoId: string): Promise<TokenMarkets> {
	const snapshot = await acquireMarketsSnapshot()
	const [summaries, geckoIds] = await Promise.all([
		snapshot.readJson<Record<string, TokenMarketSummary>>(MARKET_FILES.tokenSummaries),
		snapshot.readJson<TokenMarketsGeckoIdIndex>(MARKET_FILES.tokenGeckoIds)
	])
	return {
		summary: summaries[geckoId.toLowerCase()] ?? null,
		hasMarkets: hasTokenMarketsGeckoId(geckoIds, geckoId)
	}
}
