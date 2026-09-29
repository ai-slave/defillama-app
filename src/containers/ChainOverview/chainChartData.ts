import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import {
	formatBarChart,
	formatDailyAverageChart,
	formatLineChart,
	formatNullableBarChart
} from '~/components/ECharts/shared/timeSeries'
import type { ChainAssetsChartDataPoint } from '~/containers/BridgedTVL/api.types'
import { getBridgeNetFlow } from '~/containers/Bridges/bridgeOverviewVolumeData'
import type { BridgeOverviewVolumeChartTuple } from '~/containers/Bridges/types'
import { feeRevenueMetrics } from '~/metrics/feesRevenue'
import { getFeeRevenueChainChartApiParams } from '~/metrics/routeSemantics'
import type { ChainChartLabels } from './constants'
import type { ChainOverviewChartData } from './types'

const chainFeesMetric = feeRevenueMetrics.chainFees
const chainRevenueMetric = feeRevenueMetrics.chainRevenue
const chainHoldersRevenueMetric = feeRevenueMetrics.chainHoldersRevenue
const appFeesMetric = feeRevenueMetrics.appFees
const appRevenueMetric = feeRevenueMetrics.appRevenue

type FetchedChainChartLabel = Exclude<
	ChainChartLabels,
	| 'TVL'
	| 'Stablecoins Mcap'
	| 'Net Inflows'
	| 'Token Price'
	| 'Token Mcap'
	| 'Token Volume'
	| 'Core Developers'
	| 'Devs Commits'
>

function buildChainChartApiUrl(params: Record<string, string | undefined>) {
	const searchParams = new URLSearchParams()
	for (const key in params) {
		const value = params[key]
		if (value != null) searchParams.set(key, value)
	}
	return `/api/public/chains/charts?${searchParams.toString()}`
}

export function getChainChartApiUrl(label: FetchedChainChartLabel, chain: string): string {
	switch (label) {
		case 'Chain Fees':
			return buildChainChartApiUrl(getFeeRevenueChainChartApiParams({ metric: chainFeesMetric, chain }))
		case 'Chain Revenue':
			return buildChainChartApiUrl(getFeeRevenueChainChartApiParams({ metric: chainRevenueMetric, chain }))
		case 'Holders Revenue':
			return buildChainChartApiUrl(getFeeRevenueChainChartApiParams({ metric: chainHoldersRevenueMetric, chain }))
		case 'App Fees':
			return buildChainChartApiUrl(getFeeRevenueChainChartApiParams({ metric: appFeesMetric, chain }))
		case 'App Revenue':
			return buildChainChartApiUrl(getFeeRevenueChainChartApiParams({ metric: appRevenueMetric, chain }))
		case 'DEXs Volume':
			return buildChainChartApiUrl({ kind: 'adapter-chain', chain, adapterType: 'dexs' })
		case 'Perps Volume':
			return buildChainChartApiUrl({ kind: 'adapter-chain', chain, adapterType: 'derivatives' })
		case 'Active Addresses':
			return buildChainChartApiUrl({
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: 'active-users',
				protocol: chain
			})
		case 'New Addresses':
			return buildChainChartApiUrl({
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: 'new-users',
				protocol: chain
			})
		case 'Transactions':
			return buildChainChartApiUrl({
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: 'active-users',
				protocol: chain,
				dataType: 'dailyTransactionsCount'
			})
		case 'Bridged TVL':
			return buildChainChartApiUrl({ kind: 'bridged-tvl', chain })
		case 'Raises':
			return buildChainChartApiUrl({ kind: 'raises' })
		case 'Token Incentives':
			return buildChainChartApiUrl({ kind: 'token-incentives', protocol: chain })
	}
}

/** Denomination converts with the gas token; official-token valuation charts use the chain's own token (e.g. ETH versus ARB). */
export function getChainChartGeckoIds({
	denomination,
	gasTokenGeckoId,
	chainGeckoId,
	toggledCharts
}: {
	denomination: string
	gasTokenGeckoId: string | null
	chainGeckoId: string | null
	toggledCharts: ReadonlySet<ChainChartLabels>
}) {
	const hasTokenChart =
		toggledCharts.has('Token Price') || toggledCharts.has('Token Mcap') || toggledCharts.has('Token Volume')
	return {
		denominationGeckoId: denomination !== 'USD' ? gasTokenGeckoId : null,
		tokenGeckoId: hasTokenChart ? chainGeckoId : null
	}
}

