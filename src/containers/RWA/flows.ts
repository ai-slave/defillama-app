import type {
	ChartTimeGrouping,
	ChartTimeGroupingWithCumulative,
	MultiSeriesChart2Dataset,
	MultiSeriesChart2SeriesConfig
} from '~/components/ECharts/types'
import { getBucketTimestampMs } from '~/components/ECharts/utils'
import { CHART_COLORS } from '~/constants/colors'
import { formattedNum } from '~/utils'
import { toUnixMsTimestamp } from './api'
import type {
	IRWAAssetsOverview,
	IRWAFlowAggregatePoint,
	IRWAFlowAssetBreakdownRow,
	IRWAFlowOverviewSplitPoint,
	IRWAFlowPoint,
	RWAChartMetricKey
} from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { definitions } from './definitions'
import { getPrimaryRwaCategory, getRwaPlatforms, UNKNOWN_PLATFORM } from './grouping'

export type RWAFlowGrouping = ChartTimeGroupingWithCumulative
export type RWAFlowChartMode = RWAFlowGrouping | 'flowVsPrice'
export type RWAFlowOverlayMetric = RWAChartMetricKey
type RWAFlowOverlayValues = ReadonlyMap<number, number | null>
export type RWAFlowOverlay =
	| { metric: RWAFlowOverlayMetric; values: RWAFlowOverlayValues }
	| { metric: 'onChainMcap'; values: null }
export type RWAFlowChartSelection =
	| { view: 'netFlows'; groupBy: RWAFlowGrouping; overlays: readonly RWAFlowOverlay[] }
	| { view: 'flowVsPrice'; groupBy: ChartTimeGrouping; mcapByTimestamp: RWAFlowOverlayValues | null }
export type RWAFlowRotationFrequency = Extract<ChartTimeGrouping, 'weekly' | 'monthly'>

export const RWA_FLOW_OVERLAY_OPTIONS = [
	{
		key: 'onChainMcap' as const,
		name: definitions.flows.onchainMcap.label,
		help: definitions.flows.onchainMcap.description,
		color: CHART_COLORS[0]
	},
	{
		key: 'activeMcap' as const,
		name: definitions.flows.activeMcap.label,
		help: definitions.flows.activeMcap.description,
		color: CHART_COLORS[4]
	},
	{
		key: 'defiActiveTvl' as const,
		name: definitions.flows.defiActiveTvl.label,
		help: definitions.flows.defiActiveTvl.description,
		color: CHART_COLORS[3]
	}
]

export function parseRWAFlowOverlayMetrics(values: readonly string[]): RWAFlowOverlayMetric[] {
	if (values.length === 0) return ['onChainMcap']
	if (values.includes('none')) return []

	const selected: RWAFlowOverlayMetric[] = []
	for (const option of RWA_FLOW_OVERLAY_OPTIONS) {
		if (values.includes(option.key)) selected.push(option.key)
	}
	return selected
}

export function getRWAFlowOverlayQueryValue(values: readonly string[]): string | string[] | undefined {
	if (values.length === 0) return 'none'
	const metrics = parseRWAFlowOverlayMetrics(values)
	if (metrics.length === 1 && metrics[0] === 'onChainMcap') return undefined
	return metrics.length > 0 ? metrics : 'none'
}

export const RWA_FLOW_MODE_OPTIONS = [
	{
		value: 'daily' as const,
		label: 'D',
		ariaLabel: definitions.flows.daily.label,
		tooltip: definitions.flows.daily.description
	},
	{ value: 'weekly' as const, label: 'W', ariaLabel: 'Weekly', tooltip: 'Weekly' },
	{ value: 'monthly' as const, label: 'M', ariaLabel: 'Monthly', tooltip: 'Monthly' },
	{ value: 'quarterly' as const, label: 'Q', ariaLabel: 'Quarterly', tooltip: 'Quarterly' },
	{ value: 'yearly' as const, label: 'Y', ariaLabel: 'Yearly', tooltip: 'Yearly' },
	{
		value: 'cumulative' as const,
		label: 'C',
		ariaLabel: definitions.flows.cumulative.label,
		tooltip: definitions.flows.cumulative.description
	},
	{
		value: 'flowVsPrice' as const,
		label: definitions.flows.flowVsPrice.label,
		tooltip: definitions.flows.flowVsPrice.description
	}
]

export function parseRWAFlowMode(value: string | undefined, allowFlowVsPrice: boolean): RWAFlowChartMode {
	if (allowFlowVsPrice && value === 'flowVsPrice') return value
	return parseRWAFlowGrouping(value)
}

