import type { ParsedUrlQuery } from 'querystring'
import { fetchCoinGeckoTokensListFromDataset } from '~/api/coingecko'
import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchTokenMarketsList } from '~/containers/Markets/server/dataset'
import { fetchTokenRightsEntries } from '~/containers/TokenRights/server/dataset'
import type { ITokenRightsData } from '~/containers/TokenRights/types'
import {
	formatFeeSwitchStatus,
	getTokenRightsPrimaryValueLabel,
	parseTokenRightsEntry
} from '~/containers/TokenRights/utils'
import { getAllProtocolEmissions } from '~/containers/Unlocks/queries'
import { cachedResult } from '~/server/api/resultCache'
import { slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { getCanonicalTokenRoute, type TokenDirectoryRecord } from '~/utils/tokenDirectory'
import type {
	TokensRawAdapterChainMetrics,
	TokensRawCoinGeckoMarket,
	TokensRawMarketsList,
	TokensRawProtocolEmission,
	TokensRawTokenRightsEntry
} from './api.types'
import type {
	TokensPageResponse,
	TokensPageStats,
	TokensRightsSummary,
	TokensSortIndexes,
	TokensSourceRow
} from './types'
import { buildTokensSortIndexes, getTokensPageFromRows } from './utils'

const TOKENS_SOURCE_TTL_MS = 5 * 60 * 1000
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

type AdapterProtocolMetric = TokensRawAdapterChainMetrics['protocols'][number]

interface TokensSourceData {
	rows: TokensSourceRow[]
	sortIndexes: TokensSortIndexes
	stats: TokensPageStats
	updatedAt: string | null
}

interface TokenDirectoryIndexes {
	byGeckoId: Map<string, TokenDirectoryRecord>
	protocolIdByGeckoId: Map<string, string>
}

interface TokenUnlockMetrics {
	unlockedPercent: number | null
	unlock30dUsd: number | null
	upcomingUnlockUsd: number | null
}

const EMPTY_MARKETS_LIST: TokensRawMarketsList = {
	last_updated: '',
	tokens: []
}

function tokenRecordGeckoId(record: TokenDirectoryRecord): string | null {
	if (!record.token_nk?.startsWith('coingecko:')) return null
	const geckoId = record.token_nk.slice('coingecko:'.length).toLowerCase()
	return geckoId || null
}

function buildTokenDirectoryIndexes(metadata: MetadataCache): TokenDirectoryIndexes {
	const byGeckoId = new Map<string, TokenDirectoryRecord>()
	const protocolIdByGeckoId = new Map<string, string>()

	for (const key in metadata.tokenDirectory) {
		const record = metadata.tokenDirectory[key]
		const geckoId = tokenRecordGeckoId(record)
		if (geckoId && !byGeckoId.has(geckoId)) byGeckoId.set(geckoId, record)
	}

	for (const protocolId in metadata.protocolMetadata) {
		const geckoId = metadata.protocolMetadata[protocolId].gecko_id?.toLowerCase()
		if (geckoId && !protocolIdByGeckoId.has(geckoId)) protocolIdByGeckoId.set(geckoId, protocolId)
	}

	return { byGeckoId, protocolIdByGeckoId }
}

function buildMetricMap(rows: AdapterProtocolMetric[]): Map<string, number> {
	const map = new Map<string, number>()
	for (const row of rows) {
		map.set(row.defillamaId, row.total24h)
	}
	return map
}

function buildUniqueTokenSymbols(tokens: TokensRawCoinGeckoMarket[]): Set<string> {
	const counts = new Map<string, number>()
	for (const token of tokens) {
		const symbol = token.symbol.toUpperCase()
		counts.set(symbol, (counts.get(symbol) ?? 0) + 1)
	}

	const uniqueSymbols = new Set<string>()
	for (const [symbol, count] of counts) {
		if (count === 1) uniqueSymbols.add(symbol)
	}
	return uniqueSymbols
}

function buildMarketsMap(
	markets: TokensRawMarketsList,
	uniqueTokenSymbols: Set<string>
): Map<string, TokensRawMarketsList['tokens'][number]> {
	const map = new Map<string, TokensRawMarketsList['tokens'][number]>()
	for (const entry of markets.tokens) {
		const symbol = entry.symbol.toUpperCase()
		// The markets dataset is symbol-keyed, so duplicate CoinGecko symbols would otherwise inherit each other's metrics.
		if (uniqueTokenSymbols.has(symbol)) map.set(symbol, entry)
	}
	return map
}

function getRightsPieGradient(rights: {
	treasury: boolean
	revenue: boolean
	burns: boolean
	dividends: boolean
	buybacks: boolean
	governance: boolean
}): string {
	const activeColor = 'var(--success)'
	const inactiveColor = 'var(--error)'
	return `conic-gradient(${rights.treasury ? activeColor : inactiveColor} 0deg 60deg, ${rights.revenue ? activeColor : inactiveColor} 60deg 120deg, ${rights.burns ? activeColor : inactiveColor} 120deg 180deg, ${rights.dividends ? activeColor : inactiveColor} 180deg 240deg, ${rights.buybacks ? activeColor : inactiveColor} 240deg 300deg, ${rights.governance ? activeColor : inactiveColor} 300deg 360deg)`
}

function getTokenRightsSummary(parsed: ITokenRightsData): TokensRightsSummary {
	const treasury = parsed.decisions.treasury.displayTokens.length > 0
	const revenue = parsed.decisions.revenue.displayTokens.length > 0
	const burns = parsed.valueAccrual.burns.isActive
	const dividends = parsed.valueAccrual.dividends.displayTokens.length > 0
	const buybacks = parsed.valueAccrual.buybacks.displayTokens.length > 0
	const structuralDistribution = dividends || buybacks
	const governance = parsed.governance.decisionTokenDisplay.displayTokens.length > 0

	return {
		pieGradient: getRightsPieGradient({
			treasury,
			revenue,
			burns,
			dividends: structuralDistribution,
			buybacks: structuralDistribution,
			governance
		}),
		protocolName: parsed.overview.protocolName,
		identityTokens: parsed.overview.identityTokens,
		utilityItems: parsed.overview.utilityItems,
		primaryValue: getTokenRightsPrimaryValueLabel(parsed.valueAccrual.primary),
		primaryDetails: parsed.valueAccrual.details,
		governance,
		governanceTokens: parsed.governance.decisionTokenDisplay.displayTokens,
		treasury,
		treasuryTokens: parsed.decisions.treasury.displayTokens,
		revenue,
		revenueTokens: parsed.decisions.revenue.displayTokens,
		feeSwitchStatus: formatFeeSwitchStatus(parsed.economic.feeSwitchStatus),
		buybacks,
		buybackTokens: parsed.valueAccrual.buybacks.displayTokens,
		dividends,
		dividendTokens: parsed.valueAccrual.dividends.displayTokens,
		burns,
		burnsStatus: parsed.valueAccrual.burns.status || 'None',
		equityRevenueCapture: parsed.alignment.equityRevenueCapture ?? 'Unknown',
		fundraisingLabel: parsed.alignment.fundraisingLabel,
		associatedEntities: parsed.alignment.associatedEntities
	}
}

function buildTokenRightsMap(entries: TokensRawTokenRightsEntry[]): Map<string, TokensRightsSummary> {
	const map = new Map<string, TokensRightsSummary>()
	for (const entry of entries) {
		const parsed = parseTokenRightsEntry(entry)
		map.set(entry['DefiLlama ID'], getTokenRightsSummary(parsed))
	}
	return map
}

function buildUnlocksMap(rows: TokensRawProtocolEmission[], nowSec: number): Map<string, TokenUnlockMetrics> {
	const map = new Map<string, TokenUnlockMetrics>()
	const endSec = nowSec + THIRTY_DAYS_SECONDS

	for (const row of rows) {
		if (!row.gecko_id) continue
		const price = row.tPrice ?? null
		let unlock30dUsd = 0
		let upcomingUnlockUsd = 0

		if (price != null) {
			for (const event of row.events ?? []) {
				if (event.timestamp < nowSec || event.timestamp > endSec) continue
				for (const amount of event.noOfTokens) unlock30dUsd += amount * price
			}

			for (const event of row.upcomingEvent ?? []) {
				if (event.timestamp == null) continue
				for (const amount of event.noOfTokens) upcomingUnlockUsd += amount * price
			}
		}

		const unlockedPercent = row.maxSupply
			? Math.max(0, Math.min(100, 100 - ((row.totalLocked ?? 0) / row.maxSupply) * 100))
			: null
		map.set(row.gecko_id.toLowerCase(), {
			unlockedPercent,
			unlock30dUsd: unlock30dUsd > 0 ? unlock30dUsd : null,
			upcomingUnlockUsd: upcomingUnlockUsd > 0 ? upcomingUnlockUsd : null
		})
	}

	return map
}

function resolveProtocolId(
	geckoId: string,
	record: TokenDirectoryRecord | undefined,
	indexes: TokenDirectoryIndexes
): string | null {
	return record?.protocolId ?? indexes.protocolIdByGeckoId.get(geckoId) ?? null
}

function resolveTokenRightsSummary(
	record: TokenDirectoryRecord | undefined,
	protocolId: string | null,
	rightsByDefillamaId: Map<string, TokensRightsSummary>
): TokensRightsSummary | null {
	if (record?.chainId) {
		const rights = rightsByDefillamaId.get(record.chainId)
		if (rights) return rights
	}
	if (record?.protocolId) {
		const rights = rightsByDefillamaId.get(record.protocolId)
		if (rights) return rights
	}
	return protocolId ? (rightsByDefillamaId.get(protocolId) ?? null) : null
}

function resolveEmissionsProtocolSlug(
	record: TokenDirectoryRecord | undefined,
	protocolId: string | null,
	protocolMetadata: MetadataCache['protocolMetadata'][string] | undefined,
	metadata: MetadataCache
): string | null {
	const candidates = [
		protocolId?.replace(/^parent#/, ''),
		protocolMetadata?.name,
		protocolMetadata?.displayName,
		record?.chainId
	]

	for (const candidate of candidates) {
		const candidateSlug = slug(candidate)
		if (candidateSlug && metadata.emissionsSupplyMetrics[candidateSlug]) return candidateSlug
	}

	return null
}

function sumSegments(
	entry: TokensRawMarketsList['tokens'][number] | undefined,
	key: 'volume_24h' | 'oi_usd'
): number | null {
	if (!entry) return null
	let total = 0
	let hasValue = false
	const linear = entry.segments.linear_perp?.[key]
	const inverse = entry.segments.inverse_perp?.[key]
	if (linear != null) {
		total += linear
		hasValue = true
	}
	if (inverse != null) {
		total += inverse
		hasValue = true
	}
	return hasValue ? total : null
}

function getSearchKey(token: TokensRawCoinGeckoMarket, record: TokenDirectoryRecord | undefined): string {
	return `${token.id} ${token.name} ${token.symbol} ${record?.name ?? ''} ${record?.symbol ?? ''}`.toLowerCase()
}

function addStats(stats: TokensPageStats, row: TokensSourceRow): void {
	stats.totalMarketCap += row.marketCap ?? 0
	stats.spotVolume24h += row.spotVolume24h ?? 0
	stats.perpsVolume24h += row.perpsVolume24h ?? 0
	stats.openInterest24h += row.openInterest24h ?? 0
	stats.unlock30dUsd += row.unlock30dUsd ?? 0
	stats.upcomingUnlockUsd += row.upcomingUnlockUsd ?? 0
}

function getUnlockedPercentFromSupplyMetrics(
	metadata: MetadataCache,
	emissionsProtocolSlug: string | null,
	adjustedSupply: number | null
): number | null {
	if (emissionsProtocolSlug == null || adjustedSupply == null) return null
	const maxSupply = metadata.emissionsSupplyMetrics[emissionsProtocolSlug]?.supplyMetrics.maxSupply
	if (!maxSupply) return null
	return Math.max(0, Math.min(100, (adjustedSupply / maxSupply) * 100))
}

function firstUpdatedAt(tokens: TokensRawCoinGeckoMarket[], markets: TokensRawMarketsList): string | null {
	if (markets.last_updated) return markets.last_updated
	for (const token of tokens) {
		if (token.last_updated) return token.last_updated
	}
	return null
}

export async function fetchTokensSourceRows(): Promise<TokensSourceData> {
	const nowSec = Math.floor(Date.now() / 1000)
	const metadataModule = await import('~/utils/metadata')
	metadataModule.refreshMetadataInBackgroundIfStale('tokens')
	const metadata = metadataModule.default

	const [tokens, markets, tokenRightsEntries, fees, revenue, holdersRevenue, unlocks] = await Promise.all([
		fetchCoinGeckoTokensListFromDataset(),
		fetchTokenMarketsList().catch(() => EMPTY_MARKETS_LIST),
		fetchTokenRightsEntries().catch(() => []),
		fetchAdapterChainMetrics({ adapterType: ADAPTER_TYPES.FEES, chain: 'All' })
			.then((data) => data.protocols)
			.catch(() => []),
		fetchAdapterChainMetrics({
			adapterType: ADAPTER_TYPES.FEES,
			chain: 'All',
			dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
		})
			.then((data) => data.protocols)
			.catch(() => []),
		fetchAdapterChainMetrics({
			adapterType: ADAPTER_TYPES.FEES,
			chain: 'All',
			dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
		})
			.then((data) => data.protocols)
			.catch(() => []),
		getAllProtocolEmissions({
			endDate: nowSec + THIRTY_DAYS_SECONDS,
			getHistoricalPrices: false,
			tokenlist: metadata.tokenlist
		}).catch(() => [])
	])

	return buildTokensSourceRows({
		tokens,
		markets,
		tokenRightsEntries,
		fees,
		revenue,
		holdersRevenue,
		unlocks: unlocks as TokensRawProtocolEmission[],
		metadata,
		nowSec
	})
}

export function buildTokensSourceRows({
	tokens,
	markets,
	tokenRightsEntries,
	fees,
	revenue,
	holdersRevenue,
	unlocks,
	metadata,
	nowSec
}: {
	tokens: TokensRawCoinGeckoMarket[]
	markets: TokensRawMarketsList
	tokenRightsEntries: TokensRawTokenRightsEntry[]
	fees: AdapterProtocolMetric[]
	revenue: AdapterProtocolMetric[]
	holdersRevenue: AdapterProtocolMetric[]
	unlocks: TokensRawProtocolEmission[]
	metadata: MetadataCache
	nowSec: number
}): TokensSourceData {
	const indexes = buildTokenDirectoryIndexes(metadata)
	const marketsBySymbol = buildMarketsMap(markets, buildUniqueTokenSymbols(tokens))
	const rightsByDefillamaId = buildTokenRightsMap(tokenRightsEntries)
	const feeByDefillamaId = buildMetricMap(fees)
	const revenueByDefillamaId = buildMetricMap(revenue)
	const holdersRevenueByDefillamaId = buildMetricMap(holdersRevenue)
	const unlocksByGeckoId = buildUnlocksMap(unlocks, nowSec)
	const rows: TokensSourceRow[] = []
	const stats: TokensPageStats = {
		totalMarketCap: 0,
		marketCapWeightedChange24h: null,
		spotVolume24h: 0,
		perpsVolume24h: 0,
		openInterest24h: 0,
		unlock30dUsd: 0,
		upcomingUnlockUsd: 0
	}
	let weightedChangeMarketCap = 0
	let weightedChangeNumerator = 0

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index]
		const geckoId = token.id.toLowerCase()
		const record = indexes.byGeckoId.get(geckoId)
		const protocolId = resolveProtocolId(geckoId, record, indexes)
		const protocolMetadata = protocolId ? metadata.protocolMetadata[protocolId] : undefined
		const marketsEntry = marketsBySymbol.get(token.symbol.toUpperCase())
		const revenue24h = protocolId ? (revenueByDefillamaId.get(protocolId) ?? null) : null
		const holdersRevenue24h = protocolId ? (holdersRevenueByDefillamaId.get(protocolId) ?? null) : null
		const emissionsProtocolSlug = resolveEmissionsProtocolSlug(record, protocolId, protocolMetadata, metadata)
		const adjustedSupply = emissionsProtocolSlug
			? (metadata.emissionsSupplyMetrics[emissionsProtocolSlug]?.supplyMetrics.adjustedSupply ?? null)
			: null
		const unlockMetrics = unlocksByGeckoId.get(geckoId)
		const spotVolume24h = marketsEntry?.segments.spot?.volume_24h ?? null
		const perpsVolume24h = sumSegments(marketsEntry, 'volume_24h')
		const openInterest24h = sumSegments(marketsEntry, 'oi_usd')
		const row: TokensSourceRow = {
			id: token.id,
			rank: token.market_cap_rank_with_rehypothecated ?? token.market_cap_rank ?? index + 1,
			name: token.name,
			symbol: token.symbol.toUpperCase(),
			logo: record?.logo ?? geckoTokenIconUrl(token.id),
			href: record ? getCanonicalTokenRoute(record) : null,
			price: token.current_price ?? marketsEntry?.segments.spot?.price ?? null,
			priceChange1h: token.price_change_percentage_1h_in_currency ?? null,
			priceChange24h: token.price_change_percentage_24h_in_currency ?? token.price_change_percentage_24h ?? null,
			priceChange7d: token.price_change_percentage_7d_in_currency ?? null,
			priceChange30d: token.price_change_percentage_30d_in_currency ?? null,
			marketCap: token.market_cap ?? null,
			fdv: token.fully_diluted_valuation ?? null,
			outstandingFdv:
				adjustedSupply != null && token.current_price != null ? adjustedSupply * token.current_price : null,
			unlockedPercent:
				unlockMetrics?.unlockedPercent ??
				getUnlockedPercentFromSupplyMetrics(metadata, emissionsProtocolSlug, adjustedSupply),
			spotVolume24h,
			perpsVolume24h,
			openInterest24h,
			fees24h: protocolId ? (feeByDefillamaId.get(protocolId) ?? null) : null,
			revenue24h,
			holdersRevenue24h,
			trsPercent:
				revenue24h != null && revenue24h > 0 && holdersRevenue24h != null
					? (holdersRevenue24h / revenue24h) * 100
					: null,
			rights: resolveTokenRightsSummary(record, protocolId, rightsByDefillamaId),
			unlock30dUsd: unlockMetrics?.unlock30dUsd ?? null,
			upcomingUnlockUsd: unlockMetrics?.upcomingUnlockUsd ?? null,
			searchKey: getSearchKey(token, record)
		}
		addStats(stats, row)
		if (row.marketCap != null && row.priceChange24h != null) {
			weightedChangeMarketCap += row.marketCap
			weightedChangeNumerator += row.marketCap * row.priceChange24h
		}
		rows.push(row)
	}

	if (weightedChangeMarketCap > 0) stats.marketCapWeightedChange24h = weightedChangeNumerator / weightedChangeMarketCap

	return {
		rows,
		sortIndexes: buildTokensSortIndexes(rows),
		stats,
		updatedAt: firstUpdatedAt(tokens, markets)
	}
}

export async function getTokensSourceData(): Promise<TokensSourceData> {
	return cachedResult(
		'tokens-source-rows',
		'v5',
		{
			ttlMs: TOKENS_SOURCE_TTL_MS,
			ttlJitter: 0.2,
			staleWhileRevalidateMs: 30 * 60 * 1000
		},
		fetchTokensSourceRows
	)
}

export async function getTokensPageData(query: ParsedUrlQuery = {}): Promise<TokensPageResponse> {
	const data = await getTokensSourceData()
	return getTokensPageFromRows(data.rows, data.sortIndexes, query, {
		stats: data.stats,
		updatedAt: data.updatedAt
	})
}
