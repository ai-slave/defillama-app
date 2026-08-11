import type {
	ChartTimeGrouping,
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesDataset
} from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { CHART_COLORS } from '~/constants/colors'
import { formatUsd } from '~/utils/numberFormat'
import { rwaUnixSecondsToMilliseconds } from './api'
import type {
	IRWAAssetsOverview,
	IRWAChartMetricRows,
	IRWAFlowAggregatePoint,
	IRWAFlowAssetBreakdownRow,
	IRWAFlowOverviewSplitPoint,
	IRWAFlowPoint,
	IRWAFlowPointWithMcap,
	RWAChartMetricKey
} from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { definitions } from './definitions'
import { getPrimaryRwaCategory } from './grouping'

export type RWAFlowGrouping = ChartTimeGroupingWithCumulative
export type RWAFlowOverlayMetric = RWAChartMetricKey
type RWAFlowOverlayValues = ReadonlyMap<number, number | null>
export type RWAFlowOverlay =
	| { metric: RWAFlowOverlayMetric; values: RWAFlowOverlayValues }
	| { metric: 'onChainMcap'; values: null }
type RWAGroupedFlowOverlay = { metric: RWAFlowOverlayMetric; values: Map<number, number | null> }
export type RWAFlowChartSelection =
	| { view: 'netFlows'; groupBy: RWAFlowGrouping; overlays: readonly RWAFlowOverlay[] }
	| { view: 'flowVsPrice'; groupBy: RWAFlowGrouping; mcapByTimestamp: RWAFlowOverlayValues | null }

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
		color: CHART_COLORS[4] ?? CHART_COLORS[0]
	},
	{
		key: 'defiActiveTvl' as const,
		name: definitions.flows.defiActiveTvl.label,
		help: definitions.flows.defiActiveTvl.description,
		color: CHART_COLORS[3] ?? CHART_COLORS[0]
	}
] as const

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

const FLOW_GROUPING_TOOLTIP =
	'One bar per day, week, month, quarter, or year. Periods we could not measure are left blank, because unknown is not the same as zero.'

export const RWA_FLOW_GROUPING_OPTIONS = [
	{
		value: 'daily' as const,
		label: 'D',
		ariaLabel: definitions.flows.daily.label,
		tooltip: FLOW_GROUPING_TOOLTIP
	},
	{ value: 'weekly' as const, label: 'W', ariaLabel: 'Weekly', tooltip: FLOW_GROUPING_TOOLTIP },
	{ value: 'monthly' as const, label: 'M', ariaLabel: 'Monthly', tooltip: FLOW_GROUPING_TOOLTIP },
	{ value: 'quarterly' as const, label: 'Q', ariaLabel: 'Quarterly', tooltip: FLOW_GROUPING_TOOLTIP },
	{ value: 'yearly' as const, label: 'Y', ariaLabel: 'Yearly', tooltip: FLOW_GROUPING_TOOLTIP },
	{
		value: 'cumulative' as const,
		label: 'C',
		ariaLabel: definitions.flows.cumulative.label,
		tooltip: definitions.flows.cumulative.description
	}
] as const

export function parseRWAFlowGrouping(
	value: string | undefined,
	defaultGrouping: RWAFlowGrouping = 'daily'
): RWAFlowGrouping {
	if (
		value === 'daily' ||
		value === 'weekly' ||
		value === 'monthly' ||
		value === 'quarterly' ||
		value === 'yearly' ||
		value === 'cumulative'
	) {
		return value
	}
	return defaultGrouping
}

export type RWAFlowQueryState = {
	view: 'netFlows' | 'flowVsPrice' | null
	groupBy: RWAFlowGrouping
}

function getRWAFlowDefaultGrouping(view: RWAFlowQueryState['view']): RWAFlowGrouping {
	return view === 'flowVsPrice' ? 'weekly' : 'daily'
}

export function getRWAFlowModeQueryValue(
	groupBy: RWAFlowGrouping,
	view: RWAFlowQueryState['view']
): RWAFlowGrouping | undefined {
	return groupBy === getRWAFlowDefaultGrouping(view) ? undefined : groupBy
}