export function parseRWAFlowGrouping(value: string | undefined): RWAFlowGrouping {
	if (
		value === 'weekly' ||
		value === 'monthly' ||
		value === 'quarterly' ||
		value === 'yearly' ||
		value === 'cumulative'
	) {
		return value
	}
	return 'daily'
}

export type RWAFlowSeriesPoint = IRWAFlowPoint | IRWAFlowAggregatePoint

export type RWAFlowChart = {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
	groupBy: ChartTimeGrouping
}

export type RWAFlowVsPriceSummary = {
	mcapChange: number
	netCapital: number
	price: number
	flowDrivenPct: number | null
}

export type RWAFlowRotationChart = {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
	groupBy: RWAFlowGrouping
}

export const RWA_FLOW_COLORS = {
	inflow: '#3fb950',
	outflow: '#f85149',
	level: '#4f9fff',
	cumulative: '#a98cff',
	change: '#98a2b3'
} as const

export function aggregateRWAFlowRows(
	rows: IRWAFlowAssetBreakdownRow[],
	assets: IRWAAssetsOverview['assets']
): IRWAFlowAggregatePoint[] {
	const selectedIds = new Set<string>()
	for (const asset of assets) {
		if (asset.kind === 'spot') selectedIds.add(asset.canonicalMarketId)
	}

	return rows.map((row) => {
		let netFlowUsd = 0
		let hasFlow = false
		for (const id of selectedIds) {
			const value = row[id]
			if (typeof value !== 'number' || !Number.isFinite(value)) continue
			netFlowUsd += value
			hasFlow = true
		}
		return { timestamp: row.timestamp, netFlowUsd: hasFlow ? netFlowUsd : null, coverage: hasFlow ? 1 : 0 }
	})
}

function getFlowChainKey(assetId: string, chain: string): string {
	return `chain:${encodeURIComponent(assetId)}:${encodeURIComponent(chain)}`
}

export function buildRWAFilteredFlowBreakdown(
	rows: IRWAFlowAssetBreakdownRow[],
	assets: IRWAAssetsOverview['assets'],
	splitBy: 'assetGroup' | 'category' | 'platform' | 'chain'
): IRWAFlowOverviewSplitPoint[] {
	const selectedAssets = assets.filter((asset) => asset.kind === 'spot')
	return rows.map((row) => {
		const result: IRWAFlowOverviewSplitPoint = { timestamp: row.timestamp }
		for (const asset of selectedAssets) {
			if (splitBy === 'chain') {
				for (const chain of asset.chain ?? []) {
					const value = row[getFlowChainKey(asset.canonicalMarketId, chain)]
					if (typeof value === 'number' && Number.isFinite(value)) result[chain] = (result[chain] ?? 0) + value
				}
				continue
			}

			const value = row[asset.canonicalMarketId]
			if (typeof value !== 'number' || !Number.isFinite(value)) continue
			if (splitBy === 'assetGroup') {
				const group = normalizeRwaAssetGroup(asset.assetGroup)
				result[group] = (result[group] ?? 0) + value
				continue
			}
			if (splitBy === 'category') {
				const category = getPrimaryRwaCategory(asset.category)
				if (category) result[category] = (result[category] ?? 0) + value
				continue
			}
			const platforms = getRwaPlatforms(asset.parentPlatform)
			if (platforms.length === 1 && platforms[0] === UNKNOWN_PLATFORM) continue
			const weightedValue = platforms.length > 0 ? value / platforms.length : 0
			for (const platform of platforms) result[platform] = (result[platform] ?? 0) + weightedValue
		}
		return result
	})
}

const INFLOWS = definitions.flows.inflows.label
const OUTFLOWS = definitions.flows.outflows.label
const CUMULATIVE_FLOWS = definitions.flows.cumulativeLegend.label
const NET_CAPITAL_INFLOWS = definitions.flows.netCapitalInflows.label
const NET_CAPITAL_OUTFLOWS = definitions.flows.netCapitalOutflows.label
// mcapChange − measured net flows: price movement PLUS flows on uncovered days — not the token price.
const PRICE = definitions.flows.priceLegend.label
const MCAP_CHANGE = definitions.flows.deltaMcapLegend.label
const DAY_MS = 24 * 60 * 60 * 1000

