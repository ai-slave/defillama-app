import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { CHART_COLORS } from '~/constants/colors'
import type { IRWAFlowAggregatePoint } from '../api.types'
import { isRwaTotalSeriesLabel, type RWAPositionalChartDataset } from '../chartDataset'
import { definitions } from '../definitions'
import type { RWAPlatformMilestone } from '../PlatformPage/api.types'

/* The entity chart of a platform page: the platform as one series per metric, the protocol page's Add Metrics
   pattern over the series the page already folds. Pure: the panel feeds it datasets and reads series back. */

export type RWAPlatformChartMetricKey =
	| 'activeMcap'
	| 'onChainMcap'
	| 'defiActiveTvl'
	| 'netFlows'
	| 'inflows'
	| 'outflows'
	| 'cumulativeNetFlows'
	| 'utilization'
	| 'activeShare'
	| 'liveAssets'
	| 'topAssetShare'
	| 'events'

export type RWAPlatformChartGroup = 'Core' | 'Flows' | 'Ratios' | 'Assets' | 'Annotations'

export type RWAPlatformChartMetric = {
	key: RWAPlatformChartMetricKey
	label: string
	group: RWAPlatformChartGroup
	description: string
}

/** Axis 0 money levels, 1 money flows, 2 percent, 3 counts: a level and a flow on one axis would squash the flow. */
const MONEY_AXIS = 0
const FLOW_AXIS = 1
const PERCENT_AXIS = 2
const COUNT_AXIS = 3

const GREEN = '#3fb950'
const RED = '#f85149'

export const RWA_PLATFORM_CHART_METRICS: ReadonlyArray<RWAPlatformChartMetric> = [
	{ key: 'activeMcap', label: 'Active AUM', group: 'Core', description: definitions.activeMcap.description },
	{ key: 'onChainMcap', label: 'Onchain AUM', group: 'Core', description: definitions.onChainMcap.description },
	{ key: 'defiActiveTvl', label: 'DeFi Active TVL', group: 'Core', description: definitions.defiActiveTvl.description },
	{ key: 'netFlows', label: 'Net Flows', group: 'Flows', description: definitions.flows.assetNetFlows.description },
	{ key: 'inflows', label: 'Inflows', group: 'Flows', description: definitions.flows.inflows.description },
	{ key: 'outflows', label: 'Outflows', group: 'Flows', description: definitions.flows.outflows.description },
	{
		key: 'cumulativeNetFlows',
		label: 'Cumulative Net Flows',
		group: 'Flows',
		description: definitions.flows.cumulativeLegend.description
	},
	{
		key: 'utilization',
		label: 'Utilization',
		group: 'Ratios',
		description: 'DeFi Active TVL as a share of active AUM.'
	},
	{
		key: 'activeShare',
		label: 'Active / Onchain',
		group: 'Ratios',
		description: 'Active mcap as a share of onchain AUM.'
	},
	{
		key: 'liveAssets',
		label: 'Live Assets',
		group: 'Assets',
		description: 'Assets with active AUM above zero on the day.'
	},
	{
		key: 'topAssetShare',
		label: 'Top Asset Share',
		group: 'Assets',
		description: "The largest asset's share of the platform's active AUM on the day."
	},
	{
		key: 'events',
		label: 'Events',
		group: 'Annotations',
		description: 'The milestones the index records, marked on the time axis.'
	}
]

export const RWA_PLATFORM_CHART_DEFAULT_METRICS: ReadonlyArray<RWAPlatformChartMetricKey> = ['activeMcap']
export const RWA_PLATFORM_CHART_METRICS_QUERY_KEY = 'metrics'

const METRIC_KEYS = RWA_PLATFORM_CHART_METRICS.map((metric) => metric.key)

function isMetricKey(value: string): value is RWAPlatformChartMetricKey {
	return (METRIC_KEYS as Array<string>).includes(value)
}

/** `?metrics=a,b` in catalogue order; unknown keys drop; nothing selected means the default. */
export function parseRwaPlatformChartMetrics(
	value: string | Array<string> | undefined
): Array<RWAPlatformChartMetricKey> {
	const raw = (Array.isArray(value) ? value : value ? [value] : []).flatMap((entry) => entry.split(','))
	const wanted = new Set(raw.map((entry) => entry.trim()).filter(isMetricKey))
	const selected = METRIC_KEYS.filter((key) => wanted.has(key))
	return selected.length > 0 ? selected : [...RWA_PLATFORM_CHART_DEFAULT_METRICS]
}

/** The default and an empty selection both stay out of the URL: the chart never draws nothing. */
export function getRwaPlatformChartMetricsQuery(
	selected: ReadonlyArray<RWAPlatformChartMetricKey>
): string | undefined {
	const ordered = METRIC_KEYS.filter((key) => selected.includes(key))
	const isDefault =
		ordered.length === 0 ||
		(ordered.length === RWA_PLATFORM_CHART_DEFAULT_METRICS.length &&
			ordered.every((key, index) => key === RWA_PLATFORM_CHART_DEFAULT_METRICS[index]))
	return isDefault ? undefined : ordered.join(',')
}