export type RWAFlowVisibleRange = {
	start: number
	end: number
}

export function parseRWAFlowQueryState(
	chartType: string | undefined,
	flowMode: string | undefined,
	allowFlowVsPrice: boolean
): RWAFlowQueryState {
	const view =
		allowFlowVsPrice && chartType === 'flowVsPrice' ? 'flowVsPrice' : chartType === 'flows' ? 'netFlows' : null
	return {
		view,
		groupBy: parseRWAFlowGrouping(flowMode, getRWAFlowDefaultGrouping(view))
	}
}

export type RWAFlowSeriesPoint = IRWAFlowPoint | IRWAFlowPointWithMcap | IRWAFlowAggregatePoint
type RWAFlowChartSource = Array<[timestamp: number, ...values: Array<number | null>]>

export type RWAFlowChart = {
	dataset: Omit<MultiSeriesChartDataset, 'source'> & { source: RWAFlowChartSource }
	charts: MultiSeriesChartSeriesConfig[]
	groupBy: RWAFlowGrouping
}

export type RWAFlowVsPriceSummary = {
	mcapChange: number
	netCapital: number
	price: number
	flowDrivenPct: number | null
}

export type RWAFlowVsPriceAssetSummary = {
	key: string
	label: string
	summary: RWAFlowVsPriceSummary
}

export type RWAFlowRotationChart = {
	dataset: MultiSeriesTimeSeriesDataset
	charts: MultiSeriesChartSeriesConfig[]
	groupBy: RWAFlowGrouping
}

const MAX_FLOW_ROTATION_SERIES = 30

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
	const selectedIdSet = new Set<string>()
	for (const asset of assets) {
		if (asset.kind === 'spot') selectedIdSet.add(asset.canonicalMarketId)
	}
	const selectedIds = Array.from(selectedIdSet)

	const points: IRWAFlowAggregatePoint[] = []
	for (const row of rows) {
		let netFlowUsd = 0
		let hasFlow = false
		for (const id of selectedIds) {
			const value = row[id]
			if (value == null) continue
			netFlowUsd += value
			hasFlow = true
		}
		points.push({ timestamp: row.timestamp, netFlowUsd: hasFlow ? netFlowUsd : null, coverage: hasFlow ? 1 : 0 })
	}
	return points
}

function getFlowChainKey(assetId: string, chain: string): string {
	return `chain:${encodeURIComponent(assetId)}:${encodeURIComponent(chain)}`
}

export function buildRWAFilteredFlowBreakdown(
	rows: IRWAFlowAssetBreakdownRow[],
	assets: IRWAAssetsOverview['assets'],
	splitBy: 'assetGroup' | 'category' | 'platform' | 'chain'
): IRWAFlowOverviewSplitPoint[] {
	const plans: Array<{ sourceKey: string; target: string }> = []
	const platformPlans: Array<{ sourceKey: string; target: string }> = []
	for (const asset of assets) {
		if (asset.kind !== 'spot') continue
		if (splitBy === 'chain') {
			for (const chain of asset.chain ?? []) {
				plans.push({ sourceKey: getFlowChainKey(asset.canonicalMarketId, chain), target: chain })
			}
			continue
		}

		if (splitBy === 'assetGroup') {
			plans.push({ sourceKey: asset.canonicalMarketId, target: normalizeRwaAssetGroup(asset.assetGroup) })
			continue
		}

		if (splitBy === 'category') {
			const category = getPrimaryRwaCategory(asset.category)
			if (category) {
				plans.push({ sourceKey: asset.canonicalMarketId, target: category })
			}
			continue
		}

		const platform = asset.parentPlatform?.trim()
		if (!platform) continue
		platformPlans.push({
			sourceKey: asset.canonicalMarketId,
			target: platform
		})
	}

	// Resolve grouping labels and encoded chain lookup keys once; the same plan is reused for every timestamp.
	const breakdown: IRWAFlowOverviewSplitPoint[] = []
	for (const row of rows) {
		const result: IRWAFlowOverviewSplitPoint = { timestamp: row.timestamp }
		if (splitBy === 'platform') {
			for (const plan of platformPlans) {
				const value = row[plan.sourceKey]
				if (value == null) continue
				result[plan.target] = (result[plan.target] ?? 0) + value
			}
		} else {
			for (const plan of plans) {
				const value = row[plan.sourceKey]
				if (value == null) continue
				result[plan.target] = (result[plan.target] ?? 0) + value
			}
		}
		breakdown.push(result)
	}
	return breakdown
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
	return mcapByTimestamp.get(rwaUnixSecondsToMilliseconds(point.timestamp)) ?? null
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
	return overlay.values.get(rwaUnixSecondsToMilliseconds(point.timestamp)) ?? null
}