export type DenominationPriceHistory = {
	conversionPrices: Record<string, number>
	canConvert: boolean
	priceChart: Array<[number, number]>
	mcaps: Array<[number, number]> | undefined
	volumes: Array<[number, number]> | undefined
}

type CoingeckoChartData = {
	prices: Array<[number, number]>
	mcaps?: Array<[number, number]>
	volumes?: Array<[number, number]>
}

export function buildDenominationPriceHistory(data: CoingeckoChartData): DenominationPriceHistory {
	const conversionPrices: Record<string, number> = {}
	let activeConversionPriceCount = 0
	for (const [date, value] of data.prices) {
		const hasConversionPrice = conversionPrices[date] !== undefined
		if (value === 0) {
			if (hasConversionPrice) {
				delete conversionPrices[date]
				activeConversionPriceCount--
			}
			continue
		}
		if (!hasConversionPrice) activeConversionPriceCount++
		conversionPrices[date] = value
	}

	return {
		conversionPrices,
		canConvert: activeConversionPriceCount > 0,
		priceChart: data.prices,
		mcaps: data.mcaps,
		volumes: data.volumes
	}
}

export const normalizeActivityChart = (values: Array<[number, number]> | null): Array<[number, number]> | null => {
	if (!values?.length) return null
	return values
}

export function getNetInflowsSeries(data: Array<BridgeOverviewVolumeChartTuple>): Array<[number, number | null]> {
	const series: Array<[number, number | null]> = []
	for (const [date, deposits, signedWithdrawals] of data) {
		const netFlow = getBridgeNetFlow({
			depositUSD: deposits,
			withdrawUSD: signedWithdrawals == null ? null : -signedWithdrawals
		})
		series.push([date, netFlow])
	}
	return series
}

export function buildBridgedTvlChart(
	bridgedTvlData: Array<ChainAssetsChartDataPoint>,
	isGovTokensEnabled: boolean | undefined
): Array<[number, number]> {
	const chart: Array<[number, number]> = []
	for (const item of bridgedTvlData) {
		const timestampMs = Math.floor(item.timestamp / 86_400) * 86_400 * 1e3
		chart.push([timestampMs, item.data.total + (isGovTokensEnabled ? (item.data.ownTokens ?? 0) : 0)])
	}
	return chart
}

type Series = Array<[number, number]> | null

/** Query results per chart; null when the query is disabled, failed, or returned nothing. */
export type ChainChartSources = {
	denominationPriceHistory: DenominationPriceHistory | null
	tokenPriceHistory: DenominationPriceHistory | null
	chainFees: Series
	chainRevenue: Series
	holdersRevenue: Series
	dexVolume: Series
	perpsVolume: Series
	appFees: Series
	appRevenue: Series
	inflows: Array<BridgeOverviewVolumeChartTuple> | null
	stablecoins: Series
	activeAddresses: Series
	newAddresses: Series
	transactions: Series
	bridgedTvl: Array<ChainAssetsChartDataPoint> | null
	raises: Series
	incentives: Series
}

