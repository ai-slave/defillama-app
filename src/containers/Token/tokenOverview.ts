/**
 * Token page overview: market data, links, categories, raises and treasury.
 *
 * - Website, Twitter, Telegram and Discord resolve independently. A token directory URL wins over the cached CoinGecko
 *   coin-detail value. CoinGecko handles become full URLs, and Discord uses a Discord invite from the chat links.
 *   A missing link is `null` and is not rendered.
 * - Coin details stay available when chart history is missing; that never changes the sources or precedence of current
 *   market metrics.
 * - Categories use the same `tokenFilterMetadata` as `/tokens`, joined by exact CoinGecko ID. Every assigned category
 *   links to `/tokens?categories=<id>`, in the Tokens dropdown order (aggregate market cap, then alphabetical). A token
 *   with no category has no category row; protocol categories never stand in.
 * - Raises and treasury are optional: an ordinary fetch failure hides only that part and keeps the overview and current
 *   metrics. Snapshot-integrity errors and required current-snapshot errors still fail the page.
 * - Chain tokens never request a protocol treasury.
 */

import { fetchCoinGeckoChartByIdWithCacheFallback, fetchCoinGeckoCoinById } from '~/api/coingecko'
import type { CgChartResponse, CoinGeckoCoinDetailResultForOptions } from '~/api/coingecko.types'
import { fetchCoinPriceByCoinGeckoIdViaLlamaPrices } from '~/api/pricing'
import type { PriceObject } from '~/api/types'
import type { TokenMarketSummary } from '~/containers/Markets/api.types'
import { normalizeChartPointsToMs } from '~/containers/ProtocolOverview/chartSeries.utils'
import { fetchRaisesByDefillamaId } from '~/containers/Raises/api'
import type { Raise } from '~/containers/Raises/model'
import { fetchTreasuryById } from '~/containers/Treasuries/api'
import type { RawTreasuriesResponse } from '~/containers/Treasuries/api.types'
import type { ProtocolEmissionSupplyMetricsMap } from '~/containers/Unlocks/api.types'
import { slug } from '~/utils'
import type { IProtocolMetadata, ITokenListEntry } from '~/utils/metadata/types'
import { DEFAULT_PRICE_CHART_TIMEFRAME } from '~/utils/priceChartTimeframes'
import type { TokenDirectoryRecord } from '~/utils/tokenDirectory'

export type TokenOverviewChartLabel = 'Token Price' | 'Token Volume' | 'Mcap' | 'FDV'

export interface TokenOverviewTreasury {
	ownTokens: number | null
	stablecoins: number | null
	majors: number | null
	others: number | null
	total: number | null
}

export interface TokenOverviewRaise {
	date: number
	round: string | null
	amountUsd: number | null
	source?: string
	investors: Array<string>
}

export interface TokenOverviewMarketData {
	currentPrice: number | null
	percentChange24h: number | null
	ath: number | null
	athDate: string | null
	atl: number | null
	atlDate: string | null
	circulatingSupply: number | null
	totalSupply: number | null
	maxSupply: number | null
	mcap: number | null
	fdv: number | null
	volume24h: {
		total: number | null
		cex: number | null
		dex: number | null
	}
}

export interface TokenOverviewCurrentMetrics {
	currentPrice: number | null
	percentChange24h: number | null
	circulatingSupply: number | null
	totalSupply: number | null
	maxSupply: number | null
	mcap: number | null
	fdv: number | null
	volume24h: number | null
	outstandingFDV: number | null
}

export type TokenOverviewRawChartData = Partial<Record<TokenOverviewChartLabel, Array<[number, number]>>>
type CgChartTickers = NonNullable<NonNullable<CgChartResponse['data']>['coinData']>['tickers']

export interface TokenOverviewData {
	marketSummary?: TokenMarketSummary | null
	name: string
	displayName: string
	symbol: string
	website: string | null
	twitter: string | null
	telegram: string | null
	discord: string | null
	categories: Array<{ id: string; label: string }>
	marketData: TokenOverviewMarketData
	treasury: TokenOverviewTreasury | null
	raises: Array<TokenOverviewRaise> | null
	outstandingFDV: number | null
	rawChartData: TokenOverviewRawChartData
}