const RWA_FLOW_LEGEND_TOOLTIPS: Record<string, string> = {
	[INFLOWS]: definitions.flows.inflows.description,
	[OUTFLOWS]: definitions.flows.outflows.description,
	[RWA_FLOW_OVERLAY_OPTIONS[0].name]: RWA_FLOW_OVERLAY_OPTIONS[0].help,
	[RWA_FLOW_OVERLAY_OPTIONS[1].name]: RWA_FLOW_OVERLAY_OPTIONS[1].help,
	[RWA_FLOW_OVERLAY_OPTIONS[2].name]: RWA_FLOW_OVERLAY_OPTIONS[2].help,
	[CUMULATIVE_FLOWS]: definitions.flows.cumulativeLegend.description,
	[NET_CAPITAL_INFLOWS]: definitions.flows.netCapitalInflows.description,
	[NET_CAPITAL_OUTFLOWS]: definitions.flows.netCapitalOutflows.description,
	[PRICE]: definitions.flows.priceLegend.description,
	[MCAP_CHANGE]: definitions.flows.deltaMcapLegend.description
}

type FlowPeriod = {
	timestamp: number
	flow: number
	hasFlow: boolean
	mcap: number | null
}

function getFlowMcap(point: RWAFlowSeriesPoint, mcapByTimestamp?: ReadonlyMap<number, number | null>): number | null {
	if ('mcap' in point && point.mcap != null) return point.mcap
	if (!mcapByTimestamp) return null
	return mcapByTimestamp.get(point.timestamp) ?? mcapByTimestamp.get(toUnixMsTimestamp(point.timestamp)) ?? null
}

function getSortedFlowPoints(points: readonly RWAFlowSeriesPoint[]): RWAFlowSeriesPoint[] {
	return [...points].sort((a, b) => a.timestamp - b.timestamp)
}

function getRWAFlowOverlayOption(metric: RWAFlowOverlayMetric) {
	switch (metric) {
		case 'onChainMcap':
			return RWA_FLOW_OVERLAY_OPTIONS[0]
		case 'activeMcap':
			return RWA_FLOW_OVERLAY_OPTIONS[1]
		case 'defiActiveTvl':
			return RWA_FLOW_OVERLAY_OPTIONS[2]
	}
}

function getRWAFlowOverlayValue(point: RWAFlowSeriesPoint, overlay: RWAFlowOverlay): number | null {
	if (overlay.values === null) return getFlowMcap(point)
	return overlay.values.get(point.timestamp) ?? overlay.values.get(toUnixMsTimestamp(point.timestamp)) ?? null
}

function getRWAFlowOverlayDimensions(overlays: readonly RWAFlowOverlay[]): string[] {
	return overlays.map((overlay) => getRWAFlowOverlayOption(overlay.metric).name)
}

function buildRWAFlowOverlayCharts(overlays: readonly RWAFlowOverlay[]): MultiSeriesChart2SeriesConfig[] {
	return overlays.map((overlay) => {
		const option = getRWAFlowOverlayOption(overlay.metric)
		return {
			type: 'line',
			name: option.name,
			encode: { x: 'timestamp', y: option.name },
			color: option.color,
			yAxisIndex: 1,
			hideAreaStyle: true
		}
	})
}

function groupRWAFlowOverlays(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: Exclude<ChartTimeGrouping, 'daily'>,
	overlays: readonly RWAFlowOverlay[]
): RWAFlowOverlay[] {
	const groupedValues = overlays.map(() => new Map<number, number | null>())
	for (const point of getSortedFlowPoints(points)) {
		const timestamp = getBucketTimestampMs(toUnixMsTimestamp(point.timestamp), groupBy)
		for (let index = 0; index < overlays.length; index++) {
			const value = getRWAFlowOverlayValue(point, overlays[index])
			if (value != null) groupedValues[index].set(timestamp, value)
		}
	}
	return overlays.map((overlay, index) => ({ metric: overlay.metric, values: groupedValues[index] }))
}

function buildFlowPeriods(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: ChartTimeGrouping,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): FlowPeriod[] {
	const periods = new Map<number, FlowPeriod>()

	for (const point of getSortedFlowPoints(points)) {
		const timestamp = getBucketTimestampMs(toUnixMsTimestamp(point.timestamp), groupBy)
		let period = periods.get(timestamp)
		if (!period) {
			period = { timestamp, flow: 0, hasFlow: false, mcap: null }
			periods.set(timestamp, period)
		}
		if (point.netFlowUsd != null) {
			period.flow += point.netFlowUsd
			period.hasFlow = true
		}
		const mcap = getFlowMcap(point, mcapByTimestamp)
		if (mcap != null) period.mcap = mcap
	}

	return Array.from(periods.values())
}

