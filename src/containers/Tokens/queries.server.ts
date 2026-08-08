import type { ParsedUrlQuery } from 'querystring'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { fetchStablecoinAssetsApi } from '~/containers/Stablecoins/api'
import type { TokenOverviewCurrentMetrics } from '~/containers/Token/tokenOverview'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import { fetchTokenRightsEntries } from '~/containers/TokenRights/server/dataset.server'
import type { ITokenRightsData } from '~/containers/TokenRights/types'
import {
	formatFeeSwitchStatus,
	getEquityPieTone,
	getTokenRightsPrimaryValueLabel,
	parseTokenRightsEntry
} from '~/containers/TokenRights/utils'
import { getAllProtocolEmissions } from '~/containers/Unlocks/queries'
import { cachedResult } from '~/server/api/resultCache'
import { slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { getCanonicalTokenRoute, type TokenDirectoryRecord } from '~/utils/tokenDirectory'
import type { TokensRawProtocolEmission } from './api.types'
import { TOKENS_SOURCE_CACHE_TTL_MS } from './cache.server'
import {
	buildMarketsMap,
	buildTokenDirectoryIndexes,
	buildUniqueTokenSymbols,
	resolveEmissionsProtocolSlug,
	resolveProtocolId
} from './readModel'
import { getTokensMarketSnapshot, type TokensMarketSnapshot } from './server/tableData.server'
import type {
	TokenMarketSummary,
	TokensChartDataset,
	TokensPageResponse,
	TokensPageStats,
	TokensRightsSummary,
	TokensSortIndexes,
	TokensSourceRow
} from './types'
import { TOKENS_CHART_GECKO_LOGO_PREFIX } from './types'
import { buildTokensSortIndexes, getTokensPageFromRows } from './utils'

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

type AdapterProtocolMetric = IAdapterChainMetrics['protocols'][number]

interface TokensSourceRows {
	rows: TokensSourceRow[]
	sortIndexes: TokensSortIndexes
	stats: TokensPageStats
	updatedAt: string | null
}

interface TokensSourceData extends TokensSourceRows {
	generatedAt: number
	version: string
}

export interface TokenOverviewCurrentSnapshot {
	generatedAt: number
	metrics: TokenOverviewCurrentMetrics | null
}

export interface TokensPageSnapshot {
	generatedAt: number
	data: TokensPageResponse
}

export interface TokensInitialPageSnapshot extends TokensPageSnapshot {
	chartData: TokensChartDataset
}

export const TOKENS_CHART_ROW_LIMIT = 300

interface TokenUnlockMetrics {
	unlockedPercent: number | null
	unlock30dUsd: number | null
	upcomingUnlockUsd: number | null
}

function buildMetricMap(rows: AdapterProtocolMetric[]): Map<string, number> {
	const map = new Map<string, number>()
	const parentTotals = new Map<string, number>()

	for (const row of rows) {
		const total24h = row.total24h ?? 0
		map.set(row.defillamaId, total24h)
		if (row.parentProtocol) {
			parentTotals.set(row.parentProtocol, (parentTotals.get(row.parentProtocol) ?? 0) + total24h)
		}
	}

	for (const [parentProtocol, total24h] of parentTotals) {
		if (!map.has(parentProtocol)) map.set(parentProtocol, total24h)
	}

	return map
}

function getTokenRightsSummary(parsed: ITokenRightsData): TokensRightsSummary {
	const treasury = parsed.decisions.treasury.displayTokens.length > 0
	const revenue = parsed.decisions.revenue.displayTokens.length > 0
	const burns = parsed.valueAccrual.burns.isActive
	const dividends = parsed.valueAccrual.dividends.displayTokens.length > 0
	const buybacks = parsed.valueAccrual.buybacks.displayTokens.length > 0
	const equityTone = getEquityPieTone(parsed.alignment.fundraising, parsed.alignment.equityRevenueCapture)
	const governance = parsed.governance.decisionTokenDisplay.displayTokens.length > 0

	return {
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
		equityTone,
		fundraisingLabel: parsed.alignment.fundraisingLabel,
		associatedEntities: parsed.alignment.associatedEntities
	}
}

function buildTokenRightsMap(entries: IRawTokenRightsEntry[]): Map<string, TokensRightsSummary> {
	const map = new Map<string, TokensRightsSummary>()
	for (const entry of entries) {
		const parsed = parseTokenRightsEntry(entry)
		map.set(entry['DefiLlama ID'], getTokenRightsSummary(parsed))
	}
	return map
}

function buildUnlocksMap(rows: TokensRawProtocolEmission[], nowSec: number): Map<string, TokenUnlockMetrics> {
	const map = new Map<string, TokenUnlockMetrics>()
	const startSec = nowSec - THIRTY_DAYS_SECONDS

	for (const row of rows) {
		if (!row.gecko_id) continue
		const price = row.tPrice ?? null
		let unlock30dUsd = 0
		let upcomingUnlockUsd = 0

		if (price != null) {
			for (const event of row.events ?? []) {
				if (event.timestamp < startSec || event.timestamp > nowSec) continue
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

function sumSegments(
	entry: TokenMarketsListResponse['tokens'][number] | undefined,
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

function getSearchKey(token: IResponseCGTokenRankingsDatasetItem, record: TokenDirectoryRecord | undefined): string {
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

function firstUpdatedAt(
	tokens: IResponseCGTokenRankingsDatasetItem[],
	markets: TokenMarketsListResponse
): string | null {
	if (markets.last_updated) return markets.last_updated
	for (const token of tokens) {
		if (token.last_updated) return token.last_updated
	}
	return null
}

export function buildTokenMarketSummary(
	token: IResponseCGTokenRankingsDatasetItem,
	currentMetrics: TokenOverviewCurrentMetrics | null,
	fallbackRank: number
): TokenMarketSummary {
	return {
		symbol: token.symbol.toUpperCase(),
		marketCapRank: token.market_cap_rank_with_rehypothecated ?? token.market_cap_rank ?? fallbackRank,
		currentPrice: currentMetrics?.currentPrice ?? token.current_price ?? null,
		priceChange7d: token.price_change_percentage_7d_in_currency ?? null,
		priceChange30d: token.price_change_percentage_30d_in_currency ?? null,
		marketCap: currentMetrics?.mcap ?? token.market_cap ?? null,
		fdv: currentMetrics?.fdv ?? token.fully_diluted_valuation ?? null,
		circulatingSupply: currentMetrics?.circulatingSupply ?? token.circulating_supply ?? null,
		totalSupply: currentMetrics?.totalSupply ?? token.total_supply ?? null,
		maxSupply: currentMetrics?.maxSupply ?? token.max_supply ?? null,
		ath: token.ath ?? null,
		athDate: token.ath_date ?? null
	}
}

export async function fetchTokensSourceRows(marketSnapshot: TokensMarketSnapshot): Promise<TokensSourceData> {
	const nowSec = Math.floor(Date.now() / 1000)
	const metadataModule = await import('~/utils/metadata')
	metadataModule.refreshMetadataInBackgroundIfStale('tokens')
	const metadata = metadataModule.default

	const [tokenRightsEntries, stablecoinGeckoIds, fees, revenue, holdersRevenue, unlocks] = await Promise.all([
		fetchTokenRightsEntries().catch(() => []),
		fetchStablecoinAssetsApi()
			.then((data) => {
				const geckoIds = new Set<string>()
				for (const asset of data.peggedAssets) {
					if (asset.gecko_id) geckoIds.add(asset.gecko_id.toLowerCase())
				}
				return geckoIds
			})
			.catch(() => new Set<string>()),
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
			startDate: nowSec - THIRTY_DAYS_SECONDS,
			endDate: nowSec,
			getHistoricalPrices: false,
			tokenlist: metadata.tokenlist
		}).catch(() => [])
	])

	return {
		...buildTokensSourceRows({
			tokens: marketSnapshot.tokens,
			markets: marketSnapshot.markets,
			currentMetricsById: marketSnapshot.currentMetricsById,
			tokenRightsEntries,
			stablecoinGeckoIds,
			fees,
			revenue,
			holdersRevenue,
			unlocks: unlocks as TokensRawProtocolEmission[],
			metadata,
			nowSec
		}),
		version: marketSnapshot.version,
		generatedAt: marketSnapshot.generatedAt
	}
}

export function buildTokensSourceRows({
	tokens,
	markets,
	currentMetricsById,
	tokenRightsEntries,
	stablecoinGeckoIds,
	fees,
	revenue,
	holdersRevenue,
	unlocks,
	metadata,
	nowSec
}: {
	tokens: IResponseCGTokenRankingsDatasetItem[]
	markets: TokenMarketsListResponse
	currentMetricsById?: Record<string, TokenOverviewCurrentMetrics>
	tokenRightsEntries: IRawTokenRightsEntry[]
	stablecoinGeckoIds?: Set<string>
	fees: AdapterProtocolMetric[]
	revenue: AdapterProtocolMetric[]
	holdersRevenue: AdapterProtocolMetric[]
	unlocks: TokensRawProtocolEmission[]
	metadata: MetadataCache
	nowSec: number
}): TokensSourceRows {
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

	let index = 0
	for (const token of tokens) {
		const geckoId = token.id.toLowerCase()
		const currentMetrics = currentMetricsById?.[geckoId]
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
		const href = record ? getCanonicalTokenRoute(record) : null
		const rights = resolveTokenRightsSummary(record, protocolId, rightsByDefillamaId)
		const protocolTokenRightsSlug =
			protocolId && protocolMetadata?.tokenRights
				? slug(protocolMetadata.displayName || protocolMetadata.name || protocolId)
				: null
		const row: TokensSourceRow = {
			id: token.id,
			rank: token.market_cap_rank_with_rehypothecated ?? token.market_cap_rank ?? index + 1,
			name: token.name,
			symbol: token.symbol.toUpperCase(),
			logo: record?.logo ?? geckoTokenIconUrl(token.id),
			href,
			tokenRightsHref: rights
				? href
					? `${href}#token-rights-and-value-accrual`
					: protocolTokenRightsSlug
						? `/protocol/token-rights/${protocolTokenRightsSlug}`
						: null
				: null,
			price: currentMetrics
				? currentMetrics.currentPrice
				: (token.current_price ?? marketsEntry?.segments.spot?.price ?? null),
			priceChange1h: token.price_change_percentage_1h_in_currency ?? null,
			priceChange24h: currentMetrics
				? currentMetrics.percentChange24h
				: (token.price_change_percentage_24h_in_currency ?? token.price_change_percentage_24h ?? null),
			priceChange7d: token.price_change_percentage_7d_in_currency ?? null,
			priceChange30d: token.price_change_percentage_30d_in_currency ?? null,
			marketCap: currentMetrics ? currentMetrics.mcap : (token.market_cap ?? null),
			fdv: currentMetrics ? currentMetrics.fdv : (token.fully_diluted_valuation ?? null),
			outstandingFdv: currentMetrics
				? currentMetrics.outstandingFDV
				: adjustedSupply != null && token.current_price != null
					? adjustedSupply * token.current_price
					: null,
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
			rights,
			unlock30dUsd: unlockMetrics?.unlock30dUsd ?? null,
			upcomingUnlockUsd: unlockMetrics?.upcomingUnlockUsd ?? null,
			isStablecoin: stablecoinGeckoIds?.has(geckoId) ?? false,
			searchKey: getSearchKey(token, record)
		}
		addStats(stats, row)
		if (row.marketCap != null && row.priceChange24h != null) {
			weightedChangeMarketCap += row.marketCap
			weightedChangeNumerator += row.marketCap * row.priceChange24h
		}
		rows.push(row)
		index++
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
	const marketSnapshot = await getTokensMarketSnapshot()
	return cachedResult(
		'tokens-source-rows',
		`v10:${marketSnapshot.version}`,
		{ ttlMs: TOKENS_SOURCE_CACHE_TTL_MS, maxEntries: 2 },
		() => fetchTokensSourceRows(marketSnapshot)
	)
}

export async function getTokenOverviewCurrentSnapshot(geckoId: string): Promise<TokenOverviewCurrentSnapshot> {
	const marketSnapshot = await getTokensMarketSnapshot()
	return {
		generatedAt: marketSnapshot.generatedAt,
		metrics: marketSnapshot.currentMetricsById[geckoId.toLowerCase()] ?? null
	}
}

export async function getTokenMarketSummaryByGeckoId(geckoId: string): Promise<TokenMarketSummary | null> {
	const normalizedGeckoId = geckoId.toLowerCase()
	{
		const marketSnapshot = await getTokensMarketSnapshot()

		const tokenIndex = marketSnapshot.tokenIndexById.get(normalizedGeckoId)
		if (tokenIndex == null) return null
		const token = marketSnapshot.tokens[tokenIndex]
		if (token === undefined) throw new Error(`Missing indexed token ${normalizedGeckoId}`)
		return buildTokenMarketSummary(token, marketSnapshot.currentMetricsById[normalizedGeckoId] ?? null, tokenIndex + 1)
	}
}

export function buildTokensChartDataset(
	marketCapIndex: TokensSortIndexes['marketCap'],
	limit = TOKENS_CHART_ROW_LIMIT
): TokensChartDataset {
	const chartData: TokensChartDataset = {
		names: [],
		symbols: [],
		logoSources: [],
		hrefs: [],
		marketCaps: [],
		priceChanges: { '24h': [], '7d': [], '30d': [] },
		stablecoins: []
	}
	let index = marketCapIndex.nullStart - 1

	while (index >= 0 && chartData.marketCaps.length < limit) {
		const currentRow = marketCapIndex.rows[index]
		if (currentRow === undefined) throw new Error(`Missing token sort row at index ${index}`)
		let groupStart = index
		while (groupStart > 0) {
			const previousRow = marketCapIndex.rows[groupStart - 1]
			if (previousRow === undefined) throw new Error(`Missing token sort row at index ${groupStart - 1}`)
			if (previousRow.marketCap !== currentRow.marketCap) break
			groupStart--
		}

		for (let rowIndex = groupStart; rowIndex <= index && chartData.marketCaps.length < limit; rowIndex++) {
			const row = marketCapIndex.rows[rowIndex]
			if (row === undefined) throw new Error(`Missing token sort row at index ${rowIndex}`)
			if (row.marketCap == null || row.marketCap <= 0) continue
			chartData.names.push(row.name)
			chartData.symbols.push(row.symbol)
			chartData.logoSources.push(
				row.logo === geckoTokenIconUrl(row.id) ? `${TOKENS_CHART_GECKO_LOGO_PREFIX}${row.id}` : (row.logo ?? '')
			)
			chartData.hrefs.push(row.href)
			chartData.marketCaps.push(row.marketCap)
			chartData.priceChanges['24h'].push(row.priceChange24h)
			chartData.priceChanges['7d'].push(row.priceChange7d)
			chartData.priceChanges['30d'].push(row.priceChange30d)
			chartData.stablecoins.push(row.isStablecoin)
		}

		index = groupStart - 1
	}

	return chartData
}

function getTokensPageResponse(data: TokensSourceData, query: ParsedUrlQuery): TokensPageResponse {
	return getTokensPageFromRows(data.rows, data.sortIndexes, query, {
		stats: data.stats,
		updatedAt: data.updatedAt
	})
}

export async function getTokensPageSnapshot(query: ParsedUrlQuery = {}): Promise<TokensPageSnapshot> {
	const data = await getTokensSourceData()
	return {
		generatedAt: data.generatedAt,
		data: getTokensPageResponse(data, query)
	}
}

export async function getTokensInitialPageSnapshot(): Promise<TokensInitialPageSnapshot> {
	const data = await getTokensSourceData()
	return {
		generatedAt: data.generatedAt,
		data: getTokensPageResponse(data, {}),
		chartData: buildTokensChartDataset(data.sortIndexes.marketCap)
	}
}

export async function getTokensPageData(query: ParsedUrlQuery = {}): Promise<TokensPageResponse> {
	return (await getTokensPageSnapshot(query)).data
}