export type RWAPlatformChartPoints = Array<[timestamp: number, value: number | null]>
export type RWAPlatformChartPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type RWAPlatformChartInputs = {
	activeMcap: RWAPlatformChartPoints
	onChainMcap: RWAPlatformChartPoints
	defiActiveTvl: RWAPlatformChartPoints
	/** Active mcap per asset, one column each; the counts and shares read it. Null until it is loaded. */
	perAsset: RWAPositionalChartDataset | null
	/** The platform's daily net flow, seconds timestamps as the flows api sends them. */
	flows: Array<IRWAFlowAggregatePoint> | null
	milestones: Array<RWAPlatformMilestone>
	period: RWAPlatformChartPeriod
}

export type RWAPlatformEntityChart = {
	series: Array<MultiSeriesChartSeriesConfig>
	hallmarks: Array<[number, string]>
}

/** The Total column of a folded dataset as points, for the panel to hand in. */
export function getRwaDatasetPoints(dataset: RWAPositionalChartDataset, column: string): RWAPlatformChartPoints {
	const index = dataset.dimensions.indexOf(column)
	if (index <= 0) return []
	return dataset.source.map((row) => [row[0], row[index] ?? null])
}

function definedPoints(points: RWAPlatformChartPoints): Array<[number, number]> {
	const out: Array<[number, number]> = []
	for (const [timestamp, value] of points) if (value != null) out.push([timestamp, value])
	return out
}

function ratio(numerator: RWAPlatformChartPoints, denominator: RWAPlatformChartPoints): Array<[number, number]> {
	const byTimestamp = new Map<number, number>()
	for (const [timestamp, value] of denominator) if (value) byTimestamp.set(timestamp, value)
	const out: Array<[number, number]> = []
	for (const [timestamp, value] of numerator) {
		const base = byTimestamp.get(timestamp)
		if (value != null && base) out.push([timestamp, (value / base) * 100])
	}
	return out
}

function flowPoints(flows: Array<IRWAFlowAggregatePoint> | null): Array<[number, number]> {
	const out: Array<[number, number]> = []
	for (const point of flows ?? []) {
		if (point.netFlowUsd == null) continue
		const timestamp = point.timestamp < 1e12 ? point.timestamp * 1000 : point.timestamp
		out.push([timestamp, point.netFlowUsd])
	}
	return out
}

/** Bars sum per bucket; a bucket with no measured day is left out, unknown is not zero. */
function bucketed(points: Array<[number, number]>, period: RWAPlatformChartPeriod): Array<[number, number]> {
	if (period === 'daily') return points
	const sums = new Map<number, number>()
	for (const [timestamp, value] of points) {
		const bucket = getBucketTimestampMs(timestamp, period)
		sums.set(bucket, (sums.get(bucket) ?? 0) + value)
	}
	return Array.from(sums, ([timestamp, value]) => [timestamp, value] as [number, number]).sort((a, b) => a[0] - b[0])
}

function cumulative(points: Array<[number, number]>): Array<[number, number]> {
	let running = 0
	return points.map(([timestamp, value]) => {
		running += value
		return [timestamp, running]
	})
}

/** The per-asset dataset carries a Total column first; the counts and shares read the asset columns only. */
function assetColumns(perAsset: RWAPositionalChartDataset): Array<number> {
	const columns: Array<number> = []
	for (const [index, name] of perAsset.dimensions.entries()) {
		if (index > 0 && !isRwaTotalSeriesLabel(name)) columns.push(index)
	}
	return columns
}

function liveAssets(perAsset: RWAPositionalChartDataset): Array<[number, number]> {
	const columns = assetColumns(perAsset)
	return perAsset.source.map((row) => {
		let count = 0
		for (const index of columns) if ((row[index] ?? 0) > 0) count += 1
		return [row[0], count]
	})
}

function topAssetShare(perAsset: RWAPositionalChartDataset): Array<[number, number]> {
	const columns = assetColumns(perAsset)
	const out: Array<[number, number]> = []
	for (const row of perAsset.source) {
		let total = 0
		let top = 0
		for (const index of columns) {
			const value = row[index] ?? 0
			total += value
			if (value > top) top = value
		}
		if (total > 0) out.push([row[0], (top / total) * 100])
	}
	return out
}

/** A milestone dated YYYY-MM or YYYY-MM-DD becomes a hallmark at the start of that period, UTC. */
export function getRwaMilestoneHallmarks(milestones: Array<RWAPlatformMilestone>): Array<[number, string]> {
	const hallmarks: Array<[number, string]> = []
	for (const milestone of milestones) {
		const match = milestone.date?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
		if (!match) continue
		const [, year, month, day] = match
		hallmarks.push([Date.UTC(Number(year), Number(month) - 1, day ? Number(day) : 1), milestone.event])
	}
	return hallmarks.sort((a, b) => a[0] - b[0])
}

