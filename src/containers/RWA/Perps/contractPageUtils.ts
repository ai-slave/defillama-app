import type {
	ChartTimeGrouping,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { formatPercentChangeText } from '~/ui/PercentChange'
import { formattedNum, toNiceDayMonthAndYearAndTime } from '~/utils'
import { perpsDefinitions as d } from './definitions'
import type {
	IRWAPerpsContractData,
	IRWAPerpsContractFundingHistoryPoint,
	IRWAPerpsContractMarketChartPoint
} from './types'

export type RWAPerpsContractChartMetricKey = 'openInterest' | 'volume24h' | 'price' | 'fundingRate' | 'premium'

export interface RWAPerpsContractChartMetricConfig {
	key: RWAPerpsContractChartMetricKey
	label: string
	queryKey: string
	defaultEnabled: boolean
	color: string
	defaultType: 'line' | 'bar'
	yAxisIndex?: number
	valueSymbol?: string
}

export const RWA_PERPS_CONTRACT_CHART_METRICS: readonly RWAPerpsContractChartMetricConfig[] = [
	{
		key: 'openInterest',
		label: d.openInterest.label,
		queryKey: 'oi',
		defaultEnabled: true,
		color: '#3B82F6',
		defaultType: 'line',
		valueSymbol: '$'
	},
	{
		key: 'volume24h',
		label: 'Volume 24h',
		queryKey: 'vol24h',
		defaultEnabled: true,
		color: '#7DD3FC',
		defaultType: 'bar',
		valueSymbol: '$'
	},
	{
		key: 'price',
		label: d.price.label,
		queryKey: 'price',
		defaultEnabled: true,
		color: '#22C55E',
		defaultType: 'line',
		yAxisIndex: 1,
		valueSymbol: '$'
	},
	{
		key: 'fundingRate',
		label: 'Funding Rate',
		queryKey: 'funding',
		defaultEnabled: false,
		color: '#F59E0B',
		defaultType: 'line',
		yAxisIndex: 2,
		valueSymbol: '%'
	},
	{
		key: 'premium',
		label: d.premium.label,
		queryKey: 'premium',
		defaultEnabled: false,
		color: '#EF4444',
		defaultType: 'line',
		yAxisIndex: 2,
		valueSymbol: '%'
	}
] as const

export const DEFAULT_ENABLED_RWA_PERPS_CONTRACT_CHART_METRICS = RWA_PERPS_CONTRACT_CHART_METRICS.filter(
	(metric) => metric.defaultEnabled
).map((metric) => metric.key)

function toUnixMsTimestamp(timestamp: number): number {
	return timestamp > 1e12 ? timestamp : timestamp * 1e3
}

// Contract detail metrics are display fallbacks; null or malformed values should render as "-" instead of NaN.
function formatFractionPercent(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '-'
	return `${(value * 100).toFixed(Math.abs(value * 100) >= 1 ? 2 : 4)}%`
}

function formatMaybeCurrency(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '-'
	return formattedNum(value, true)
}

function formatMaybeNumber(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '-'
	return formattedNum(value, false)
}

function formatTextValue(value: string | null | undefined): string | null {
	return value ?? null
}
export function formatRWAPerpsContractChartDate(value: number): string {
	return toNiceDayMonthAndYearAndTime(Math.floor(toUnixMsTimestamp(value) / 1e3))
}

type MetricRowData = {
	label: string
	value: string
	tooltip?: string
}

export type MetricSectionData = {
	label: string
	value: string
	tooltip?: string
	children: MetricRowData[]
}

export function buildRWAPerpsContractMetricSections(contractData: IRWAPerpsContractData): {
	openInterest: MetricRowData
	volume: MetricSectionData
	fees: MetricSectionData
	tradingParameters: MetricSectionData
	marketReference: MetricSectionData
	pointInTimeRows: MetricRowData[]
} {
	const maxLeverage = formatMaybeNumber(contractData.market.maxLeverage)
	const tradingParameterChildren = [
		{
			label: d.maxLeverage.label,
			tooltip: d.maxLeverage.description,
			value: maxLeverage === '-' ? '-' : `${maxLeverage}x`
		},
		{
			label: d.makerFeeRate.label,
			tooltip: d.makerFeeRate.description,
			value: formatFractionPercent(contractData.market.makerFeeRate)
		},
		{
			label: d.takerFeeRate.label,
			tooltip: d.takerFeeRate.description,
			value: formatFractionPercent(contractData.market.takerFeeRate)
		},
		...(contractData.market.deployerFeeShare == null || !Number.isFinite(contractData.market.deployerFeeShare)
			? []
			: [
					{
						label: d.deployerFeeShare.label,
						tooltip: d.deployerFeeShare.description,
						value: formatFractionPercent(contractData.market.deployerFeeShare)
					}
				]),
		{
			label: d.sizeDecimals.label,
			tooltip: d.sizeDecimals.description,
			value: formatMaybeNumber(contractData.market.szDecimals)
		}
	]

	const marketReferenceChildren = [
		{
			label: d.oraclePrice.label,
			tooltip: d.oraclePrice.description,
			value: formatMaybeCurrency(contractData.market.oraclePx)
		},
		{ label: d.midPrice.label, tooltip: d.midPrice.description, value: formatMaybeCurrency(contractData.market.midPx) },
		{
			label: d.previousDayPrice.label,
			tooltip: d.previousDayPrice.description,
			value: formatMaybeCurrency(contractData.market.prevDayPx)
		},
		...(formatTextValue(contractData.market.pair)
			? [{ label: d.pair.label, tooltip: d.pair.description, value: contractData.market.pair }]
			: []),
		...(formatTextValue(contractData.market.marginAsset)
			? [{ label: d.marginAsset.label, tooltip: d.marginAsset.description, value: contractData.market.marginAsset }]
			: []),
		...(formatTextValue(contractData.market.settlementAsset)
			? [
					{
						label: d.settlementAsset.label,
						tooltip: d.settlementAsset.description,
						value: contractData.market.settlementAsset
					}
				]
			: [])
	]

	return {
		openInterest: {
			label: d.openInterest.label,
			tooltip: d.openInterest.description,
			value: formatMaybeCurrency(contractData.market.openInterest)
		},
		volume: {
			label: d.volume30d.label,
			tooltip: d.volume30d.description,
			value: formatMaybeCurrency(contractData.market.volume30d),
			children: [
				{
					label: d.volume7d.label,
					tooltip: d.volume7d.description,
					value: formatMaybeCurrency(contractData.market.volume7d)
				},
				{
					label: 'Volume 24h',
					tooltip: d.volume24h.description,
					value: formatMaybeCurrency(contractData.market.volume24h)
				},
				{
					label: d.cumulativeVolume.label,
					tooltip: d.cumulativeVolume.description,
					value: formatMaybeCurrency(contractData.market.volumeAllTime)
				}
			]
		},
		fees: {
			label: d.estimatedProtocolFees30d.label,
			tooltip: d.estimatedProtocolFees30d.description,
			value: formatMaybeCurrency(contractData.market.estimatedProtocolFees30d),
			children: [
				{
					label: d.estimatedProtocolFees7d.label,
					tooltip: d.estimatedProtocolFees7d.description,
					value: formatMaybeCurrency(contractData.market.estimatedProtocolFees7d)
				},
				{
					label: d.estimatedProtocolFees24h.label,
					tooltip: d.estimatedProtocolFees24h.description,
					value: formatMaybeCurrency(contractData.market.estimatedProtocolFees24h)
				},
				{
					label: d.estimatedCumulativeProtocolFees.label,
					tooltip: d.estimatedCumulativeProtocolFees.description,
					value: formatMaybeCurrency(contractData.market.estimatedProtocolFeesAllTime)
				}
			]
		},
		tradingParameters: {
			label: d.tradingParameters.label,
			tooltip: d.tradingParameters.description,
			value: `${contractData.market.maxLeverage}x`,
			children: tradingParameterChildren
		},
		marketReference: {
			label: d.marketReference.label,
			tooltip: d.marketReference.description,
			value: formatMaybeCurrency(contractData.market.oraclePx),
			children: marketReferenceChildren
		},
		pointInTimeRows: [
			{
				label: d.openInterestChange24h.label,
				tooltip: d.openInterestChange24h.description,
				value: formatPercentChangeText(contractData.market.openInterestChange24h) ?? '-'
			},
			{
				label: d.fundingRate.label,
				tooltip: d.fundingRate.description,
				value: formatFractionPercent(contractData.market.fundingRate)
			},
			{
				label: d.premium.label,
				tooltip: d.premium.description,
				value: formatFractionPercent(contractData.market.premium)
			},
			{
				label: d.cumulativeFunding.label,
				tooltip: d.cumulativeFunding.description,
				value: formatMaybeCurrency(contractData.market.cumulativeFunding)
			}
		]
	}
}

export function buildRWAPerpsContractInfoRows(contractData: IRWAPerpsContractData): MetricRowData[] {
	const marketTimestampMs = toUnixMsTimestamp(contractData.market.timestamp)
	const baseAsset = formatTextValue(contractData.contract.baseAsset)
	const symbolSuffix = contractData.contract.contract.split(':')[1] ?? contractData.contract.contract
	const shouldShowBaseAsset = baseAsset != null && baseAsset.toLowerCase() !== symbolSuffix.toLowerCase()

	return [
		{ label: d.venue.label, tooltip: d.venue.description, value: contractData.contract.venue },
		...(formatTextValue(contractData.contract.assetClass)
			? [{ label: d.assetClass.label, tooltip: d.assetClass.description, value: contractData.contract.assetClass! }]
			: []),
		...(formatTextValue(contractData.contract.rwaClassification)
			? [
					{
						label: d.rwaClassification.label,
						tooltip: d.rwaClassification.description,
						value: contractData.contract.rwaClassification!
					}
				]
			: []),
		...(formatTextValue(contractData.contract.accessModel)
			? [{ label: d.accessModel.label, tooltip: d.accessModel.description, value: contractData.contract.accessModel! }]
			: []),
		...(formatTextValue(contractData.contract.parentPlatform)
			? [
					{
						label: d.parentPlatform.label,
						tooltip: d.parentPlatform.description,
						value: contractData.contract.parentPlatform!
					}
				]
			: []),
		...(formatTextValue(contractData.contract.issuer)
			? [{ label: d.issuer.label, tooltip: d.issuer.description, value: contractData.contract.issuer! }]
			: []),
		...(formatTextValue(contractData.contract.oracleProvider)
			? [
					{
						label: d.oracleProvider.label,
						tooltip: d.oracleProvider.description,
						value: contractData.contract.oracleProvider!
					}
				]
			: []),
		...(contractData.contract.website
			? [{ label: d.website.label, tooltip: d.website.description, value: contractData.contract.website }]
			: []),
		...(shouldShowBaseAsset ? [{ label: d.baseAsset.label, tooltip: d.baseAsset.description, value: baseAsset! }] : []),
		{
			label: d.snapshotTime.label,
			tooltip: d.snapshotTime.description,
			value: formatRWAPerpsContractChartDate(marketTimestampMs)
		}
	]
}

function getMetricValue(point: IRWAPerpsContractMarketChartPoint, metric: RWAPerpsContractChartMetricKey): number {
	switch (metric) {
		case 'openInterest':
			return point.openInterest
		case 'volume24h':
			return point.volume24h
		case 'price':
			return point.price
		case 'fundingRate':
			return point.fundingRate * 100
		case 'premium':
			return point.premium * 100
	}
}

function getFundingHistoryMetricValue(
	point: IRWAPerpsContractFundingHistoryPoint,
	metric: Extract<RWAPerpsContractChartMetricKey, 'fundingRate' | 'premium'>
): number {
	switch (metric) {
		case 'fundingRate':
			return point.fundingRate * 100
		case 'premium':
			return point.premium * 100
	}
}

type ChartSpec = {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
}

export function buildRWAPerpsContractChartSpec({
	marketPoints,
	fundingHistory,
	groupBy,
	enabledMetrics
}: {
	marketPoints: IRWAPerpsContractMarketChartPoint[] | null
	fundingHistory: IRWAPerpsContractFundingHistoryPoint[] | null
	groupBy: ChartTimeGrouping
	enabledMetrics: RWAPerpsContractChartMetricKey[]
}): ChartSpec {
	type FundingMetricKey = Extract<RWAPerpsContractChartMetricKey, 'fundingRate' | 'premium'>

	const hasMarketPoints = Boolean(marketPoints?.length)
	const hasFundingHistory = Boolean(fundingHistory?.length)
	// Maps dedupe data ingestion while charts and dimensions still follow the runtime selection order.
	const marketMetrics = new Map<RWAPerpsContractChartMetricKey, number>()
	const fundingMetrics = new Map<FundingMetricKey, number>()
	const charts: MultiSeriesChartSeriesConfig[] = []

	for (const metricKey of enabledMetrics) {
		const metric = RWA_PERPS_CONTRACT_CHART_METRICS.find((item) => item.key === metricKey)
		if (!metric) continue

		if ((metric.key === 'fundingRate' || metric.key === 'premium') && hasFundingHistory) {
			fundingMetrics.set(metric.key, charts.length + 1)
		} else {
			if (!hasMarketPoints) continue
			marketMetrics.set(metric.key, charts.length + 1)
		}

		charts.push({
			name: metric.label,
			type: metric.defaultType,
			encode: { x: 0, y: charts.length + 1 },
			color: metric.color,
			...(metric.yAxisIndex != null ? { yAxisIndex: metric.yAxisIndex } : {}),
			...(metric.valueSymbol ? { valueSymbol: metric.valueSymbol } : {}),
			...(metric.key !== 'openInterest' ? { hideAreaStyle: true } : {})
		})
	}

	const rowMap = new Map<number, MultiSeriesChartDataset['source'][number]>()
	const getRow = (timestamp: number) => {
		let row = rowMap.get(timestamp)
		if (!row) {
			row = new Array(charts.length + 1)
			row[0] = timestamp
			rowMap.set(timestamp, row)
		}
		return row
	}
	const addMarketPoint = (point: IRWAPerpsContractMarketChartPoint, timestampMs: number) => {
		const timestamp = groupBy === 'daily' ? timestampMs : getBucketTimestampMs(timestampMs, groupBy)
		const row = getRow(timestamp)
		for (const [metricKey, dimensionIndex] of marketMetrics) {
			const value = getMetricValue(point, metricKey)
			// Daily duplicates overwrite; coarser volume buckets accumulate every source point.
			if (metricKey === 'volume24h' && groupBy !== 'daily') {
				row[dimensionIndex] = ((row[dimensionIndex] as number | undefined) ?? 0) + value
			} else {
				row[dimensionIndex] = value
			}
		}
	}
	const addFundingPoint = (point: IRWAPerpsContractFundingHistoryPoint, timestampMs: number) => {
		const timestamp = groupBy === 'daily' ? timestampMs : getBucketTimestampMs(timestampMs, groupBy)
		const row = getRow(timestamp)
		for (const [metricKey, dimensionIndex] of fundingMetrics) {
			row[dimensionIndex] = getFundingHistoryMetricValue(point, metricKey)
		}
	}

	// Both endpoint streams are ascending. Merge them directly so Map insertion order
	// remains chronological without allocating an event array or sorting it again.
	let marketIndex = 0
	let fundingIndex = 0
	const marketSource = marketMetrics.size > 0 ? marketPoints! : []
	const fundingSource = fundingMetrics.size > 0 ? fundingHistory! : []
	while (marketIndex < marketSource.length || fundingIndex < fundingSource.length) {
		const marketTimestamp =
			marketIndex < marketSource.length ? toUnixMsTimestamp(marketSource[marketIndex].timestamp) : Infinity
		const fundingTimestamp =
			fundingIndex < fundingSource.length ? toUnixMsTimestamp(fundingSource[fundingIndex].timestamp) : Infinity

		if (marketTimestamp <= fundingTimestamp) {
			addMarketPoint(marketSource[marketIndex++], marketTimestamp)
		} else {
			addFundingPoint(fundingSource[fundingIndex++], fundingTimestamp)
		}
	}

	const source = Array.from(rowMap.values())

	return {
		dataset: {
			source,
			dimensions: ['timestamp', ...charts.map((chart) => chart.name)]
		},
		charts
	}
}
