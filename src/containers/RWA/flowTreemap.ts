import { toUnixMsTimestamp } from './api'
import type {
	IRWAAssetsOverview,
	IRWAFlowOverviewSplitPoint,
	RWAChartMetricKey,
	RWAFlowOverviewSplitBy
} from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { sortRWAFlowRotationSeriesNames, type RWAFlowGrouping } from './flows'
import { getPrimaryRwaCategory, getRwaPlatforms, UNKNOWN_PLATFORM } from './grouping'

export type RWAFlowTreemapView = 'bar' | 'heatmap'
export type RWAFlowTreemapSizeMetric = RWAChartMetricKey

export type RWAFlowTreemapSizeRow = {
	name: string
	activeMcap: number
	onChainMcap: number
	defiActiveTvl: number
}

export type RWAFlowTreemapNode = {
	name: string
	value: [number, number | null]
	netFlowUsd: number | null
}

export type RWAFlowTreemapResult = {
	nodes: RWAFlowTreemapNode[]
	excludedSizeCount: number
}

export type RWAFlowTreemapWindowData = {
	flows: Map<string, number>
	orderedNames: string[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const FLOW_WINDOW_DAYS: Record<Exclude<RWAFlowGrouping, 'daily' | 'cumulative'>, number> = {
	weekly: 7,
	monthly: 30,
	quarterly: 90,
	yearly: 365
}

export const RWA_FLOW_TREEMAP_SIZE_OPTIONS: Array<{ key: RWAFlowTreemapSizeMetric; name: string }> = [
	{ key: 'onChainMcap', name: 'Onchain Mcap' },
	{ key: 'activeMcap', name: 'Active Mcap' },
	{ key: 'defiActiveTvl', name: 'DeFi Active TVL' }
]

export const RWA_FLOW_TREEMAP_VIEW_OPTIONS = [
	{ key: 'bar', name: 'Bar Chart' },
	{ key: 'heatmap', name: 'Heatmap Chart' }
]

export function parseRWAFlowTreemapView(value: string | undefined): RWAFlowTreemapView {
	// Keep existing shared links working while emitting the renamed public value.
	return value === 'heatmap' || value === 'treemap' ? 'heatmap' : 'bar'
}

export function parseRWAFlowTreemapSizeMetric(value: string | undefined): RWAFlowTreemapSizeMetric {
	if (value === 'activeMcap' || value === 'defiActiveTvl') return value
	return 'onChainMcap'
}

export function getRWAFlowTreemapPeriodLabel(groupBy: RWAFlowGrouping): string {
	if (groupBy === 'daily') return 'Latest day'
	if (groupBy === 'weekly') return '7d'
	if (groupBy === 'monthly') return '30d'
	if (groupBy === 'quarterly') return '90d'
	if (groupBy === 'yearly') return '365d'
	return 'Cumulative'
}

export function getRWAFlowTreemapSizeLabel(sizeMetric: RWAFlowTreemapSizeMetric): string {
	return RWA_FLOW_TREEMAP_SIZE_OPTIONS.find((option) => option.key === sizeMetric)?.name ?? sizeMetric
}

export function buildRWAFlowTreemapWindowData(
	points: readonly IRWAFlowOverviewSplitPoint[],
	groupBy: RWAFlowGrouping
): RWAFlowTreemapWindowData {
	const seriesNames = new Set<string>()
	const latestPoint = points[points.length - 1]
	const latestTimestamp = latestPoint ? toUnixMsTimestamp(latestPoint.timestamp) : 0

	const flow7d = new Map<string, number>()
	const flow30d = new Map<string, number>()
	const flows = groupBy === 'weekly' ? flow7d : groupBy === 'monthly' ? flow30d : new Map<string, number>()
	const cutoff7d = latestTimestamp - 7 * DAY_MS
	const cutoff30d = latestTimestamp - 30 * DAY_MS
	const windowStart =
		groupBy === 'cumulative'
			? Number.NEGATIVE_INFINITY
			: groupBy === 'daily'
				? latestTimestamp
				: latestTimestamp - FLOW_WINDOW_DAYS[groupBy] * DAY_MS

	for (const point of points) {
		const timestamp = toUnixMsTimestamp(point.timestamp)
		const in7d = timestamp > cutoff7d
		const in30d = timestamp > cutoff30d
		const inSelectedWindow = groupBy === 'daily' ? timestamp === windowStart : timestamp > windowStart
		for (const name in point) {
			if (name === 'timestamp') continue
			seriesNames.add(name)
			const value = point[name]
			if (in30d) flow30d.set(name, (flow30d.get(name) ?? 0) + value)
			if (in7d) flow7d.set(name, (flow7d.get(name) ?? 0) + value)
			if (flows !== flow7d && flows !== flow30d && inSelectedWindow) {
				flows.set(name, (flows.get(name) ?? 0) + value)
			}
		}
	}

	return {
		flows,
		orderedNames: sortRWAFlowRotationSeriesNames(seriesNames, flow7d, flow30d)
	}
}

export function aggregateRWAFlowTreemapWindow(
	points: readonly IRWAFlowOverviewSplitPoint[],
	groupBy: RWAFlowGrouping
): Map<string, number> {
	const latestPoint = points[points.length - 1]
	const latestTimestamp = latestPoint ? toUnixMsTimestamp(latestPoint.timestamp) : 0
	const startTimestamp =
		groupBy === 'cumulative'
			? Number.NEGATIVE_INFINITY
			: groupBy === 'daily'
				? latestTimestamp
				: latestTimestamp - FLOW_WINDOW_DAYS[groupBy] * DAY_MS
	const flows = new Map<string, number>()

	for (const point of points) {
		const timestamp = toUnixMsTimestamp(point.timestamp)
		if (groupBy === 'daily' ? timestamp !== startTimestamp : timestamp <= startTimestamp) continue
		for (const name in point) {
			if (name === 'timestamp') continue
			const value = point[name]
			flows.set(name, (flows.get(name) ?? 0) + value)
		}
	}

	return flows
}

export function buildRWAFlowTreemap({
	flows,
	sizeRows,
	sizeMetric,
	selectedNames
}: {
	flows: ReadonlyMap<string, number>
	sizeRows: readonly RWAFlowTreemapSizeRow[]
	sizeMetric: RWAFlowTreemapSizeMetric
	selectedNames?: ReadonlySet<string>
}): RWAFlowTreemapResult {
	const nodes: RWAFlowTreemapNode[] = []
	let excludedSizeCount = 0

	for (const row of sizeRows) {
		if (selectedNames && !selectedNames.has(row.name)) continue
		const size = row[sizeMetric]
		if (size <= 0) {
			excludedSizeCount++
			continue
		}
		const netFlowUsd = flows.get(row.name) ?? null
		nodes.push({
			name: row.name,
			value: [size, netFlowUsd == null ? null : (netFlowUsd / size) * 100],
			netFlowUsd
		})
	}

	nodes.sort((a, b) => b.value[0] - a.value[0] || a.name.localeCompare(b.name))
	return { nodes, excludedSizeCount }
}

type MutableSizeRow = Omit<RWAFlowTreemapSizeRow, 'name'>

function addSizeValues(rows: Map<string, MutableSizeRow>, name: string, values: MutableSizeRow, weight = 1) {
	if (!name) return
	const row = rows.get(name) ?? { activeMcap: 0, onChainMcap: 0, defiActiveTvl: 0 }
	if (values.activeMcap > 0) row.activeMcap += values.activeMcap * weight
	if (values.onChainMcap > 0) row.onChainMcap += values.onChainMcap * weight
	if (values.defiActiveTvl > 0) row.defiActiveTvl += values.defiActiveTvl * weight
	if (row.activeMcap === 0 && row.onChainMcap === 0 && row.defiActiveTvl === 0) return
	rows.set(name, row)
}

function addSizeValue(
	rows: Map<string, MutableSizeRow>,
	name: string,
	metric: RWAFlowTreemapSizeMetric,
	value: number
) {
	if (!name || value <= 0) return
	const row = rows.get(name) ?? { activeMcap: 0, onChainMcap: 0, defiActiveTvl: 0 }
	row[metric] += value
	rows.set(name, row)
}

function addChainSizeValues(
	rows: Map<string, MutableSizeRow>,
	breakdown: Array<[string, number]>,
	metric: RWAFlowTreemapSizeMetric
) {
	for (const [chain, value] of breakdown) addSizeValue(rows, chain, metric, value)
}

export function buildRWAFlowTreemapSizeRowsFromAssets(
	assets: IRWAAssetsOverview['assets'],
	splitBy: RWAFlowOverviewSplitBy
): RWAFlowTreemapSizeRow[] {
	const rows = new Map<string, MutableSizeRow>()

	for (const asset of assets) {
		if (asset.kind !== 'spot') continue
		if (splitBy === 'chain') {
			addChainSizeValues(rows, asset.activeMcap?.breakdown ?? [], 'activeMcap')
			addChainSizeValues(rows, asset.onChainMcap?.breakdown ?? [], 'onChainMcap')
			addChainSizeValues(rows, asset.defiActiveTvlByChain?.breakdown ?? [], 'defiActiveTvl')
			continue
		}

		const values = {
			activeMcap: asset.activeMcap?.total ?? 0,
			onChainMcap: asset.onChainMcap?.total ?? 0,
			defiActiveTvl: asset.defiActiveTvl?.total ?? 0
		}
		if (splitBy === 'assetGroup') {
			addSizeValues(rows, normalizeRwaAssetGroup(asset.assetGroup), values)
			continue
		}
		if (splitBy === 'category') {
			addSizeValues(rows, getPrimaryRwaCategory(asset.category) ?? '', values)
			continue
		}

		const platforms = getRwaPlatforms(asset.parentPlatform)
		if (platforms.length === 1 && platforms[0] === UNKNOWN_PLATFORM) continue
		const weight = platforms.length > 0 ? 1 / platforms.length : 0
		for (const platform of platforms) addSizeValues(rows, platform, values, weight)
	}

	return Array.from(rows, ([name, values]) => ({ name, ...values }))
}

export function prepareRWAFlowTreemapCsv({
	nodes,
	sizeMetric,
	groupBy,
	filename
}: {
	nodes: readonly RWAFlowTreemapNode[]
	sizeMetric: RWAFlowTreemapSizeMetric
	groupBy: RWAFlowGrouping
	filename: string
}) {
	const sizeLabel = getRWAFlowTreemapSizeLabel(sizeMetric)
	return {
		filename,
		rows: [
			['Name', 'Size Metric', 'Size', 'Window', 'Net Flow', 'Net Flow %'],
			...nodes.map((node) => [
				node.name,
				sizeLabel,
				node.value[0],
				getRWAFlowTreemapPeriodLabel(groupBy),
				node.netFlowUsd ?? '',
				node.value[1] ?? ''
			])
		]
	}
}