function line(
	name: string,
	data: Array<[number, number]>,
	{ axis, color, symbol, fill }: { axis: number; color: string; symbol: string; fill?: boolean }
): MultiSeriesChartSeriesConfig {
	return {
		type: 'line',
		name,
		encode: { x: 0, y: 1 },
		data,
		color,
		yAxisIndex: axis,
		valueSymbol: symbol,
		...(fill ? {} : { hideAreaStyle: true })
	}
}

function bar(name: string, data: Array<[number, number]>, color: string): MultiSeriesChartSeriesConfig {
	return {
		type: 'bar',
		name,
		encode: { x: 0, y: 1 },
		data,
		color,
		yAxisIndex: FLOW_AXIS,
		valueSymbol: '$',
		large: false
	}
}

/** One series per selected metric, in catalogue order; a metric whose data is not there yet draws nothing. */
export function buildRwaPlatformEntityChart(
	selected: ReadonlyArray<RWAPlatformChartMetricKey>,
	inputs: RWAPlatformChartInputs
): RWAPlatformEntityChart {
	const series: Array<MultiSeriesChartSeriesConfig> = []
	const flows = flowPoints(inputs.flows)
	const label = (key: RWAPlatformChartMetricKey) =>
		RWA_PLATFORM_CHART_METRICS.find((metric) => metric.key === key)!.label
	for (const key of METRIC_KEYS) {
		if (!selected.includes(key)) continue
		switch (key) {
			case 'activeMcap':
				series.push(
					line(label(key), definedPoints(inputs.activeMcap), {
						axis: MONEY_AXIS,
						color: CHART_COLORS[0],
						symbol: '$',
						fill: true
					})
				)
				break
			case 'onChainMcap':
				series.push(
					line(label(key), definedPoints(inputs.onChainMcap), {
						axis: MONEY_AXIS,
						color: CHART_COLORS[6] ?? CHART_COLORS[1],
						symbol: '$'
					})
				)
				break
			case 'defiActiveTvl':
				series.push(
					line(label(key), definedPoints(inputs.defiActiveTvl), {
						axis: MONEY_AXIS,
						color: CHART_COLORS[3],
						symbol: '$'
					})
				)
				break
			case 'netFlows':
				series.push(bar(label(key), bucketed(flows, inputs.period), CHART_COLORS[4]))
				break
			case 'inflows':
				series.push(
					bar(
						label(key),
						bucketed(
							flows.filter(([, value]) => value > 0),
							inputs.period
						),
						GREEN
					)
				)
				break
			case 'outflows':
				series.push(
					bar(
						label(key),
						bucketed(
							flows.filter(([, value]) => value < 0),
							inputs.period
						),
						RED
					)
				)
				break
			case 'cumulativeNetFlows':
				series.push(line(label(key), cumulative(flows), { axis: FLOW_AXIS, color: CHART_COLORS[1], symbol: '$' }))
				break
			case 'utilization':
				series.push(
					line(label(key), ratio(inputs.defiActiveTvl, inputs.activeMcap), {
						axis: PERCENT_AXIS,
						color: CHART_COLORS[2],
						symbol: '%'
					})
				)
				break
			case 'activeShare':
				series.push(
					line(label(key), ratio(inputs.activeMcap, inputs.onChainMcap), {
						axis: PERCENT_AXIS,
						color: CHART_COLORS[5],
						symbol: '%'
					})
				)
				break
			case 'liveAssets':
				if (inputs.perAsset)
					series.push(
						line(label(key), liveAssets(inputs.perAsset), {
							axis: COUNT_AXIS,
							color: CHART_COLORS[7] ?? CHART_COLORS[2],
							symbol: ''
						})
					)
				break
			case 'topAssetShare':
				if (inputs.perAsset)
					series.push(
						line(label(key), topAssetShare(inputs.perAsset), {
							axis: PERCENT_AXIS,
							color: CHART_COLORS[8] ?? CHART_COLORS[1],
							symbol: '%'
						})
					)
				break
			case 'events':
				break
			default:
				assertNever(key)
		}
	}
	return { series, hallmarks: selected.includes('events') ? getRwaMilestoneHallmarks(inputs.milestones) : [] }
}

function assertNever(value: never): never {
	throw new Error(`Unexpected metric ${String(value)}`)
}

/** The series as one wide table for the csv: a row per timestamp any series has, blanks where a series has none. */
export function buildRwaPlatformEntityCsvDataset(series: Array<MultiSeriesChartSeriesConfig>): {
	dimensions: Array<string>
	source: Array<Array<number | null>>
} {
	const timestamps = new Set<number>()
	const columns = series.map((entry) => new Map((entry.data ?? []).map(([timestamp, value]) => [timestamp, value])))
	for (const column of columns) for (const timestamp of column.keys()) timestamps.add(timestamp)
	const source = Array.from(timestamps)
		.sort((a, b) => a - b)
		.map((timestamp) => [timestamp, ...columns.map((column) => column.get(timestamp) ?? null)])
	return { dimensions: ['timestamp', ...series.map((entry) => entry.name)], source }
}
