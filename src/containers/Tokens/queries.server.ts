import type { ParsedUrlQuery } from 'node:querystring'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import type { TokenOverviewCurrentMetrics } from '~/containers/Token/tokenOverview'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import { fetchTokenRightsEntries } from '~/containers/TokenRights/server/dataset.server'
import type { ITokenRightsData } from '~/containers/TokenRights/types'
import { formatFeeSwitchStatus, getEquityPieTone, parseTokenRightsEntry } from '~/containers/TokenRights/utils'
import { getEmissionAmountBreakdownOverInterval } from '~/containers/Unlocks/eventAmount'
import { getAllProtocolEmissions, type EnrichedProtocolEmission } from '~/containers/Unlocks/queries'
import { cachedResult } from '~/server/api/resultCache'
import { contentHashVersion, createRedisBlobStore } from '~/server/datasetSnapshots/redisBlobStore.server'
import { slug } from '~/utils'
import { getObjectCache, setObjectCache } from '~/utils/cache-client'
import { geckoTokenIconUrl } from '~/utils/icons'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { getCanonicalTokenRoute, type TokenDirectoryRecord } from '~/utils/tokenDirectory'
import { TOKENS_SOURCE_CACHE_TTL_MS, tokensCacheWindow } from './cache.server'
import {
	buildMarketsMap,
	buildTokenDirectoryIndexes,
	buildUniqueTokenSymbols,
	EMPTY_MARKETS_LIST,
	resolveEmissionsProtocolSlug,
	resolveProtocolId
} from './readModel'
import { getTokensMarketSnapshot, type TokensMarketSnapshot } from './server/tableData.server'
import type {
	TokenMarketSummary,
	TokensChartDataset,
	TokensChartResponse,
	TokensPageResponse,
	TokensPageStats,
	TokensFilterOption,
	TokensRightsSummary,
	TokensSortIndexes,
	TokensSourceRow,
	TokensOptionalSource
} from './types'
import { TOKENS_CHART_GECKO_LOGO_PREFIX, TOKENS_PAGE_RESPONSE_SCHEMA_VERSION } from './types'
import {
	buildTokensRowFilter,
	buildTokensSortIndexes,
	getTokensPageFromRows,
	matchesTokensRowFilter,
	type TokensRowFilter
} from './utils'

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

type AdapterProtocolMetric = IAdapterChainMetrics['protocols'][number]

interface TokensSourceRows {
	unavailableSources: Array<TokensOptionalSource>
	rows: Array<TokensSourceRow>
	sortIndexes: TokensSortIndexes
	stats: TokensPageStats
	updatedAt: string | null
	chainOptions: Array<TokensFilterOption>
	categoryOptions: Array<TokensFilterOption>
}

interface TokensSourceData extends TokensSourceRows {
	generatedAt: number
	version: string
}

export interface TokenOverviewCurrentSnapshot {
	generatedAt: number
	metrics: TokenOverviewCurrentMetrics | null
	categories: Array<{ id: string; label: string }>
}

export interface TokensPageSnapshot {
	generatedAt: number
	data: TokensPageResponse
}

export interface TokensChartSnapshot {
	generatedAt: number
	data: TokensChartResponse
}

export const TOKENS_CHART_ROW_LIMIT = 300

interface TokenUnlockMetrics {
	unlockedPercent: number | null
	unlock30dUsd: number | null
	upcomingUnlockUsd: number | null
}

