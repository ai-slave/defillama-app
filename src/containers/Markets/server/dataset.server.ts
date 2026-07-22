/** Typed Markets reads and pure lookups over the current immutable snapshot. */
import type { MasterDirectoryResponse } from '~/containers/Exchanges/master.types'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import {
	hasTokenMarketsGeckoId,
	resolveExchangeByDefillamaCexSlug as resolveExchangeByDefillamaCexSlugFromIndex,
	type CexExchangeSlugIndex,
	type CexExchangeSlugIndexEntry,
	type TokenMarketsGeckoIdIndex
} from './dataset.index'

const MARKET_FILES = DATASET_SNAPSHOT_CONTRACT.markets.files

export function fetchExchangeDirectory(): Promise<MasterDirectoryResponse> {
	return datasetSnapshotReader.readJson<MasterDirectoryResponse>('markets', MARKET_FILES.exchangeDirectory)
}

export function fetchTokenMarketsList(): Promise<TokenMarketsListResponse> {
	return datasetSnapshotReader.readJson<TokenMarketsListResponse>('markets', MARKET_FILES.tokensList)
}

function fetchTokenMarketsGeckoIdIndex(): Promise<TokenMarketsGeckoIdIndex> {
	return datasetSnapshotReader.readJson<TokenMarketsGeckoIdIndex>('markets', MARKET_FILES.tokenGeckoIds)
}

export function fetchCexExchangeSlugIndex(): Promise<CexExchangeSlugIndex> {
	return datasetSnapshotReader.readJson<CexExchangeSlugIndex>('markets', MARKET_FILES.cexByDefillamaSlug)
}

export async function resolveExchangeByDefillamaCexSlug(
	defillamaSlug: string
): Promise<CexExchangeSlugIndexEntry | null> {
	const index = await fetchCexExchangeSlugIndex()
	return resolveExchangeByDefillamaCexSlugFromIndex(index, defillamaSlug)
}

export async function hasTokenMarkets(geckoId: string): Promise<boolean> {
	const index = await fetchTokenMarketsGeckoIdIndex()
	return hasTokenMarketsGeckoId(index, geckoId)
}