export function getRWAFlowChartOptions({
	hasOverlayAxis = false,
	defaultStartTimestamp,
	legendTooltips = false
}: {
	hasOverlayAxis?: boolean
	defaultStartTimestamp?: number
	legendTooltips?: boolean
} = {}) {
	const flowAxis = {
		min: (value: { min: number }) => Math.min(value.min, 0),
		max: (value: { max: number }) => Math.max(value.max, 0)
	}

	return {
		yAxis: hasOverlayAxis ? [flowAxis, { min: 0, alignTicks: false }] : flowAxis,
		...(legendTooltips
			? {
					legend: {
						tooltip: {
							show: true,
							renderMode: 'html',
							className: 'defillama-echarts-tooltip',
							backgroundColor: 'transparent',
							borderWidth: 0,
							extraCssText: 'max-width: 224px; white-space: normal; padding: 8px;',
							formatter: ({ name }: { name: string }) => RWA_FLOW_LEGEND_TOOLTIPS[name] ?? ''
						}
					}
				}
			: {}),
		...(defaultStartTimestamp != null ? { dataZoom: { startValue: defaultStartTimestamp } } : {})
	}
}

export function getRWAFlowDefaultStartTimestamp(
	points: readonly RWAFlowSeriesPoint[],
	defaultRangeDays: number | undefined
): number | undefined {
	if (defaultRangeDays == null) return undefined
	let latestTimestamp = 0
	for (const point of points) latestTimestamp = Math.max(latestTimestamp, toUnixMsTimestamp(point.timestamp))
	return latestTimestamp > 0 ? latestTimestamp - defaultRangeDays * DAY_MS : undefined
}

function buildDailyFlowChart(points: readonly RWAFlowSeriesPoint[], overlays: readonly RWAFlowOverlay[]): RWAFlowChart {
	const source: MultiSeriesChart2Dataset['source'] = []
	const overlayDimensions = getRWAFlowOverlayDimensions(overlays)

	for (const point of getSortedFlowPoints(points)) {
		const flow = point.netFlowUsd
		const row: MultiSeriesChart2Dataset['source'][number] = {
			timestamp: toUnixMsTimestamp(point.timestamp),
			[INFLOWS]: flow != null && flow >= 0 ? flow : null,
			[OUTFLOWS]: flow != null && flow < 0 ? flow : null
		}
		for (let index = 0; index < overlays.length; index++) {
			row[overlayDimensions[index]] = getRWAFlowOverlayValue(point, overlays[index])
		}
		source.push(row)
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', INFLOWS, OUTFLOWS, ...overlayDimensions]
		},
		charts: [
			{
				type: 'bar',
				name: INFLOWS,
				stack: 'flows',
				encode: { x: 'timestamp', y: INFLOWS },
				color: RWA_FLOW_COLORS.inflow,
				barMaxWidth: 16
			},
			{
				type: 'bar',
				name: OUTFLOWS,
				stack: 'flows',
				encode: { x: 'timestamp', y: OUTFLOWS },
				color: RWA_FLOW_COLORS.outflow,
				barMaxWidth: 16
			},
			...buildRWAFlowOverlayCharts(overlays)
		],
		groupBy: 'daily'
	}
}

function buildCumulativeFlowChart(
	points: readonly RWAFlowSeriesPoint[],
	overlays: readonly RWAFlowOverlay[]
): RWAFlowChart {
	const source: MultiSeriesChart2Dataset['source'] = []
	const overlayDimensions = getRWAFlowOverlayDimensions(overlays)
	let cumulativeFlow: number | null = null

	for (const point of getSortedFlowPoints(points)) {
		if (point.netFlowUsd != null) cumulativeFlow = (cumulativeFlow ?? 0) + point.netFlowUsd
		const row: MultiSeriesChart2Dataset['source'][number] = {
			timestamp: toUnixMsTimestamp(point.timestamp),
			[CUMULATIVE_FLOWS]: cumulativeFlow
		}
		for (let index = 0; index < overlays.length; index++) {
			row[overlayDimensions[index]] = getRWAFlowOverlayValue(point, overlays[index])
		}
		source.push(row)
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', CUMULATIVE_FLOWS, ...overlayDimensions]
		},
		charts: [
			{
				type: 'line',
				name: CUMULATIVE_FLOWS,
				encode: { x: 'timestamp', y: CUMULATIVE_FLOWS },
				color: RWA_FLOW_COLORS.cumulative,
				hideAreaStyle: true
			},
			...buildRWAFlowOverlayCharts(overlays)
		],
		groupBy: 'daily'
	}
}

