/** Typed Markets reads and pure lookups over the current immutable snapshot. */
import type { MasterDirectoryResponse } from '~/containers/Exchanges/master.types'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import {
	hasTokenMarketsSymbol,
	resolveExchangeByDefillamaCexSlug as resolveExchangeByDefillamaCexSlugFromIndex,
	type CexExchangeSlugIndex,
	type CexExchangeSlugIndexEntry,
	type TokenMarketsSymbolIndex
} from './dataset.index'

const MARKET_FILES = DATASET_SNAPSHOT_CONTRACT.markets.files

export function fetchExchangeDirectory(): Promise<MasterDirectoryResponse> {
	return datasetSnapshotReader.readJson<MasterDirectoryResponse>('markets', MARKET_FILES.exchangeDirectory)
}

export function fetchTokenMarketsList(): Promise<TokenMarketsListResponse> {
	return datasetSnapshotReader.readJson<TokenMarketsListResponse>('markets', MARKET_FILES.tokensList)
}

function fetchTokenMarketsSymbolIndex(): Promise<TokenMarketsSymbolIndex> {
	return datasetSnapshotReader.readJson<TokenMarketsSymbolIndex>('markets', MARKET_FILES.tokenSymbols)
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

export async function hasTokenMarkets(symbol: string): Promise<boolean> {
	const index = await fetchTokenMarketsSymbolIndex()
	return hasTokenMarketsSymbol(index, symbol)
}