export function buildChainChartData({
	denomination,
	denominationGeckoId,
	tokenGeckoId,
	toggledCharts,
	groupBy,
	finalTvlChart,
	isGovTokensEnabled,
	loadingCharts,
	sources
}: {
	denomination: string
	denominationGeckoId: string | null
	tokenGeckoId: string | null
	toggledCharts: Array<ChainChartLabels>
	groupBy: ChartTimeGroupingWithCumulative
	finalTvlChart: Array<[number, number]>
	isGovTokensEnabled: boolean | undefined
	/** Labels of charts whose queries are still loading, in display order. */
	loadingCharts: Array<string>
	sources: ChainChartSources
}): {
	finalCharts: ChainOverviewChartData
	valueSymbol: string
	loadingCharts: string
	failedMetrics: Array<ChainChartLabels>
} {
	if (loadingCharts.length > 0) {
		return {
			finalCharts: {},
			valueSymbol: denomination === 'USD' ? '$' : denomination,
			loadingCharts: loadingCharts.join(', ').toLowerCase(),
			failedMetrics: []
		}
	}

	const toggled = new Set(toggledCharts)
	const charts: ChainOverviewChartData = {}
	const { denominationPriceHistory, tokenPriceHistory } = sources
	const canConvertDenomination = !!denominationGeckoId && denominationPriceHistory?.canConvert === true
	const denominationPrices = canConvertDenomination ? denominationPriceHistory.conversionPrices : null
	const addBarChart = (label: ChainChartLabels, data: Series) => {
		if (toggled.has(label) && data) {
			charts[label] = formatBarChart({ data, groupBy, denominationPriceHistory: denominationPrices })
		}
	}

	if (toggled.has('TVL')) {
		charts.TVL = formatLineChart({
			data: finalTvlChart,
			groupBy,
			denominationPriceHistory: denominationPrices,
			dateInMs: true
		})
	}
	addBarChart(chainFeesMetric.label, sources.chainFees)
	addBarChart(chainRevenueMetric.label, sources.chainRevenue)
	addBarChart(chainHoldersRevenueMetric.label, sources.holdersRevenue)
	addBarChart('DEXs Volume', sources.dexVolume)
	addBarChart('Perps Volume', sources.perpsVolume)
	addBarChart(appFeesMetric.label, sources.appFees)
	addBarChart(appRevenueMetric.label, sources.appRevenue)

	if (toggled.has('Token Price') && tokenPriceHistory?.priceChart) {
		charts['Token Price'] = formatLineChart({
			data: tokenPriceHistory.priceChart,
			groupBy,
			denominationPriceHistory: null,
			dateInMs: true
		})
	}
	if (toggled.has('Token Mcap') && tokenPriceHistory?.mcaps) {
		charts['Token Mcap'] = formatLineChart({
			data: tokenPriceHistory.mcaps,
			groupBy,
			denominationPriceHistory: null,
			dateInMs: true
		})
	}
	if (toggled.has('Token Volume') && tokenPriceHistory?.volumes) {
		charts['Token Volume'] = formatBarChart({
			data: tokenPriceHistory.volumes,
			groupBy,
			denominationPriceHistory: null,
			dateInMs: true
		})
	}
	if (toggled.has('Net Inflows') && sources.inflows) {
		charts['Net Inflows'] = formatNullableBarChart({
			data: getNetInflowsSeries(sources.inflows),
			groupBy,
			denominationPriceHistory: denominationPrices
		})
	}
	if (toggled.has('Stablecoins Mcap') && sources.stablecoins) {
		charts['Stablecoins Mcap'] = formatLineChart({
			data: sources.stablecoins,
			groupBy,
			denominationPriceHistory: denominationPrices,
			dateInMs: true
		})
	}

	// Daily active addresses don't add up across days, so grouped views average them and cumulative leaves them out.
	if (toggled.has('Active Addresses') && sources.activeAddresses && groupBy !== 'cumulative') {
		charts['Active Addresses'] =
			groupBy === 'daily'
				? formatBarChart({ data: sources.activeAddresses, groupBy, denominationPriceHistory: null, dateInMs: false })
				: formatDailyAverageChart({ data: sources.activeAddresses, groupBy, dateInMs: false })
	}
	if (toggled.has('New Addresses') && sources.newAddresses) {
		charts['New Addresses'] = formatBarChart({
			data: sources.newAddresses,
			groupBy,
			denominationPriceHistory: null,
			dateInMs: false
		})
	}
	if (toggled.has('Transactions') && sources.transactions) {
		charts.Transactions = formatBarChart({
			data: sources.transactions,
			groupBy,
			denominationPriceHistory: null,
			dateInMs: false
		})
	}
	if (toggled.has('Bridged TVL') && sources.bridgedTvl) {
		charts['Bridged TVL'] = formatLineChart({
			data: buildBridgedTvlChart(sources.bridgedTvl, isGovTokensEnabled),
			groupBy,
			denominationPriceHistory: denominationPrices,
			dateInMs: true
		})
	}
	if (toggled.has('Raises') && sources.raises) {
		charts.Raises = formatBarChart({
			data: sources.raises,
			groupBy,
			denominationPriceHistory: null,
			dateInMs: true
		})
	}
	addBarChart('Token Incentives', sources.incentives)

	const failedMetrics = toggledCharts.filter((chartLabel) => {
		const isTokenMetric = chartLabel === 'Token Price' || chartLabel === 'Token Mcap' || chartLabel === 'Token Volume'
		// Token metrics are intentionally not fetched when no chain gecko id is available.
		if (isTokenMetric && !tokenGeckoId) return false
		return !Object.hasOwn(charts, chartLabel)
	})
	return {
		finalCharts: charts,
		valueSymbol: canConvertDenomination ? denomination : '$',
		loadingCharts: '',
		failedMetrics
	}
}
