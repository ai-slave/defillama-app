/** Typed Markets reads and pure lookups over the current immutable snapshot. */
import type { ExchangeMarketsListResponse, TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import {
	hasTokenMarketsSymbol,
	resolveCexMarketsBySlug,
	resolveMarketsExchangeFromList,
	type CexMarketsSlugIndex,
	type CexMarketsSlugIndexEntry,
	type TokenMarketsSymbolIndex
} from './dataset.index'

const MARKET_FILES = DATASET_SNAPSHOT_CONTRACT.markets.files

export function fetchExchangeMarketsList(): Promise<ExchangeMarketsListResponse> {
	return datasetSnapshotReader.readJson<ExchangeMarketsListResponse>('markets', MARKET_FILES.exchangesList)
}

export function fetchTokenMarketsList(): Promise<TokenMarketsListResponse> {
	return datasetSnapshotReader.readJson<TokenMarketsListResponse>('markets', MARKET_FILES.tokensList)
}

function fetchTokenMarketsSymbolIndex(): Promise<TokenMarketsSymbolIndex> {
	return datasetSnapshotReader.readJson<TokenMarketsSymbolIndex>('markets', MARKET_FILES.tokenSymbols)
}

function fetchCexMarketsSlugIndex(): Promise<CexMarketsSlugIndex> {
	return datasetSnapshotReader.readJson<CexMarketsSlugIndex>('markets', MARKET_FILES.cexByDefillamaSlug)
}

export async function resolveCexMarketsByDefillamaSlug(
	defillamaSlug: string
): Promise<CexMarketsSlugIndexEntry | null> {
	const index = await fetchCexMarketsSlugIndex()
	return resolveCexMarketsBySlug(index, defillamaSlug)
}

export async function resolveMarketsExchangeByParam(exchange: string): Promise<string | null> {
	return resolveMarketsExchangeFromList(exchange, await fetchExchangeMarketsList())
}

export async function hasTokenMarkets(symbol: string): Promise<boolean> {
	const index = await fetchTokenMarketsSymbolIndex()
	return hasTokenMarketsSymbol(index, symbol)
}