function buildGroupedFlowChart(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: Exclude<ChartTimeGrouping, 'daily'>,
	overlays: readonly RWAFlowOverlay[]
): RWAFlowChart {
	const groupedPoints: IRWAFlowAggregatePoint[] = []

	for (const period of buildFlowPeriods(points, groupBy)) {
		groupedPoints.push({
			timestamp: period.timestamp,
			netFlowUsd: period.hasFlow ? period.flow : null,
			coverage: period.hasFlow ? 1 : 0
		})
	}

	return {
		...buildDailyFlowChart(groupedPoints, groupRWAFlowOverlays(points, groupBy, overlays)),
		groupBy
	}
}

function buildFlowVsPriceChart(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: ChartTimeGrouping,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowChart {
	const source: MultiSeriesChart2Dataset['source'] = []
	let previousMcap: number | null = null
	for (const period of buildFlowPeriods(points, groupBy, mcapByTimestamp)) {
		const mcapChange = previousMcap != null && period.mcap != null ? period.mcap - previousMcap : null
		const netCapital = mcapChange != null && period.hasFlow ? period.flow : null
		const price = netCapital != null && mcapChange != null ? mcapChange - netCapital : null
		source.push({
			timestamp: period.timestamp,
			[NET_CAPITAL_INFLOWS]: netCapital != null && netCapital >= 0 ? netCapital : null,
			[NET_CAPITAL_OUTFLOWS]: netCapital != null && netCapital < 0 ? netCapital : null,
			[PRICE]: price,
			[MCAP_CHANGE]: mcapChange
		})
		if (period.mcap != null) previousMcap = period.mcap
	}

	return {
		dataset: { source, dimensions: ['timestamp', NET_CAPITAL_INFLOWS, NET_CAPITAL_OUTFLOWS, PRICE, MCAP_CHANGE] },
		charts: [
			{
				type: 'bar',
				name: NET_CAPITAL_INFLOWS,
				stack: 'mcap-change',
				encode: { x: 'timestamp', y: NET_CAPITAL_INFLOWS },
				color: RWA_FLOW_COLORS.inflow,
				barMaxWidth: 22
			},
			{
				type: 'bar',
				name: NET_CAPITAL_OUTFLOWS,
				stack: 'mcap-change',
				encode: { x: 'timestamp', y: NET_CAPITAL_OUTFLOWS },
				color: RWA_FLOW_COLORS.outflow,
				barMaxWidth: 22
			},
			{
				type: 'bar',
				name: PRICE,
				stack: 'mcap-change',
				encode: { x: 'timestamp', y: PRICE },
				color: RWA_FLOW_COLORS.level,
				barMaxWidth: 22
			},
			{
				type: 'line',
				name: MCAP_CHANGE,
				encode: { x: 'timestamp', y: MCAP_CHANGE },
				color: RWA_FLOW_COLORS.change,
				hideAreaStyle: true
			}
		],
		groupBy
	}
}

export function buildRWAFlowChart({
	points,
	selection
}: {
	points: readonly RWAFlowSeriesPoint[]
	selection: RWAFlowChartSelection
}): RWAFlowChart {
	if (selection.view === 'flowVsPrice') {
		return buildFlowVsPriceChart(points, selection.groupBy, selection.mcapByTimestamp ?? undefined)
	}
	if (selection.groupBy === 'cumulative') {
		return buildCumulativeFlowChart(points, selection.overlays)
	}
	if (selection.groupBy === 'daily') return buildDailyFlowChart(points, selection.overlays)
	return buildGroupedFlowChart(points, selection.groupBy, selection.overlays)
}

export function getRWAFlowVsPriceSummary(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: ChartTimeGrouping,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowVsPriceSummary | null {
	const chart = buildFlowVsPriceChart(points, groupBy, mcapByTimestamp)
	let mcapChange = 0
	let netCapital = 0
	let price = 0
	let count = 0

	for (const row of chart.dataset.source) {
		const rowMcapChange = row[MCAP_CHANGE]
		const rowNetCapital = row[NET_CAPITAL_INFLOWS] ?? row[NET_CAPITAL_OUTFLOWS]
		const rowPrice = row[PRICE]
		if (typeof rowMcapChange !== 'number' || typeof rowNetCapital !== 'number' || typeof rowPrice !== 'number') {
			continue
		}
		mcapChange += rowMcapChange
		netCapital += rowNetCapital
		price += rowPrice
		count++
	}

	if (count === 0) return null
	return {
		mcapChange,
		netCapital,
		price,
		flowDrivenPct: mcapChange === 0 ? null : (netCapital / mcapChange) * 100
	}
}

export function buildRWAFlowRotationChart(
	points: readonly IRWAFlowOverviewSplitPoint[],
	groupBy: RWAFlowGrouping
): RWAFlowRotationChart {
	const seriesNames = new Set<string>()
	let latestTimestamp = 0
	for (const point of points) {
		latestTimestamp = Math.max(latestTimestamp, toUnixMsTimestamp(point.timestamp))
		for (const [key, value] of Object.entries(point)) {
			if (key !== 'timestamp' && typeof value === 'number' && Number.isFinite(value)) seriesNames.add(key)
		}
	}

	const flow7d = new Map<string, number>()
	const flow30d = new Map<string, number>()
	const cutoff7d = latestTimestamp - 7 * DAY_MS
	const cutoff30d = latestTimestamp - 30 * DAY_MS
	const buckets = new Map<number, Record<string, number>>()
	for (const point of [...points].sort((a, b) => toUnixMsTimestamp(a.timestamp) - toUnixMsTimestamp(b.timestamp))) {
		const pointTimestamp = toUnixMsTimestamp(point.timestamp)
		const bucketTimestamp = getBucketTimestampMs(pointTimestamp, groupBy === 'cumulative' ? 'daily' : groupBy)
		let bucket = buckets.get(bucketTimestamp)
		if (!bucket) {
			bucket = {}
			buckets.set(bucketTimestamp, bucket)
		}
		for (const [seriesName, value] of Object.entries(point)) {
			if (seriesName === 'timestamp') continue
			if (typeof value !== 'number' || !Number.isFinite(value)) continue
			bucket[seriesName] = (bucket[seriesName] ?? 0) + value
			if (pointTimestamp > cutoff30d) flow30d.set(seriesName, (flow30d.get(seriesName) ?? 0) + value)
			if (pointTimestamp > cutoff7d) flow7d.set(seriesName, (flow7d.get(seriesName) ?? 0) + value)
		}
	}

	const orderedSeriesNames = Array.from(seriesNames).sort((a, b) => {
		const flow7dDifference = Math.abs(flow7d.get(b) ?? 0) - Math.abs(flow7d.get(a) ?? 0)
		if (flow7dDifference !== 0) return flow7dDifference
		const flow30dDifference = Math.abs(flow30d.get(b) ?? 0) - Math.abs(flow30d.get(a) ?? 0)
		return flow30dDifference !== 0 ? flow30dDifference : a.localeCompare(b)
	})

	const source: MultiSeriesChart2Dataset['source'] = []
	const cumulativeFlow = new Map<string, number>()
	for (const [timestamp, bucket] of buckets) {
		const row: MultiSeriesChart2Dataset['source'][number] = { timestamp }
		for (const seriesName of orderedSeriesNames) {
			const value = bucket[seriesName]
			if (groupBy === 'cumulative' && value != null) {
				cumulativeFlow.set(seriesName, (cumulativeFlow.get(seriesName) ?? 0) + value)
			}
			row[seriesName] = groupBy === 'cumulative' ? (cumulativeFlow.get(seriesName) ?? null) : (value ?? null)
		}
		source.push(row)
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...orderedSeriesNames] },
		charts: orderedSeriesNames.map((name, index) => ({
			type: groupBy === 'cumulative' ? 'line' : 'bar',
			name,
			...(groupBy === 'cumulative' ? { hideAreaStyle: true } : { stack: 'capital-rotation' }),
			encode: { x: 'timestamp', y: name },
			color: CHART_COLORS[index % CHART_COLORS.length],
			...(groupBy === 'cumulative' ? {} : { barMaxWidth: 24 })
		})),
		groupBy
	}
}

export function getRWAFlowTextClass(value: number | null | undefined): string {
	if (value == null || value === 0) return 'text-primary'
	return value > 0 ? 'text-data-up' : 'text-data-down'
}

export function formatSignedRWAFlow(value: number | null | undefined): string {
	if (value == null) return '-'
	const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
	return `${prefix}${formattedNum(Math.abs(value), true)}`
}
