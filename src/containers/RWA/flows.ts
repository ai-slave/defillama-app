import type {
	ChartTimeGrouping,
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
	IRWAFlowPoint
} from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { getPrimaryRwaCategory, getRwaPlatforms, UNKNOWN_PLATFORM } from './grouping'

export type RWAFlowChartMode = 'daily' | 'cumulative' | 'flowVsPrice'
export type RWAFlowRotationFrequency = Extract<ChartTimeGrouping, 'weekly' | 'monthly'>

export const RWA_FLOW_MODE_OPTIONS = [
	{ value: 'daily' as const, label: 'Daily' },
	{ value: 'cumulative' as const, label: 'Cumulative' },
	{ value: 'flowVsPrice' as const, label: 'Flow vs price' }
]

export function parseRWAFlowMode(value: string | undefined, allowFlowVsPrice: boolean): RWAFlowChartMode {
	if (value === 'cumulative') return value
	if (allowFlowVsPrice && value === 'flowVsPrice') return value
	return 'daily'
}

export type RWAFlowSeriesPoint = IRWAFlowPoint | IRWAFlowAggregatePoint

export type RWAFlowChart = {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
	groupBy: 'daily' | 'monthly'
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
	groupBy: RWAFlowRotationFrequency
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

const INFLOWS = 'Inflows'
const OUTFLOWS = 'Outflows'
const CUMULATIVE_FLOWS = 'Cumulative Net Flows'
const ONCHAIN_MCAP = 'Onchain Mcap'
const NET_CAPITAL_INFLOWS = 'Net Capital Inflows'
const NET_CAPITAL_OUTFLOWS = 'Net Capital Outflows'
// mcapChange − measured net flows: price movement PLUS flows on uncovered days — not the token price.
const PRICE = 'Price & Unattributed'
const MCAP_CHANGE = 'Delta Onchain Mcap'
const DAY_MS = 24 * 60 * 60 * 1000

type FlowMonth = {
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

export function getRWAFlowChartOptions() {
	return {
		yAxis: {
			min: (value: any) => Math.min(value.min, 0),
			max: (value: any) => Math.max(value.max, 0)
		}
	}
}

function buildDailyFlowChart(
	points: readonly RWAFlowSeriesPoint[],
	showMcapOverlay: boolean,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowChart {
	const source: MultiSeriesChart2Dataset['source'] = []

	for (const point of getSortedFlowPoints(points)) {
		const flow = point.netFlowUsd
		source.push({
			timestamp: toUnixMsTimestamp(point.timestamp),
			[INFLOWS]: flow != null && flow >= 0 ? flow : null,
			[OUTFLOWS]: flow != null && flow < 0 ? flow : null,
			...(showMcapOverlay ? { [ONCHAIN_MCAP]: getFlowMcap(point, mcapByTimestamp) } : {})
		})
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', INFLOWS, OUTFLOWS, ...(showMcapOverlay ? [ONCHAIN_MCAP] : [])]
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
			...(showMcapOverlay
				? [
						{
							type: 'line' as const,
							name: ONCHAIN_MCAP,
							encode: { x: 'timestamp', y: ONCHAIN_MCAP },
							color: RWA_FLOW_COLORS.level,
							yAxisIndex: 1,
							hideAreaStyle: true
						}
					]
				: [])
		],
		groupBy: 'daily'
	}
}

function buildCumulativeFlowChart(
	points: readonly RWAFlowSeriesPoint[],
	showMcapOverlay: boolean,
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowChart {
	const source: MultiSeriesChart2Dataset['source'] = []
	let cumulativeFlow: number | null = null

	for (const point of getSortedFlowPoints(points)) {
		if (point.netFlowUsd != null) cumulativeFlow = (cumulativeFlow ?? 0) + point.netFlowUsd
		source.push({
			timestamp: toUnixMsTimestamp(point.timestamp),
			[CUMULATIVE_FLOWS]: cumulativeFlow,
			...(showMcapOverlay ? { [ONCHAIN_MCAP]: getFlowMcap(point, mcapByTimestamp) } : {})
		})
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', CUMULATIVE_FLOWS, ...(showMcapOverlay ? [ONCHAIN_MCAP] : [])]
		},
		charts: [
			{
				type: 'line',
				name: CUMULATIVE_FLOWS,
				encode: { x: 'timestamp', y: CUMULATIVE_FLOWS },
				color: RWA_FLOW_COLORS.cumulative,
				hideAreaStyle: true
			},
			...(showMcapOverlay
				? [
						{
							type: 'line' as const,
							name: ONCHAIN_MCAP,
							encode: { x: 'timestamp', y: ONCHAIN_MCAP },
							color: RWA_FLOW_COLORS.level,
							yAxisIndex: 1,
							hideAreaStyle: true
						}
					]
				: [])
		],
		groupBy: 'daily'
	}
}

function buildFlowVsPriceChart(
	points: readonly RWAFlowSeriesPoint[],
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowChart {
	const months = new Map<number, FlowMonth>()

	for (const point of getSortedFlowPoints(points)) {
		const timestamp = getBucketTimestampMs(toUnixMsTimestamp(point.timestamp), 'monthly')
		let month = months.get(timestamp)
		if (!month) {
			month = { timestamp, flow: 0, hasFlow: false, mcap: null }
			months.set(timestamp, month)
		}
		if (point.netFlowUsd != null) {
			month.flow += point.netFlowUsd
			month.hasFlow = true
		}
		const mcap = getFlowMcap(point, mcapByTimestamp)
		if (mcap != null) month.mcap = mcap
	}

	const source: MultiSeriesChart2Dataset['source'] = []
	let previousMcap: number | null = null
	for (const month of months.values()) {
		const mcapChange = previousMcap != null && month.mcap != null ? month.mcap - previousMcap : null
		const netCapital = mcapChange != null && month.hasFlow ? month.flow : null
		const price = netCapital != null && mcapChange != null ? mcapChange - netCapital : null
		source.push({
			timestamp: month.timestamp,
			[NET_CAPITAL_INFLOWS]: netCapital != null && netCapital >= 0 ? netCapital : null,
			[NET_CAPITAL_OUTFLOWS]: netCapital != null && netCapital < 0 ? netCapital : null,
			[PRICE]: price,
			[MCAP_CHANGE]: mcapChange
		})
		if (month.mcap != null) previousMcap = month.mcap
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
		groupBy: 'monthly'
	}
}

export function buildRWAFlowChart({
	points,
	mode,
	showMcapOverlay = true,
	mcapByTimestamp
}: {
	points: readonly RWAFlowSeriesPoint[]
	mode: RWAFlowChartMode
	showMcapOverlay?: boolean
	mcapByTimestamp?: ReadonlyMap<number, number | null>
}): RWAFlowChart {
	if (mode === 'cumulative') return buildCumulativeFlowChart(points, showMcapOverlay, mcapByTimestamp)
	if (mode === 'flowVsPrice') return buildFlowVsPriceChart(points, mcapByTimestamp)
	return buildDailyFlowChart(points, showMcapOverlay, mcapByTimestamp)
}

export function getRWAFlowVsPriceSummary(
	points: readonly RWAFlowSeriesPoint[],
	mcapByTimestamp?: ReadonlyMap<number, number | null>
): RWAFlowVsPriceSummary | null {
	const chart = buildFlowVsPriceChart(points, mcapByTimestamp)
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
	groupBy: RWAFlowRotationFrequency
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
		const bucketTimestamp = getBucketTimestampMs(pointTimestamp, groupBy)
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
	for (const [timestamp, bucket] of buckets) {
		const row: MultiSeriesChart2Dataset['source'][number] = { timestamp }
		for (const seriesName of orderedSeriesNames) row[seriesName] = bucket[seriesName] ?? null
		source.push(row)
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...orderedSeriesNames] },
		charts: orderedSeriesNames.map((name, index) => ({
			type: 'bar',
			name,
			stack: 'capital-rotation',
			encode: { x: 'timestamp', y: name },
			color: CHART_COLORS[index % CHART_COLORS.length],
			barMaxWidth: 24
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