function getRWAFlowOverlayDimensions(overlays: readonly RWAFlowOverlay[]): string[] {
	return overlays.map((overlay) => getRWAFlowOverlayOption(overlay.metric).name)
}

function buildRWAFlowOverlayCharts(
	overlays: readonly RWAFlowOverlay[],
	firstDimensionIndex: number
): MultiSeriesChartSeriesConfig[] {
	return overlays.map((overlay, index) => {
		const option = getRWAFlowOverlayOption(overlay.metric)
		return {
			type: 'line',
			name: option.name,
			encode: { x: 0, y: firstDimensionIndex + index },
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
): RWAGroupedFlowOverlay[] {
	const plans = overlays.map((overlay) => ({
		overlay,
		grouped: { metric: overlay.metric, values: new Map<number, number | null>() }
	}))
	for (const point of points) {
		const timestamp = getBucketTimestampMs(rwaUnixSecondsToMilliseconds(point.timestamp), groupBy)
		for (const plan of plans) {
			const value = getRWAFlowOverlayValue(point, plan.overlay)
			if (value != null) plan.grouped.values.set(timestamp, value)
		}
	}
	return plans.map((plan) => plan.grouped)
}

function buildFlowPeriods(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: ChartTimeGrouping,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): FlowPeriod[] {
	const periods = new Map<number, FlowPeriod>()

	for (const point of points) {
		const timestamp = getBucketTimestampMs(rwaUnixSecondsToMilliseconds(point.timestamp), groupBy)
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
	// Flow endpoints return ascending points; the chart builders preserve that order.
	const latestPoint = points[points.length - 1]
	const latestTimestamp = latestPoint ? rwaUnixSecondsToMilliseconds(latestPoint.timestamp) : 0
	return latestTimestamp > 0 ? latestTimestamp - defaultRangeDays * DAY_MS : undefined
}

function buildDailyFlowChart(points: readonly RWAFlowSeriesPoint[], overlays: readonly RWAFlowOverlay[]): RWAFlowChart {
	const source: RWAFlowChartSource = []
	const overlayDimensions = getRWAFlowOverlayDimensions(overlays)

	for (const point of points) {
		const flow = point.netFlowUsd
		const row: RWAFlowChartSource[number] = [
			rwaUnixSecondsToMilliseconds(point.timestamp),
			flow != null && flow >= 0 ? flow : null,
			flow != null && flow < 0 ? flow : null
		]
		for (const [index, overlay] of overlays.entries()) {
			row[index + 3] = getRWAFlowOverlayValue(point, overlay)
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
				encode: { x: 0, y: 1 },
				color: RWA_FLOW_COLORS.inflow,
				barMaxWidth: 16
			},
			{
				type: 'bar',
				name: OUTFLOWS,
				stack: 'flows',
				encode: { x: 0, y: 2 },
				color: RWA_FLOW_COLORS.outflow,
				barMaxWidth: 16
			},
			...buildRWAFlowOverlayCharts(overlays, 3)
		],
		groupBy: 'daily'
	}
}

function buildCumulativeFlowChart(
	points: readonly RWAFlowSeriesPoint[],
	overlays: readonly RWAFlowOverlay[]
): RWAFlowChart {
	const source: RWAFlowChartSource = []
	const overlayDimensions = getRWAFlowOverlayDimensions(overlays)
	let cumulativeFlow: number | null = null

	for (const point of points) {
		if (point.netFlowUsd != null) cumulativeFlow = (cumulativeFlow ?? 0) + point.netFlowUsd
		const row: RWAFlowChartSource[number] = [rwaUnixSecondsToMilliseconds(point.timestamp), cumulativeFlow]
		for (const [index, overlay] of overlays.entries()) {
			row[index + 2] = getRWAFlowOverlayValue(point, overlay)
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
				encode: { x: 0, y: 1 },
				color: RWA_FLOW_COLORS.cumulative,
				hideAreaStyle: true
			},
			...buildRWAFlowOverlayCharts(overlays, 2)
		],
		groupBy: 'daily'
	}
}

function buildGroupedFlowChart(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: Exclude<ChartTimeGrouping, 'daily'>,
	overlays: readonly RWAFlowOverlay[]
): RWAFlowChart {
	const source: RWAFlowChartSource = []
	const groupedOverlays = groupRWAFlowOverlays(points, groupBy, overlays)

	for (const period of buildFlowPeriods(points, groupBy)) {
		const flow = period.hasFlow ? period.flow : null
		const row: RWAFlowChartSource[number] = [
			period.timestamp,
			flow != null && flow >= 0 ? flow : null,
			flow != null && flow < 0 ? flow : null
		]
		let dimensionIndex = 3
		for (const overlay of groupedOverlays) {
			row[dimensionIndex] = overlay.values.get(period.timestamp) ?? null
			dimensionIndex++
		}
		source.push(row)
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', INFLOWS, OUTFLOWS, ...getRWAFlowOverlayDimensions(groupedOverlays)]
		},
		charts: [
			{
				type: 'bar',
				name: INFLOWS,
				stack: 'flows',
				encode: { x: 0, y: 1 },
				color: RWA_FLOW_COLORS.inflow,
				barMaxWidth: 16
			},
			{
				type: 'bar',
				name: OUTFLOWS,
				stack: 'flows',
				encode: { x: 0, y: 2 },
				color: RWA_FLOW_COLORS.outflow,
				barMaxWidth: 16
			},
			...buildRWAFlowOverlayCharts(groupedOverlays, 3)
		],
		groupBy
	}
}

function buildFlowVsPriceChart(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: RWAFlowGrouping,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowChart {
	const source = buildFlowVsPriceSource(points, groupBy, mcapByTimestamp)

	return {
		dataset: { source, dimensions: ['timestamp', NET_CAPITAL_INFLOWS, NET_CAPITAL_OUTFLOWS, PRICE, MCAP_CHANGE] },
		charts: [
			{
				type: 'bar',
				name: NET_CAPITAL_INFLOWS,
				stack: 'mcap-change',
				encode: { x: 0, y: 1 },
				color: RWA_FLOW_COLORS.inflow,
				barMaxWidth: 22
			},
			{
				type: 'bar',
				name: NET_CAPITAL_OUTFLOWS,
				stack: 'mcap-change',
				encode: { x: 0, y: 2 },
				color: RWA_FLOW_COLORS.outflow,
				barMaxWidth: 22
			},
			{
				type: 'bar',
				name: PRICE,
				stack: 'mcap-change',
				encode: { x: 0, y: 3 },
				color: RWA_FLOW_COLORS.level,
				barMaxWidth: 22
			},
			{
				type: 'line',
				name: MCAP_CHANGE,
				encode: { x: 0, y: 4 },
				color: RWA_FLOW_COLORS.change,
				hideAreaStyle: true
			}
		],
		groupBy
	}
}

function buildFlowVsPriceSource(
	points: readonly RWAFlowSeriesPoint[],
	groupBy: RWAFlowGrouping,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowChartSource {
	const source: RWAFlowChartSource = []
	let previousMcap: number | null = null
	let cumulativeMcapChange = 0
	let cumulativeNetCapital = 0
	let pendingFlow = 0
	let hasPendingFlow = false
	const periodGroupBy = groupBy === 'cumulative' ? 'daily' : groupBy
	for (const period of buildFlowPeriods(points, periodGroupBy, mcapByTimestamp)) {
		if (period.hasFlow) {
			pendingFlow += period.flow
			hasPendingFlow = true
		}

		const mcapChange = previousMcap != null && period.mcap != null ? period.mcap - previousMcap : null
		const netCapital = mcapChange != null && hasPendingFlow ? pendingFlow : null
		const price = mcapChange != null ? mcapChange - (netCapital ?? 0) : null
		if (groupBy === 'cumulative' && mcapChange != null) {
			cumulativeMcapChange += mcapChange
			if (netCapital != null) cumulativeNetCapital += netCapital
		}
		const displayedNetCapital = groupBy === 'cumulative' && mcapChange != null ? cumulativeNetCapital : netCapital
		const displayedMcapChange = groupBy === 'cumulative' && mcapChange != null ? cumulativeMcapChange : mcapChange
		const displayedPrice =
			groupBy === 'cumulative' && mcapChange != null ? cumulativeMcapChange - cumulativeNetCapital : price
		source.push([
			period.timestamp,
			displayedNetCapital != null && displayedNetCapital >= 0 ? displayedNetCapital : null,
			displayedNetCapital != null && displayedNetCapital < 0 ? displayedNetCapital : null,
			displayedPrice,
			displayedMcapChange
		])
		if (period.mcap != null) {
			previousMcap = period.mcap
			pendingFlow = 0
			hasPendingFlow = false
		}
	}

	return source
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

function summarizeRWAFlowVsPriceSource(
	source: RWAFlowChartSource,
	groupBy: RWAFlowGrouping,
	visibleRange?: RWAFlowVisibleRange | null
): RWAFlowVsPriceSummary | null {
	let startIndex = 0
	let endIndex = source.length
	if (visibleRange) {
		let low = 0
		let high = source.length
		while (low < high) {
			const middle = (low + high) >>> 1
			if (source[middle]![0] < visibleRange.start) low = middle + 1
			else high = middle
		}
		startIndex = low

		low = startIndex
		high = source.length
		while (low < high) {
			const middle = (low + high) >>> 1
			if (source[middle]![0] <= visibleRange.end) low = middle + 1
			else high = middle
		}
		endIndex = low
	}

	if (groupBy === 'cumulative') {
		for (let index = endIndex - 1; index >= startIndex; index--) {
			const row = source[index]!
			const mcapChange = row[4]
			const price = row[3]
			if (typeof mcapChange !== 'number' || typeof price !== 'number') continue
			const netCapital = typeof row[1] === 'number' ? row[1] : typeof row[2] === 'number' ? row[2] : 0
			let baselineMcapChange = 0
			let baselineNetCapital = 0
			let baselinePrice = 0
			if (visibleRange) {
				for (let baselineIndex = startIndex - 1; baselineIndex >= 0; baselineIndex--) {
					const baselineRow = source[baselineIndex]!
					if (typeof baselineRow[4] !== 'number' || typeof baselineRow[3] !== 'number') continue
					baselineMcapChange = baselineRow[4]
					baselineNetCapital =
						typeof baselineRow[1] === 'number'
							? baselineRow[1]
							: typeof baselineRow[2] === 'number'
								? baselineRow[2]
								: 0
					baselinePrice = baselineRow[3]
					break
				}
			}
			const visibleMcapChange = mcapChange - baselineMcapChange
			const visibleNetCapital = netCapital - baselineNetCapital
			const visiblePrice = price - baselinePrice
			return {
				mcapChange: visibleMcapChange,
				netCapital: visibleNetCapital,
				price: visiblePrice,
				flowDrivenPct:
					visibleMcapChange === 0 ? null : visibleNetCapital === 0 ? 0 : (visibleNetCapital / visibleMcapChange) * 100
			}
		}
		return null
	}

	let mcapChange = 0
	let netCapital = 0
	let price = 0
	let count = 0

	for (let index = startIndex; index < endIndex; index++) {
		const row = source[index]!
		const rowMcapChange = row[4]
		const rowNetCapital = row[1] ?? row[2] ?? 0
		const rowPrice = row[3]
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
		flowDrivenPct: mcapChange === 0 ? null : netCapital === 0 ? 0 : (netCapital / mcapChange) * 100
	}
}

export function getRWAFlowVsPriceSummary(
	chart: RWAFlowChart,
	visibleRange?: RWAFlowVisibleRange | null
): RWAFlowVsPriceSummary | null {
	return summarizeRWAFlowVsPriceSource(chart.dataset.source, chart.groupBy, visibleRange)
}

export function getRWAFlowVsPriceAssetSummaries(
	flowRows: readonly IRWAFlowAssetBreakdownRow[],
	mcapRows: IRWAChartMetricRows,
	assets: IRWAAssetsOverview['assets'],
	groupBy: RWAFlowGrouping,
	visibleRange?: RWAFlowVisibleRange | null
): RWAFlowVsPriceAssetSummary[] {
	const selectedAssets: Array<{
		key: string
		label: string
		points: IRWAFlowAggregatePoint[]
		mcap: Map<number, number>
	}> = []
	for (const asset of assets) {
		if (asset.kind !== 'spot') continue
		selectedAssets.push({
			key: asset.canonicalMarketId,
			label: asset.assetName,
			points: [],
			mcap: new Map()
		})
	}

	const mcapRowsByTimestamp = new Map<number, IRWAChartMetricRows[number]>()
	for (const row of mcapRows) mcapRowsByTimestamp.set(row.timestamp, row)
	for (const row of flowRows) {
		const timestampMs = rwaUnixSecondsToMilliseconds(row.timestamp)
		const mcapRow = mcapRowsByTimestamp.get(timestampMs)
		for (const asset of selectedAssets) {
			const flow = row[asset.key]
			asset.points.push({ timestamp: row.timestamp, netFlowUsd: flow ?? null, coverage: flow == null ? 0 : 1 })
			const mcap = mcapRow?.[asset.key]
			if (mcap != null) asset.mcap.set(timestampMs, mcap)
		}
	}

	const summaries: RWAFlowVsPriceAssetSummary[] = []
	for (const asset of selectedAssets) {
		const source = buildFlowVsPriceSource(asset.points, groupBy, asset.mcap)
		const summary = summarizeRWAFlowVsPriceSource(source, groupBy, visibleRange)
		if (summary) summaries.push({ key: asset.key, label: asset.label, summary })
	}
	return summaries
}

export function sortRWAFlowRotationSeriesNames(
	seriesNames: ReadonlySet<string>,
	flow7d: ReadonlyMap<string, number>,
	flow30d: ReadonlyMap<string, number>
): string[] {
	return Array.from(seriesNames).sort((a, b) => {
		const flow7dDifference = Math.abs(flow7d.get(b) ?? 0) - Math.abs(flow7d.get(a) ?? 0)
		if (flow7dDifference !== 0) return flow7dDifference
		const flow30dDifference = Math.abs(flow30d.get(b) ?? 0) - Math.abs(flow30d.get(a) ?? 0)
		return flow30dDifference !== 0 ? flow30dDifference : a.localeCompare(b)
	})
}

export function getRWAFlowRotationSeriesNames(points: readonly IRWAFlowOverviewSplitPoint[]): string[] {
	const seriesNames = new Set<string>()
	const latestPoint = points[points.length - 1]
	const latestTimestamp = latestPoint ? rwaUnixSecondsToMilliseconds(latestPoint.timestamp) : 0
	const flow7d = new Map<string, number>()
	const flow30d = new Map<string, number>()
	const cutoff7d = latestTimestamp - 7 * DAY_MS
	const cutoff30d = latestTimestamp - 30 * DAY_MS
	for (const point of points) {
		const pointTimestamp = rwaUnixSecondsToMilliseconds(point.timestamp)
		for (const name in point) {
			if (name === 'timestamp') continue
			seriesNames.add(name)
			const value = point[name]
			if (value === undefined) continue
			if (pointTimestamp > cutoff30d) flow30d.set(name, (flow30d.get(name) ?? 0) + value)
			if (pointTimestamp > cutoff7d) flow7d.set(name, (flow7d.get(name) ?? 0) + value)
		}
	}

	return sortRWAFlowRotationSeriesNames(seriesNames, flow7d, flow30d)
}

export function buildRWAFlowRotationChart(
	points: readonly IRWAFlowOverviewSplitPoint[],
	groupBy: RWAFlowGrouping,
	options: { allSeries?: boolean } = {}
): RWAFlowRotationChart {
	const seriesNames = new Set<string>()
	const latestPoint = points[points.length - 1]
	const latestTimestamp = latestPoint ? rwaUnixSecondsToMilliseconds(latestPoint.timestamp) : 0
	const flow7d = new Map<string, number>()
	const flow30d = new Map<string, number>()
	const cutoff7d = latestTimestamp - 7 * DAY_MS
	const cutoff30d = latestTimestamp - 30 * DAY_MS
	const buckets = new Map<number, Map<string, number>>()
	for (const point of points) {
		const pointTimestamp = rwaUnixSecondsToMilliseconds(point.timestamp)
		const bucketTimestamp = getBucketTimestampMs(pointTimestamp, groupBy === 'cumulative' ? 'daily' : groupBy)
		let bucket = buckets.get(bucketTimestamp)
		if (!bucket) {
			bucket = new Map()
			buckets.set(bucketTimestamp, bucket)
		}
		for (const seriesName in point) {
			if (seriesName === 'timestamp') continue
			const value = point[seriesName]
			if (value === undefined) continue
			seriesNames.add(seriesName)
			bucket.set(seriesName, (bucket.get(seriesName) ?? 0) + value)
			if (pointTimestamp > cutoff30d) flow30d.set(seriesName, (flow30d.get(seriesName) ?? 0) + value)
			if (pointTimestamp > cutoff7d) flow7d.set(seriesName, (flow7d.get(seriesName) ?? 0) + value)
		}
	}

	const allSeriesNames = sortRWAFlowRotationSeriesNames(seriesNames, flow7d, flow30d)
	let orderedSeriesNames = allSeriesNames
	let omittedSeriesNames: string[] = []
	if (!options.allSeries && allSeriesNames.length > MAX_FLOW_ROTATION_SERIES) {
		const rankedWithoutOthers = allSeriesNames.filter((name) => name !== 'Others')
		orderedSeriesNames = rankedWithoutOthers.slice(0, MAX_FLOW_ROTATION_SERIES - 1)
		const displayedSet = new Set(orderedSeriesNames)
		omittedSeriesNames = allSeriesNames.filter((name) => !displayedSet.has(name))
		orderedSeriesNames.push('Others')
	}

	const source: MultiSeriesTimeSeriesDataset['source'] = []
	const cumulativeFlow = new Map<string, number>()
	for (const [timestamp, bucket] of buckets) {
		const row: MultiSeriesTimeSeriesDataset['source'][number] = [timestamp]
		row.length = orderedSeriesNames.length + 1
		for (const [seriesIndex, seriesName] of orderedSeriesNames.entries()) {
			let value = bucket.get(seriesName)
			if (seriesName === 'Others' && omittedSeriesNames.length > 0) {
				let total = 0
				let hasValue = false
				for (const omittedName of omittedSeriesNames) {
					const omittedValue = bucket.get(omittedName)
					if (omittedValue == null) continue
					total += omittedValue
					hasValue = true
				}
				value = hasValue ? total : undefined
			}
			if (groupBy === 'cumulative' && value != null) {
				cumulativeFlow.set(seriesName, (cumulativeFlow.get(seriesName) ?? 0) + value)
			}
			row[seriesIndex + 1] = groupBy === 'cumulative' ? (cumulativeFlow.get(seriesName) ?? null) : (value ?? null)
		}
		source.push(row)
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...orderedSeriesNames] },
		charts: orderedSeriesNames.map((name, index) => ({
			type: groupBy === 'cumulative' ? 'line' : 'bar',
			name,
			...(groupBy === 'cumulative' ? { hideAreaStyle: true } : { stack: 'capital-rotation' }),
			encode: { x: 0, y: index + 1 },
			color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0],
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
	return `${prefix}${formatUsd(Math.abs(value), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
}