function buildMetricMap(rows: Array<AdapterProtocolMetric>): Map<string, number> {
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
		primaryValue: parsed.valueAccrual.primary,
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

function buildTokenRightsMap(entries: Array<IRawTokenRightsEntry>): Map<string, TokensRightsSummary> {
	const map = new Map<string, TokensRightsSummary>()
	for (const entry of entries) {
		const parsed = parseTokenRightsEntry(entry)
		map.set(entry['DefiLlama ID'], getTokenRightsSummary(parsed))
	}
	return map
}

function buildUnlocksMap(rows: Array<EnrichedProtocolEmission>, nowSec: number): Map<string, TokenUnlockMetrics> {
	const map = new Map<string, TokenUnlockMetrics>()
	const startSec = nowSec - THIRTY_DAYS_SECONDS

	for (const row of rows) {
		if (!row.gecko_id) continue
		const price = row.tPrice ?? null
		const past = getEmissionAmountBreakdownOverInterval(row.events, startSec, nowSec)
		const upcoming = getEmissionAmountBreakdownOverInterval(row.events, nowSec, nowSec + THIRTY_DAYS_SECONDS)
		const unlock30dUsd =
			price !== null && price > 0 && (past.total > 0 || past.unknownEventCount === 0) ? past.total * price : null
		const upcomingUnlockUsd =
			price !== null && price > 0 && (upcoming.total > 0 || upcoming.unknownEventCount === 0)
				? upcoming.total * price
				: null

		const unlockedPercent = row.maxSupply
			? Math.max(0, Math.min(100, 100 - (row.totalLocked / row.maxSupply) * 100))
			: null
		map.set(row.gecko_id.toLowerCase(), {
			unlockedPercent,
			unlock30dUsd,
			upcomingUnlockUsd
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
	if (stats.spotVolume24h !== null) stats.spotVolume24h += row.spotVolume24h ?? 0
	if (stats.perpsVolume24h !== null) stats.perpsVolume24h += row.perpsVolume24h ?? 0
	if (stats.openInterest24h !== null) stats.openInterest24h += row.openInterest24h ?? 0
	if (stats.unlock30dUsd !== null) stats.unlock30dUsd += row.unlock30dUsd ?? 0
	if (stats.upcomingUnlockUsd !== null) stats.upcomingUnlockUsd += row.upcomingUnlockUsd ?? 0
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
	tokens: Array<IResponseCGTokenRankingsDatasetItem>,
	markets: TokenMarketsListResponse | null
): string | null {
	if (markets?.last_updated) return markets.last_updated
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

export async function fetchTokensSourceRows(
	marketSnapshot: TokensMarketSnapshot,
	metadataOverride?: MetadataCache
): Promise<TokensSourceData> {
	const nowSec = Math.floor(Date.now() / 1000)
	let metadata = metadataOverride
	if (!metadata) {
		const metadataModule = await import('~/utils/metadata')
		metadataModule.refreshMetadataInBackgroundIfStale('tokens')
		metadata = metadataModule.default
	}

	const [tokenRightsEntries, fees, revenue, holdersRevenue, unlocks] = await Promise.all([
		fetchTokenRightsEntries().catch(() => null),
		fetchAdapterChainMetrics({ adapterType: ADAPTER_TYPES.FEES, chain: 'All' })
			.then((data) => data.protocols)
			.catch(() => null),
		fetchAdapterChainMetrics({
			adapterType: ADAPTER_TYPES.FEES,
			chain: 'All',
			dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
		})
			.then((data) => data.protocols)
			.catch(() => null),
		fetchAdapterChainMetrics({
			adapterType: ADAPTER_TYPES.FEES,
			chain: 'All',
			dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
		})
			.then((data) => data.protocols)
			.catch(() => null),
		getAllProtocolEmissions({
			getHistoricalPrices: false,
			tokenlist: metadata.tokenlist
		}).catch(() => null)
	])

	const { sortIndexes, ...rows } = buildTokensSourceRows({
		tokens: marketSnapshot.tokens,
		markets: marketSnapshot.markets,
		currentMetricsById: marketSnapshot.currentMetricsById,
		tokenRightsEntries,
		fees,
		revenue,
		holdersRevenue,
		unlocks,
		metadata,
		nowSec
	})
	const payload = { ...rows, generatedAt: marketSnapshot.generatedAt }
	// Identity covers complete derived data and is computed once per cached source build.
	return { ...payload, sortIndexes, version: contentHashVersion(JSON.stringify(payload)) }
}

export function buildTokensSourceRows({
	tokens,
	markets,
	currentMetricsById,
	tokenRightsEntries,
	fees,
	revenue,
	holdersRevenue,
	unlocks,
	metadata,
	nowSec
}: {
	tokens: Array<IResponseCGTokenRankingsDatasetItem>
	markets: TokenMarketsListResponse | null
	currentMetricsById?: Record<string, TokenOverviewCurrentMetrics>
	tokenRightsEntries: Array<IRawTokenRightsEntry> | null
	fees: Array<AdapterProtocolMetric> | null
	revenue: Array<AdapterProtocolMetric> | null
	holdersRevenue: Array<AdapterProtocolMetric> | null
	unlocks: Array<EnrichedProtocolEmission> | null
	metadata: MetadataCache
	nowSec: number
}): TokensSourceRows {
	const indexes = buildTokenDirectoryIndexes(metadata)
	const marketsBySymbol = buildMarketsMap(markets ?? EMPTY_MARKETS_LIST, buildUniqueTokenSymbols(tokens))
	const rightsByDefillamaId = buildTokenRightsMap(tokenRightsEntries ?? [])
	const feeByDefillamaId = buildMetricMap(fees ?? [])
	const revenueByDefillamaId = buildMetricMap(revenue ?? [])
	const holdersRevenueByDefillamaId = buildMetricMap(holdersRevenue ?? [])
	const unlocksByGeckoId = buildUnlocksMap(unlocks ?? [], nowSec)
	const unavailableSources: Array<TokensOptionalSource> = []
	if (markets === null) unavailableSources.push('markets')
	if (tokenRightsEntries === null) unavailableSources.push('rights')
	if (fees === null) unavailableSources.push('fees')
	if (revenue === null) unavailableSources.push('revenue')
	if (holdersRevenue === null) unavailableSources.push('holdersRevenue')
	if (unlocks === null) unavailableSources.push('unlocks')
	const rows: Array<TokensSourceRow> = []
	const stats: TokensPageStats = {
		totalMarketCap: 0,
		marketCapWeightedChange24h: null,
		spotVolume24h: markets === null ? null : 0,
		perpsVolume24h: markets === null ? null : 0,
		openInterest24h: markets === null ? null : 0,
		unlock30dUsd: unlocks === null ? null : 0,
		upcomingUnlockUsd: unlocks === null ? null : 0
	}
	let marketCapNow = 0
	let marketCapDayAgo = 0

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
		const filterMembership = metadata.tokenFilterMetadata.tokens[geckoId]
		const chains = filterMembership?.chains ?? []
		const primaryChain = filterMembership?.primaryChain ?? null
		const categories = filterMembership?.categories ?? []
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
			isStablecoin: categories.includes('stablecoins'),
			searchKey: getSearchKey(token, record),
			chains,
			primaryChain,
			categories
		}
		addStats(stats, row)
		// CoinGecko ranks receipt assets only in the inclusive ranking; their backing is already counted.
		const isRehypothecated = token.market_cap_rank == null && token.market_cap_rank_with_rehypothecated != null
		if (!isRehypothecated) {
			stats.totalMarketCap += row.marketCap ?? 0
			if (row.marketCap != null && row.priceChange24h != null && row.priceChange24h > -100) {
				marketCapNow += row.marketCap
				marketCapDayAgo += row.marketCap / (1 + row.priceChange24h / 100)
			}
		}
		rows.push(row)
		index++
	}

	if (marketCapDayAgo > 0) stats.marketCapWeightedChange24h = ((marketCapNow - marketCapDayAgo) / marketCapDayAgo) * 100

	const { chainOptions, categoryOptions } = buildTokenFilterOptions(rows, metadata)
	return {
		unavailableSources,
		rows,
		sortIndexes: buildTokensSortIndexes(rows),
		stats,
		updatedAt: firstUpdatedAt(tokens, markets),
		chainOptions,
		categoryOptions
	}
}

type RankedOption = TokensFilterOption & { marketCap: number }

const compareOptions = (a: RankedOption, b: RankedOption): number => {
	const marketCapDiff = b.marketCap - a.marketCap
	return marketCapDiff || a.label.localeCompare(b.label) || a.id.localeCompare(b.id)
}

export function buildTokenFilterOptions(
	rows: Array<Pick<TokensSourceRow, 'marketCap' | 'chains' | 'categories'>>,
	metadata: Partial<Pick<MetadataCache, 'chainDisplayNames' | 'tokenFilterMetadata'>>
): { chainOptions: Array<TokensFilterOption>; categoryOptions: Array<TokensFilterOption> } {
	const chainMarketCaps = new Map<string, number>()
	const categoryMarketCaps = new Map<string, number>()
	for (const row of rows) {
		const marketCap = row.marketCap ?? 0
		for (const chain of row.chains) chainMarketCaps.set(chain, (chainMarketCaps.get(chain) ?? 0) + marketCap)
		for (const category of row.categories) {
			categoryMarketCaps.set(category, (categoryMarketCaps.get(category) ?? 0) + marketCap)
		}
	}

	const chainOptions: Array<RankedOption> = []
	for (const [id, marketCap] of chainMarketCaps) {
		chainOptions.push({ id, label: metadata.chainDisplayNames?.get(id) ?? id, marketCap })
	}
	const categoryOptions: Array<RankedOption> = (metadata.tokenFilterMetadata?.categories ?? []).map((category) => ({
		...category,
		marketCap: categoryMarketCaps.get(category.id) ?? 0
	}))
	chainOptions.sort(compareOptions)
	categoryOptions.sort(compareOptions)
	return {
		chainOptions: chainOptions.map(({ id, label }) => ({ id, label })),
		categoryOptions: categoryOptions.map(({ id, label, description }) => ({
			id,
			label,
			...(description ? { description } : {})
		}))
	}
}

type TokensSnapshot = Omit<TokensSourceData, 'sortIndexes'>

const tokensSnapshotStore = createRedisBlobStore<TokensSnapshot>({
	// Preserve the export key and payload format so existing pinned downloads remain readable.
	prefix: 'tokens-export:v15',
	versionTtlSeconds: 30 * 60,
	pointerTtlSeconds: 5 * 60,
	lastGoodTtlSeconds: 30 * 60,
	getIdentity: (data) => ({ key: 'all', version: data.version })
})

async function readTokensSourceSnapshot(key: string): Promise<TokensSnapshot | null> {
	// Browsing needs a market/metadata/window pointer; the store's all:latest cannot select that generation.
	const pointer = await getObjectCache<{ version: string }>(key)
	return pointer ? tokensSnapshotStore.readVersion('all', pointer.version) : null
}

export async function getTokensSourceData(): Promise<TokensSourceData> {
	const marketSnapshot = await getTokensMarketSnapshot()
	const metadataModule = await import('~/utils/metadata')
	metadataModule.refreshMetadataInBackgroundIfStale('tokens')
	const metadata = metadataModule.default
	const filterGeneration = metadata.tokenFilterMetadata.generatedAt
	// Keep the starting window even if enrichment crosses its boundary; do not carry that build into the next window.
	const key = `tokens-source:v16:${marketSnapshot.version}:${filterGeneration}:${tokensCacheWindow(Date.now())}`
	return cachedResult('tokens-source-rows', key, { ttlMs: TOKENS_SOURCE_CACHE_TTL_MS, maxEntries: 2 }, async () => {
		const saved = await readTokensSourceSnapshot(key)
		if (saved) {
			return { ...saved, sortIndexes: buildTokensSortIndexes(saved.rows) }
		}
		// SSR and API runtimes share enrichment work; new searches only filter prepared rows.
		const data = await fetchTokensSourceRows(marketSnapshot, metadata)
		// Adopt a concurrent publication before writing another copy of the enriched dataset.
		const winner = await readTokensSourceSnapshot(key)
		if (winner) return { ...winner, sortIndexes: buildTokensSortIndexes(winner.rows) }
		const { sortIndexes: _sortIndexes, ...payload } = data
		if (await tokensSnapshotStore.retainVersion(payload, 10 * 60)) {
			await setObjectCache(key, { version: data.version }, 5 * 60)
		}
		return data
	})
}

/** Categories ordered by the summed market cap of every token in them, the order token pages list them in. */
export function rankTokenCategoriesByMarketCap(
	marketSnapshot: Pick<TokensMarketSnapshot, 'tokens' | 'currentMetricsById'>,
	metadata: Pick<MetadataCache, 'tokenFilterMetadata'>
): Array<TokensFilterOption> {
	const filters = metadata.tokenFilterMetadata
	const rows: Array<Pick<TokensSourceRow, 'marketCap' | 'chains' | 'categories'>> = []
	for (const token of marketSnapshot.tokens) {
		const currentMetrics = marketSnapshot.currentMetricsById[token.id.toLowerCase()]
		rows.push({
			marketCap: currentMetrics ? currentMetrics.mcap : (token.market_cap ?? null),
			chains: [],
			categories: filters.tokens[token.id.toLowerCase()]?.categories ?? []
		})
	}
	return buildTokenFilterOptions(rows, metadata).categoryOptions
}

export async function getTokenOverviewCurrentSnapshot(geckoId: string): Promise<TokenOverviewCurrentSnapshot> {
	const marketSnapshot = await getTokensMarketSnapshot()
	const metadata = (await import('~/utils/metadata')).default
	const filters = metadata.tokenFilterMetadata
	const categoryOptions = await cachedResult(
		'token-category-order',
		`${marketSnapshot.version}:${filters.generatedAt}`,
		{ ttlMs: TOKENS_SOURCE_CACHE_TTL_MS, maxEntries: 2 },
		async () => rankTokenCategoriesByMarketCap(marketSnapshot, metadata)
	)
	const categoryIds = filters.tokens[geckoId.toLowerCase()]?.categories ?? []
	return {
		generatedAt: marketSnapshot.generatedAt,
		metrics: marketSnapshot.currentMetricsById[geckoId.toLowerCase()] ?? null,
		categories: categoryOptions
			.filter((category) => categoryIds.includes(category.id))
			.map(({ id, label }) => ({ id, label }))
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
	filter: TokensRowFilter | null = null,
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
			if (filter !== null && !matchesTokensRowFilter(row, filter)) continue
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

function getTokensPageResponse(
	data: TokensSourceData,
	query: ParsedUrlQuery,
	snapshotVersion: string | null
): TokensPageResponse {
	return getTokensPageFromRows(data.rows, data.sortIndexes, query, {
		snapshotVersion,
		unavailableSources: data.unavailableSources,
		stats: data.stats,
		updatedAt: data.updatedAt,
		chainOptions: data.chainOptions,
		categoryOptions: data.categoryOptions
	})
}

export class TokensExportSnapshotUnavailableError extends Error {
	constructor() {
		super('Tokens export snapshot is unavailable. Please retry the export.')
	}
}

export async function getTokensPageSnapshot(query: ParsedUrlQuery = {}): Promise<TokensPageSnapshot> {
	const requestedSnapshot = typeof query.snapshot === 'string' ? query.snapshot : null
	let data: TokensSourceData
	let snapshotVersion: string | null = null
	if (requestedSnapshot && requestedSnapshot !== 'latest') {
		data = await cachedResult('tokens-export', requestedSnapshot, { ttlMs: 60_000, maxEntries: 2 }, async () => {
			const saved = await tokensSnapshotStore.readVersion('all', requestedSnapshot)
			if (!saved) throw new TokensExportSnapshotUnavailableError()
			return { ...saved, sortIndexes: buildTokensSortIndexes(saved.rows) }
		})
		snapshotVersion = data.version
	} else {
		data = await getTokensSourceData()
		if (requestedSnapshot === 'latest') {
			const { sortIndexes: _sortIndexes, ...payload } = data
			await cachedResult('tokens-export-published', data.version, { ttlMs: 60_000, maxEntries: 2 }, async () => {
				// The extra minute covers exports sharing this one-minute publication cache.
				if (!(await tokensSnapshotStore.retainVersion(payload, 31 * 60))) {
					throw new TokensExportSnapshotUnavailableError()
				}
				return true
			})
			snapshotVersion = data.version
		}
	}
	return { generatedAt: data.generatedAt, data: getTokensPageResponse(data, query, snapshotVersion) }
}

export async function getTokensChartSnapshot(query: ParsedUrlQuery = {}): Promise<TokensChartSnapshot> {
	const data = await getTokensSourceData()
	return {
		generatedAt: data.generatedAt,
		data: {
			schemaVersion: TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
			unavailableSources: data.unavailableSources,
			...buildTokensChartDataset(
				data.sortIndexes.marketCap,
				buildTokensRowFilter(query, data.chainOptions, data.categoryOptions)
			)
		}
	}
}

export async function getTokensPageData(query: ParsedUrlQuery = {}): Promise<TokensPageResponse> {
	return (await getTokensPageSnapshot(query)).data
}