type TokenOverviewDataSource =
	| {
			kind: 'network'
	  }
	| {
			kind: 'prefetched'
			raises: Array<Raise> | null
			treasury: RawTreasuriesResponse[number] | null
	  }

export const TOKEN_OVERVIEW_DEFAULT_CHARTS: Array<TokenOverviewChartLabel> = ['Token Price']
export const TOKEN_OVERVIEW_ALL_CHARTS: Array<TokenOverviewChartLabel> = ['Token Price', 'Token Volume', 'Mcap', 'FDV']

const emptyMarketData: TokenOverviewMarketData = {
	currentPrice: null,
	percentChange24h: null,
	ath: null,
	athDate: null,
	atl: null,
	atlDate: null,
	circulatingSupply: null,
	totalSupply: null,
	maxSupply: null,
	mcap: null,
	fdv: null,
	volume24h: {
		total: null,
		cex: null,
		dex: null
	}
}

function needsCoinDetailFallback(tokenEntry: ITokenListEntry | null): boolean {
	if (!tokenEntry) return true

	return tokenEntry.circulating_supply == null || tokenEntry.total_supply == null || tokenEntry.total_volume == null
}

function resolveTokenProtocolSlug(
	protocolDefiLlamaId: string | null,
	protocolMetadata: IProtocolMetadata | null
): string | null {
	const idSlug = protocolDefiLlamaId?.replace(/^parent#/, '') ?? null
	if (idSlug && !/^\d+$/.test(idSlug)) return slug(idSlug)

	const metadataSlug = slug(protocolMetadata?.name ?? protocolMetadata?.displayName)
	return metadataSlug || null
}

function resolveEmissionsProtocolSlug({
	protocolSlug,
	protocolMetadata,
	chainId,
	emissionsSupplyMetrics
}: {
	protocolSlug: string | null
	protocolMetadata: IProtocolMetadata | null
	chainId: string | undefined
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
}): string | null {
	const candidates = [
		protocolSlug,
		protocolMetadata?.name,
		protocolMetadata?.displayName,
		protocolSlug ? undefined : chainId
	]

	for (const candidate of candidates) {
		const candidateSlug = slug(candidate)
		if (candidateSlug && emissionsSupplyMetrics[candidateSlug]) return candidateSlug
	}

	return null
}

type TokenOverviewCoinDetail = CoinGeckoCoinDetailResultForOptions<{
	localization: false
	tickers: false
	marketData: true
	communityData: false
	developerData: false
	sparkline: false
	includeCategoriesDetails: false
}>

async function fetchTokenOverviewCoinDetail(geckoId: string): Promise<TokenOverviewCoinDetail | null> {
	if (!geckoId) return null

	return fetchCoinGeckoCoinById(geckoId, {
		localization: false,
		tickers: false,
		marketData: true,
		communityData: false,
		developerData: false,
		sparkline: false,
		includeCategoriesDetails: false
	}).catch(() => null)
}

// CoinGecko reports circulating_supply = 0 for some fully-outstanding wrapper/savings
// tokens, which zeros out their market cap. Treat total supply as circulating for these.
const CIRCULATING_SUPPLY_OVERRIDES: Record<string, 'totalSupply'> = {
	'spark-savings-usdt': 'totalSupply'
}

export function resolveCirculatingSupply(
	geckoId: string | null,
	circulatingSupply: number | null,
	totalSupply: number | null
): number | null {
	if (!geckoId || !CIRCULATING_SUPPLY_OVERRIDES[geckoId]) return circulatingSupply
	if (circulatingSupply != null && circulatingSupply > 0) return circulatingSupply
	return totalSupply ?? circulatingSupply
}

function buildTokenMarketDataFallback(
	coinDetail: TokenOverviewCoinDetail | null | undefined,
	currentPriceViaLlama: { price?: number | null; timestamp?: number | null } | null,
	geckoId: string | null
): TokenOverviewMarketData {
	const marketData = coinDetail?.market_data
	const currentPrice = currentPriceViaLlama?.price ?? marketData?.current_price?.usd ?? null
	const totalSupply = marketData?.total_supply ?? null
	const circulatingSupply = resolveCirculatingSupply(geckoId, marketData?.circulating_supply ?? null, totalSupply)
	const maxSupply = marketData?.max_supply ?? null
	const ath = resolveCurrentAth({
		currentPrice,
		currentPriceTimestamp: currentPriceViaLlama?.timestamp ?? null,
		ath: marketData?.ath?.usd ?? null,
		athDate: marketData?.ath_date?.usd ?? null
	})
	const atl = resolveCurrentAtl({
		currentPrice,
		currentPriceTimestamp: currentPriceViaLlama?.timestamp ?? null,
		atl: marketData?.atl?.usd ?? null,
		atlDate: marketData?.atl_date?.usd ?? null
	})

	return {
		currentPrice,
		percentChange24h: null,
		ath: ath.value,
		athDate: ath.date,
		atl: atl.value,
		atlDate: atl.date,
		circulatingSupply,
		totalSupply,
		maxSupply,
		mcap: calculateMarketValue(currentPrice, circulatingSupply) ?? marketData?.market_cap?.usd ?? null,
		fdv:
			calculateMarketValue(currentPrice, maxSupply ?? totalSupply) ?? marketData?.fully_diluted_valuation?.usd ?? null,
		volume24h: {
			total: marketData?.total_volume?.usd ?? null,
			cex: null,
			dex: null
		}
	}
}

function resolveCurrentAth({
	currentPrice,
	currentPriceTimestamp,
	ath,
	athDate
}: {
	currentPrice: number | null
	currentPriceTimestamp: number | null
	ath: number | null
	athDate: string | null
}): { value: number | null; date: string | null } {
	if (currentPrice == null || ath == null || !Number.isFinite(currentPrice) || currentPrice <= ath) {
		return { value: ath, date: athDate }
	}

	const currentDate =
		currentPriceTimestamp != null && Number.isFinite(currentPriceTimestamp)
			? new Date(currentPriceTimestamp * 1000).toISOString()
			: new Date().toISOString()

	return { value: currentPrice, date: currentDate }
}

function resolveCurrentAtl({
	currentPrice,
	currentPriceTimestamp,
	atl,
	atlDate
}: {
	currentPrice: number | null
	currentPriceTimestamp: number | null
	atl: number | null
	atlDate: string | null
}): { value: number | null; date: string | null } {
	if (currentPrice == null || atl == null || !Number.isFinite(currentPrice) || currentPrice >= atl) {
		return { value: atl, date: atlDate }
	}

	const currentDate =
		currentPriceTimestamp != null && Number.isFinite(currentPriceTimestamp)
			? new Date(currentPriceTimestamp * 1000).toISOString()
			: new Date().toISOString()

	return { value: currentPrice, date: currentDate }
}

function calculateMarketValue(price: number | null, supply: number | null): number | null {
	if (price == null || supply == null || !Number.isFinite(price) || !Number.isFinite(supply)) {
		return null
	}

	return price * supply
}

function buildTokenMarketData(
	tokenEntry: ITokenListEntry | null,
	tickers: CgChartTickers,
	cgExchangeIdentifiers: Array<string>,
	currentMetrics: TokenOverviewCurrentMetrics | null,
	marketDataFallback: TokenOverviewMarketData = emptyMarketData,
	currentPriceTimestamp: number | null = null,
	geckoId: string | null = null
): TokenOverviewMarketData {
	if (!tokenEntry && !currentMetrics) {
		return marketDataFallback
	}

	let cexVolume: number | null = null
	let dexVolume: number | null = null
	if (tickers) {
		const cexIds = new Set(cgExchangeIdentifiers)
		let cex = 0
		let dex = 0

		for (const ticker of tickers) {
			const volume = ticker.converted_volume?.usd ?? 0
			if (ticker.trust_score === 'red') continue

			if (cexIds.has(ticker.market?.identifier ?? '')) {
				cex += volume
			} else {
				dex += volume
			}
		}

		cexVolume = cex
		dexVolume = dex
	}

	const currentPrice = currentMetrics
		? currentMetrics.currentPrice
		: (marketDataFallback.currentPrice ?? tokenEntry?.current_price ?? null)
	const totalSupply = currentMetrics
		? currentMetrics.totalSupply
		: (tokenEntry?.total_supply ?? marketDataFallback.totalSupply)
	const circulatingSupply = resolveCirculatingSupply(
		geckoId,
		currentMetrics
			? currentMetrics.circulatingSupply
			: (tokenEntry?.circulating_supply ?? marketDataFallback.circulatingSupply),
		totalSupply
	)
	const maxSupply = currentMetrics ? currentMetrics.maxSupply : (tokenEntry?.max_supply ?? marketDataFallback.maxSupply)
	const ath = resolveCurrentAth({
		currentPrice,
		currentPriceTimestamp,
		ath: tokenEntry?.ath ?? marketDataFallback.ath,
		athDate: tokenEntry?.ath_date ?? marketDataFallback.athDate
	})
	const atl = resolveCurrentAtl({
		currentPrice,
		currentPriceTimestamp,
		atl: tokenEntry?.atl ?? marketDataFallback.atl,
		atlDate: tokenEntry?.atl_date ?? marketDataFallback.atlDate
	})

	return {
		currentPrice,
		percentChange24h: currentMetrics
			? currentMetrics.percentChange24h
			: (tokenEntry?.price_change_percentage_24h ?? marketDataFallback.percentChange24h),
		ath: ath.value,
		athDate: ath.date,
		atl: atl.value,
		atlDate: atl.date,
		circulatingSupply,
		totalSupply,
		maxSupply,
		mcap: currentMetrics
			? currentMetrics.mcap
			: (calculateMarketValue(currentPrice, circulatingSupply) ?? tokenEntry?.market_cap ?? marketDataFallback.mcap),
		fdv: currentMetrics
			? currentMetrics.fdv
			: (calculateMarketValue(currentPrice, maxSupply ?? totalSupply) ??
				tokenEntry?.fully_diluted_valuation ??
				marketDataFallback.fdv),
		volume24h: {
			total: currentMetrics
				? currentMetrics.volume24h
				: (tokenEntry?.total_volume ?? marketDataFallback.volume24h.total),
			cex: cexVolume,
			dex: dexVolume
		}
	}
}

function buildTreasurySummary(
	treasury: { tokenBreakdowns: { ownTokens: number; stablecoins: number; majors: number; others: number } } | null
): TokenOverviewTreasury | null {
	if (!treasury) return null

	const { majors, stablecoins, ownTokens, others } = treasury.tokenBreakdowns

	return {
		majors,
		stablecoins,
		ownTokens,
		others,
		total: majors + stablecoins + ownTokens + others
	}
}

function buildRaisesSummary(raises: Array<Raise> | null): Array<TokenOverviewRaise> | null {
	if (!raises?.length) return null

	return [...raises]
		.sort((a, b) => a.date - b.date)
		.map((raise) => ({
			date: raise.date,
			round: raise.round ?? null,
			amountUsd: raise.amountUsd,
			source: raise.source,
			investors: [...(raise.leadInvestors ?? []), ...(raise.otherInvestors ?? [])]
		}))
}

export function buildTokenOverviewRawChartData({
	chart,
	totalSupply,
	includeCharts = TOKEN_OVERVIEW_ALL_CHARTS
}: {
	chart: CgChartResponse | null
	totalSupply: number | null
	includeCharts?: Array<TokenOverviewChartLabel>
}): TokenOverviewRawChartData {
	const includedCharts = new Set(includeCharts)
	const priceSeries = normalizeChartPointsToMs(chart?.data?.prices)
	const mcapSeries = normalizeChartPointsToMs(chart?.data?.mcaps)
	const volumeSeries = normalizeChartPointsToMs(chart?.data?.volumes)

	const fdvSeries =
		priceSeries && totalSupply != null && Number.isFinite(totalSupply)
			? priceSeries.map(([timestamp, price]) => [timestamp, price * totalSupply] as [number, number])
			: null

	return {
		...(includedCharts.has('Token Price') && priceSeries ? { 'Token Price': priceSeries } : {}),
		...(includedCharts.has('Token Volume') && volumeSeries ? { 'Token Volume': volumeSeries } : {}),
		...(includedCharts.has('Mcap') && mcapSeries ? { Mcap: mcapSeries } : {}),
		...(includedCharts.has('FDV') && fdvSeries ? { FDV: fdvSeries } : {})
	}
}

export interface TokenOverviewInput {
	record: TokenDirectoryRecord
	categories: TokenOverviewData['categories']
	displayName: string
	geckoId: string | null
	tokenEntry: ITokenListEntry | null
	protocolMetadata: IProtocolMetadata | null
	cgExchangeIdentifiers: Array<string>
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
	currentMetrics?: TokenOverviewCurrentMetrics | null
	source: TokenOverviewDataSource
	prefetchedCharts?: Array<TokenOverviewChartLabel>
}

/** What each upstream returned for one token; a source that was not requested or failed is null. */
export interface TokenOverviewSources {
	cgChart: CgChartResponse | null
	coinDetail: TokenOverviewCoinDetail | null
	currentPriceViaLlama: PriceObject | null
	raises: Array<Raise> | null
	treasury: RawTreasuriesResponse[number] | null
}

function resolveTokenOverviewEntities({ record, protocolMetadata }: TokenOverviewInput) {
	const chainDefiLlamaId = record.chainId ? `chain#${record.chainId.toLowerCase()}` : null
	const protocolDefiLlamaId = record.protocolId ?? protocolMetadata?.name ?? null
	// A chain token's treasury is not the protocol's, so only protocol tokens show one.
	const hasTreasury = Boolean(!record.chainId && protocolDefiLlamaId)
	return { chainDefiLlamaId, protocolDefiLlamaId, hasTreasury }
}

/**
 * Which upstreams to ask. Rankings metrics already carry the current market snapshot, and prefetched
 * funding already carries raises and treasury, so neither is fetched again.
 */
export function planTokenOverviewRequests(input: TokenOverviewInput) {
	const { geckoId, tokenEntry, currentMetrics = null, source } = input
	const { chainDefiLlamaId, protocolDefiLlamaId, hasTreasury } = resolveTokenOverviewEntities(input)
	return {
		coinDetailGeckoId: geckoId && currentMetrics == null && needsCoinDetailFallback(tokenEntry) ? geckoId : null,
		llamaPriceGeckoId: geckoId && currentMetrics == null ? geckoId : null,
		raisesDefillamaId: source.kind === 'prefetched' ? null : (chainDefiLlamaId ?? protocolDefiLlamaId),
		treasuryId: source.kind === 'prefetched' || !hasTreasury ? null : `${protocolDefiLlamaId}-treasury`
	}
}

export function buildTokenOverviewData(input: TokenOverviewInput, sources: TokenOverviewSources): TokenOverviewData {
	const {
		record,
		categories,
		displayName,
		geckoId,
		tokenEntry,
		protocolMetadata,
		cgExchangeIdentifiers,
		emissionsSupplyMetrics,
		currentMetrics = null,
		prefetchedCharts = TOKEN_OVERVIEW_ALL_CHARTS
	} = input
	const { cgChart, coinDetail, currentPriceViaLlama } = sources
	const { protocolDefiLlamaId, hasTreasury } = resolveTokenOverviewEntities(input)
	const protocolSlug = resolveTokenProtocolSlug(protocolDefiLlamaId, protocolMetadata)
	const emissionsProtocolSlug = resolveEmissionsProtocolSlug({
		protocolSlug,
		protocolMetadata,
		chainId: record.chainId,
		emissionsSupplyMetrics
	})
	const adjustedSupply = emissionsProtocolSlug
		? (emissionsSupplyMetrics[emissionsProtocolSlug]?.supplyMetrics?.adjustedSupply ?? null)
		: null
	const totalSupply = currentMetrics
		? (currentMetrics.maxSupply ?? currentMetrics.totalSupply)
		: (tokenEntry?.max_supply ?? tokenEntry?.total_supply ?? null)

	const marketDataFallback = buildTokenMarketDataFallback(coinDetail, currentPriceViaLlama, geckoId)
	const marketData = buildTokenMarketData(
		tokenEntry,
		cgChart?.data?.coinData?.tickers,
		cgExchangeIdentifiers,
		currentMetrics,
		marketDataFallback,
		currentPriceViaLlama?.timestamp ?? null,
		geckoId
	)
	const treasury = hasTreasury ? buildTreasurySummary(sources.treasury) : null

	const matchedRaises = sources.raises ?? []
	const links = cgChart?.data?.coinData?.links
	const twitterHandle = links?.twitter_screen_name?.trim()
	const telegramHandle = links?.telegram_channel_identifier?.trim()

	return {
		name: record.name,
		displayName,
		symbol: record.symbol,
		categories,
		website: record.website ?? links?.homepage?.find((url) => /^https?:\/\//i.test(url)) ?? null,
		twitter: record.twitter ?? (twitterHandle ? `https://x.com/${encodeURIComponent(twitterHandle)}` : null),
		telegram: record.telegram ?? (telegramHandle ? `https://t.me/${encodeURIComponent(telegramHandle)}` : null),
		discord:
			record.discord ??
			links?.chat_url?.find((url) =>
				/^https?:\/\/(?:www\.)?(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(url)
			) ??
			null,
		marketData,
		treasury,
		raises: buildRaisesSummary(matchedRaises),
		outstandingFDV: currentMetrics
			? currentMetrics.outstandingFDV
			: adjustedSupply != null && marketData.currentPrice != null
				? adjustedSupply * marketData.currentPrice
				: null,
		rawChartData: buildTokenOverviewRawChartData({
			chart: cgChart,
			totalSupply: totalSupply ?? marketDataFallback.maxSupply ?? marketDataFallback.totalSupply,
			includeCharts: prefetchedCharts
		})
	}
}

export async function getTokenOverviewData(input: TokenOverviewInput): Promise<TokenOverviewData> {
	const { geckoId, source } = input
	const plan = planTokenOverviewRequests(input)
	const [cgChart, coinDetail, currentPriceViaLlama, raises, treasury] = await Promise.all([
		geckoId
			? fetchCoinGeckoChartByIdWithCacheFallback(geckoId, {
					timeframe: DEFAULT_PRICE_CHART_TIMEFRAME,
					includeCoinData: true
				}).catch(() => null)
			: Promise.resolve(null),
		plan.coinDetailGeckoId ? fetchTokenOverviewCoinDetail(plan.coinDetailGeckoId) : Promise.resolve(null),
		plan.llamaPriceGeckoId
			? fetchCoinPriceByCoinGeckoIdViaLlamaPrices(plan.llamaPriceGeckoId).catch(() => null)
			: Promise.resolve(null),
		source.kind === 'prefetched'
			? Promise.resolve(source.raises)
			: plan.raisesDefillamaId
				? fetchRaisesByDefillamaId(plan.raisesDefillamaId).catch((): Array<Raise> => [])
				: Promise.resolve(null),
		source.kind === 'prefetched'
			? Promise.resolve(source.treasury)
			: plan.treasuryId
				? fetchTreasuryById(plan.treasuryId).catch(() => null)
				: Promise.resolve(null)
	])

	return buildTokenOverviewData(input, { cgChart, coinDetail, currentPriceViaLlama, raises, treasury })
}
