import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type {
	ChartTimeGrouping,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { formatPercentChangeText } from '~/ui/PercentChange'
import {
	formatUsd,
	formatCompactNumber,
	formatPercent,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import type { IRWAPerpsMarketChartPoint } from './api.types'
import { perpsDefinitions as d } from './definitions'
import type { IRWAPerpsContractData, IRWAPerpsContractFundingHistoryPoint } from './types'

dayjs.extend(utc)

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

export const RWA_PERPS_CONTRACT_CHART_METRICS: ReadonlyArray<RWAPerpsContractChartMetricConfig> = [
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

function formatFractionPercent(value: number): string {
	return `${formatPercent(value, { input: 'fraction', minimumFractionDigits: Math.abs(value * 100) >= 1 ? 2 : 4, maximumFractionDigits: Math.abs(value * 100) >= 1 ? 2 : 4, useGrouping: false })}`
}

function formatTextValue(value: string | null | undefined): string | null {
	return value ?? null
}
export function formatRWAPerpsContractChartDate(value: number): string {
	return dayjs.utc(value).format('D MMM, YYYY HH:mm')
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
	children: Array<MetricRowData>
}

export function buildRWAPerpsContractMetricSections(contractData: IRWAPerpsContractData): {
	openInterest: MetricRowData
	volume: MetricSectionData
	fees: MetricSectionData
	tradingParameters: MetricSectionData
	marketReference: MetricSectionData
	pointInTimeRows: Array<MetricRowData>
} {
	const maxLeverage = formatCompactNumber(contractData.market.maxLeverage, NUMBER_LOWERCASE_MILLIONS_OPTIONS) ?? '-'
	const pair = formatTextValue(contractData.market.pair)
	const marginAsset = formatTextValue(contractData.market.marginAsset)
	const settlementAsset = formatTextValue(contractData.market.settlementAsset)
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
		{
			label: d.deployerFeeShare.label,
			tooltip: d.deployerFeeShare.description,
			value: formatFractionPercent(contractData.market.deployerFeeShare)
		},
		{
			label: d.sizeDecimals.label,
			tooltip: d.sizeDecimals.description,
			value: formatCompactNumber(contractData.market.szDecimals, NUMBER_LOWERCASE_MILLIONS_OPTIONS) ?? '-'
		}
	]

	const marketReferenceChildren = [
		{
			label: d.oraclePrice.label,
			tooltip: d.oraclePrice.description,
			value: formatUsd(contractData.market.oraclePx, USD_LOWERCASE_MILLIONS_OPTIONS)
		},
		{
			label: d.midPrice.label,
			tooltip: d.midPrice.description,
			value: formatUsd(contractData.market.midPx, USD_LOWERCASE_MILLIONS_OPTIONS)
		},
		{
			label: d.previousDayPrice.label,
			tooltip: d.previousDayPrice.description,
			value: formatUsd(contractData.market.prevDayPx, USD_LOWERCASE_MILLIONS_OPTIONS)
		},
		...(pair ? [{ label: d.pair.label, tooltip: d.pair.description, value: pair }] : []),
		...(marginAsset ? [{ label: d.marginAsset.label, tooltip: d.marginAsset.description, value: marginAsset }] : []),
		...(settlementAsset
			? [
					{
						label: d.settlementAsset.label,
						tooltip: d.settlementAsset.description,
						value: settlementAsset
					}
				]
			: [])
	]

	return {
		openInterest: {
			label: d.openInterest.label,
			tooltip: d.openInterest.description,
			value: formatUsd(contractData.market.openInterest, USD_LOWERCASE_MILLIONS_OPTIONS)
		},
		volume: {
			label: d.volume30d.label,
			tooltip: d.volume30d.description,
			value: formatUsd(contractData.market.volume30d, USD_LOWERCASE_MILLIONS_OPTIONS),
			children: [
				{
					label: d.volume7d.label,
					tooltip: d.volume7d.description,
					value: formatUsd(contractData.market.volume7d, USD_LOWERCASE_MILLIONS_OPTIONS)
				},
				{
					label: 'Volume 24h',
					tooltip: d.volume24h.description,
					value: formatUsd(contractData.market.volume24h, USD_LOWERCASE_MILLIONS_OPTIONS)
				},
				{
					label: d.cumulativeVolume.label,
					tooltip: d.cumulativeVolume.description,
					value: formatUsd(contractData.market.volumeAllTime, USD_LOWERCASE_MILLIONS_OPTIONS)
				}
			]
		},
		fees: {
			label: d.estimatedProtocolFees30d.label,
			tooltip: d.estimatedProtocolFees30d.description,
			value: formatUsd(contractData.market.estimatedProtocolFees30d, USD_LOWERCASE_MILLIONS_OPTIONS),
			children: [
				{
					label: d.estimatedProtocolFees7d.label,
					tooltip: d.estimatedProtocolFees7d.description,
					value: formatUsd(contractData.market.estimatedProtocolFees7d, USD_LOWERCASE_MILLIONS_OPTIONS)
				},
				{
					label: d.estimatedProtocolFees24h.label,
					tooltip: d.estimatedProtocolFees24h.description,
					value: formatUsd(contractData.market.estimatedProtocolFees24h, USD_LOWERCASE_MILLIONS_OPTIONS)
				},
				{
					label: d.estimatedCumulativeProtocolFees.label,
					tooltip: d.estimatedCumulativeProtocolFees.description,
					value: formatUsd(contractData.market.estimatedProtocolFeesAllTime, USD_LOWERCASE_MILLIONS_OPTIONS)
				}
			]
		},
		tradingParameters: {
			label: d.tradingParameters.label,
			tooltip: d.tradingParameters.description,
			value: maxLeverage === '-' ? '-' : `${maxLeverage}x`,
			children: tradingParameterChildren
		},
		marketReference: {
			label: d.marketReference.label,
			tooltip: d.marketReference.description,
			value: formatUsd(contractData.market.oraclePx, USD_LOWERCASE_MILLIONS_OPTIONS),
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
				value: formatUsd(contractData.market.cumulativeFunding, USD_LOWERCASE_MILLIONS_OPTIONS)
			}
		]
	}
}

export function buildRWAPerpsContractInfoRows(contractData: IRWAPerpsContractData): Array<MetricRowData> {
	const marketTimestampMs = contractData.market.timestamp * 1e3
	const baseAsset = formatTextValue(contractData.contract.baseAsset)
	const assetClass = formatTextValue(contractData.contract.assetClass)
	const rwaClassification = formatTextValue(contractData.contract.rwaClassification)
	const accessModel = formatTextValue(contractData.contract.accessModel)
	const parentPlatform = formatTextValue(contractData.contract.parentPlatform)
	const issuer = formatTextValue(contractData.contract.issuer)
	const oracleProvider = formatTextValue(contractData.contract.oracleProvider)
	const symbolSuffix = contractData.contract.contract.split(':')[1] ?? contractData.contract.contract

	return [
		{ label: d.venue.label, tooltip: d.venue.description, value: contractData.contract.venue },
		...(assetClass ? [{ label: d.assetClass.label, tooltip: d.assetClass.description, value: assetClass }] : []),
		...(rwaClassification
			? [
					{
						label: d.rwaClassification.label,
						tooltip: d.rwaClassification.description,
						value: rwaClassification
					}
				]
			: []),
		...(accessModel ? [{ label: d.accessModel.label, tooltip: d.accessModel.description, value: accessModel }] : []),
		...(parentPlatform
			? [
					{
						label: d.parentPlatform.label,
						tooltip: d.parentPlatform.description,
						value: parentPlatform
					}
				]
			: []),
		...(issuer ? [{ label: d.issuer.label, tooltip: d.issuer.description, value: issuer }] : []),
		...(oracleProvider
			? [
					{
						label: d.oracleProvider.label,
						tooltip: d.oracleProvider.description,
						value: oracleProvider
					}
				]
			: []),
		...(contractData.contract.website
			? [{ label: d.website.label, tooltip: d.website.description, value: contractData.contract.website }]
			: []),
		...(baseAsset == null || baseAsset.toLowerCase() === symbolSuffix.toLowerCase()
			? []
			: [{ label: d.baseAsset.label, tooltip: d.baseAsset.description, value: baseAsset }]),
		{
			label: d.snapshotTime.label,
			tooltip: d.snapshotTime.description,
			value: formatRWAPerpsContractChartDate(marketTimestampMs)
		}
	]
}

function getMetricValue(point: IRWAPerpsMarketChartPoint, metric: RWAPerpsContractChartMetricKey): number {
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
	charts: Array<MultiSeriesChartSeriesConfig>
}

export function buildRWAPerpsContractChartSpec({
	marketPoints,
	fundingHistory,
	groupBy,
	enabledMetrics
}: {
	marketPoints: Array<IRWAPerpsMarketChartPoint> | null
	fundingHistory: Array<IRWAPerpsContractFundingHistoryPoint> | null
	groupBy: ChartTimeGrouping
	enabledMetrics: Array<RWAPerpsContractChartMetricKey>
}): ChartSpec {
	type FundingMetricKey = Extract<RWAPerpsContractChartMetricKey, 'fundingRate' | 'premium'>

	const hasMarketPoints = Boolean(marketPoints?.length)
	const hasFundingHistory = Boolean(fundingHistory?.length)
	// Maps retain the last duplicate selection, matching the prior dimension-index behavior.
	const marketMetrics = new Map<RWAPerpsContractChartMetricKey, Array<[number, number | null]>>()
	const fundingMetrics = new Map<FundingMetricKey, Array<[number, number | null]>>()
	const charts: Array<MultiSeriesChartSeriesConfig> = []

	for (const metricKey of enabledMetrics) {
		const metric = RWA_PERPS_CONTRACT_CHART_METRICS.find((item) => item.key === metricKey)
		if (!metric) continue

		const data: Array<[number, number | null]> = []
		if ((metric.key === 'fundingRate' || metric.key === 'premium') && hasFundingHistory) {
			fundingMetrics.set(metric.key, data)
		} else {
			if (!hasMarketPoints) continue
			marketMetrics.set(metric.key, data)
		}

		charts.push({
			name: metric.label,
			type: metric.defaultType,
			encode: { x: 0, y: 1 },
			data,
			color: metric.color,
			...(metric.yAxisIndex != null ? { yAxisIndex: metric.yAxisIndex } : {}),
			...(metric.valueSymbol ? { valueSymbol: metric.valueSymbol } : {}),
			...(metric.key !== 'openInterest' ? { hideAreaStyle: true } : {})
		})
	}

	const marketCollectors = Array.from(marketMetrics)
	const fundingCollectors = Array.from(fundingMetrics)
	if (marketMetrics.size > 0 && marketPoints) {
		for (const point of marketPoints) {
			const timestampMs = point.timestamp
			const timestamp = groupBy === 'daily' ? timestampMs : getBucketTimestampMs(timestampMs, groupBy)
			for (const [metricKey, data] of marketCollectors) {
				const value = getMetricValue(point, metricKey)
				const latest = data[data.length - 1]
				if (!latest || latest[0] !== timestamp) {
					data.push([timestamp, value])
				} else if (metricKey === 'volume24h' && groupBy !== 'daily') {
					latest[1] = (latest[1] ?? 0) + value
				} else {
					latest[1] = value
				}
			}
		}
	}
	if (fundingMetrics.size > 0 && fundingHistory) {
		for (const point of fundingHistory) {
			const timestampMs = point.timestamp
			const timestamp = groupBy === 'daily' ? timestampMs : getBucketTimestampMs(timestampMs, groupBy)
			for (const [metricKey, data] of fundingCollectors) {
				const value = getFundingHistoryMetricValue(point, metricKey)
				const latest = data[data.length - 1]
				if (latest && latest[0] === timestamp) latest[1] = value
				else data.push([timestamp, value])
			}
		}
	}

	return {
		dataset: {
			source: [],
			dimensions: ['timestamp', ...charts.map((chart) => chart.name)]
		},
		charts
	}
}
