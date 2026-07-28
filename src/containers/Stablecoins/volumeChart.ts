import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/MultiSeriesChart/groupDataset'
import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesDataset
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import type {
	StablecoinVolumeBreakdownChartPoint,
	StablecoinVolumeChartKind,
	StablecoinVolumeChartResponse,
	StablecoinVolumeTotalChartPoint
} from './api.types'
import { getGroupedBarCharts } from './chartGrouping'

export interface StablecoinVolumeChartPayload {
	dataset: MultiSeriesTimeSeriesDataset
	charts: MultiSeriesChartSeriesConfig[]
	valueSymbol: '$'
	stacked: boolean
	showTotalInTooltip: boolean
	availableSeries?: string[]
}

interface StablecoinVolumeChartOptions {
	chart: StablecoinVolumeChartKind
	limit?: number
	trimIncompleteTail?: boolean
	selectedNames?: string[] | null
	excludedNames?: string[] | null
}

const DEFAULT_BREAKDOWN_LIMIT = 20
const MAX_BREAKDOWN_LIMIT = 50
const TOTAL_VOLUME_NAME = 'Volume'
const OTHERS_NAME = 'Others'

const formatDimensionLabel = (key: string, chart: StablecoinVolumeChartKind): string => {
	if (chart === 'token' || chart === 'currency') return key.toUpperCase()
	return key
}

const clampLimit = (limit: number | undefined): number => {
	if (limit == null) return DEFAULT_BREAKDOWN_LIMIT
	return Math.min(MAX_BREAKDOWN_LIMIT, limit)
}

const buildCharts = (
	names: string[],
	stacked: boolean,
	colorIndexByName?: ReadonlyMap<string, number>
): MultiSeriesChartSeriesConfig[] => {
	const charts: MultiSeriesChartSeriesConfig[] = []
	for (let i = 0; i < names.length; i++) {
		const name = names[i]
		charts.push({
			type: 'bar',
			name,
			encode: { x: 'timestamp', y: name },
			color: name === OTHERS_NAME ? '#AAAAAA' : CHART_COLORS[(colorIndexByName?.get(name) ?? i) % CHART_COLORS.length],
			barMinWidth: 1,
			barMaxWidth: 24,
			...(stacked ? { stack: 'stablecoin-volume', large: false } : {})
		})
	}
	return charts
}

const hasBreakdownVolume = (breakdown: Record<string, number>): boolean => {
	for (const key in breakdown) {
		if (breakdown[key] !== 0) return true
	}
	return false
}

const getLastCompletePointIndex = (data: StablecoinVolumeChartResponse, trimIncompleteTail: boolean): number => {
	if (!trimIncompleteTail) return data.length - 1
	// The volume APIs can append an unfinished all-zero bucket. Keep interior zeroes, but avoid a false trailing cliff.
	let index = data.length - 1
	while (index >= 0) {
		const value = data[index][1]
		if (typeof value === 'number' ? value !== 0 : hasBreakdownVolume(value)) break
		index--
	}
	return index
}

const buildTotalVolumePayload = (
	data: StablecoinVolumeTotalChartPoint[],
	trimIncompleteTail: boolean
): StablecoinVolumeChartPayload => {
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	const lastCompletePointIndex = getLastCompletePointIndex(data, trimIncompleteTail)
	for (let i = 0; i <= lastCompletePointIndex; i++) {
		const point = data[i]
		source.push([point[0] * 1e3, point[1]])
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', TOTAL_VOLUME_NAME]
		},
		charts: buildCharts([TOTAL_VOLUME_NAME], false),
		valueSymbol: '$',
		stacked: false,
		showTotalInTooltip: false
	}
}

const getLatestBreakdown = (
	points: StablecoinVolumeBreakdownChartPoint[],
	lastCompletePointIndex: number
): Record<string, number> => {
	for (let i = lastCompletePointIndex; i >= 0; i--) {
		const breakdown = points[i]?.[1]
		if (breakdown && hasBreakdownVolume(breakdown)) return breakdown
	}
	return {}
}

const getRankedBreakdownKeys = (
	points: StablecoinVolumeBreakdownChartPoint[],
	lastCompletePointIndex: number
): string[] => {
	const latest = getLatestBreakdown(points, lastCompletePointIndex)
	const keys: string[] = []
	const seen = new Set<string>()
	for (let i = 0; i <= lastCompletePointIndex; i++) {
		for (const key in points[i][1] as Record<string, number>) {
			if (seen.has(key)) continue
			seen.add(key)
			keys.push(key)
		}
	}
	const originalOrder = new Map(keys.map((key, index) => [key, index]))
	keys.sort((a, b) => (latest[b] ?? 0) - (latest[a] ?? 0) || originalOrder.get(a)! - originalOrder.get(b)!)
	return keys
}

const buildBreakdownVolumePayload = (
	data: StablecoinVolumeChartResponse,
	options: StablecoinVolumeChartOptions
): StablecoinVolumeChartPayload => {
	const points = data as StablecoinVolumeBreakdownChartPoint[]
	const lastCompletePointIndex = getLastCompletePointIndex(points, options.trimIncompleteTail === true)
	const rankedKeys = getRankedBreakdownKeys(points, lastCompletePointIndex)
	const labelsByKey = new Map(rankedKeys.map((key) => [key, formatDimensionLabel(key, options.chart)]))
	const availableSeries = rankedKeys.map((key) => labelsByKey.get(key)!)
	const colorIndexByName = new Map(availableSeries.map((name, index) => [name, index]))
	const selectedSet = options.selectedNames == null ? null : new Set(options.selectedNames)
	const excludedSet = options.excludedNames == null ? null : new Set(options.excludedNames)
	const selectedKeys = selectedSet
		? rankedKeys.filter((key) => selectedSet.has(labelsByKey.get(key)!))
		: excludedSet
			? rankedKeys.filter((key) => !excludedSet.has(labelsByKey.get(key)!))
			: rankedKeys
	const limit = clampLimit(options.limit)
	const keys = selectedKeys.slice(0, limit)
	const omittedKeys = selectedKeys.slice(limit)
	const dimensions: MultiSeriesTimeSeriesDataset['dimensions'] = ['timestamp']
	for (const key of keys) {
		const label = labelsByKey.get(key)!
		dimensions.push(label)
	}
	const includeOthers = omittedKeys.length > 0
	let hasOthersValue = false

	const omittedKeysSet = new Set(omittedKeys)
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	for (let i = 0; i <= lastCompletePointIndex; i++) {
		const [timestamp, breakdown] = points[i]
		const row: MultiSeriesTimeSeriesDataset['source'][number] = [timestamp * 1e3]
		row.length = keys.length + 2
		for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
			row[keyIndex + 1] = breakdown[keys[keyIndex]] ?? 0
		}

		if (includeOthers) {
			let others = 0
			for (const key in breakdown) if (omittedKeysSet.has(key)) others += breakdown[key]
			if (others > 0) hasOthersValue = true
			row[keys.length + 1] = others
		}

		source.push(row)
	}

	if (includeOthers && hasOthersValue) dimensions.push(OTHERS_NAME)
	if (!hasOthersValue) {
		for (const row of source) row.length = dimensions.length
	}

	const seriesNames: string[] = []
	for (let i = 1; i < dimensions.length; i++) {
		seriesNames.push(dimensions[i])
	}
	const stacked = seriesNames.length > 1

	return {
		dataset: {
			source,
			dimensions
		},
		charts: buildCharts(seriesNames, stacked, colorIndexByName),
		valueSymbol: '$',
		stacked,
		showTotalInTooltip: stacked,
		availableSeries
	}
}

export const buildStablecoinVolumeChartPayload = (
	data: StablecoinVolumeChartResponse,
	options: StablecoinVolumeChartOptions
): StablecoinVolumeChartPayload => {
	if (options.chart === 'total') {
		return buildTotalVolumePayload(data as StablecoinVolumeTotalChartPoint[], options.trimIncompleteTail === true)
	}
	return buildBreakdownVolumePayload(data, options)
}

export const groupStablecoinVolumeChartPayload = (
	payload: StablecoinVolumeChartPayload,
	groupBy: ChartTimeGroupingWithCumulative
): StablecoinVolumeChartPayload => {
	if (groupBy === 'daily') return payload

	return {
		...payload,
		dataset: groupMultiSeriesBarChartDataset({ dataset: payload.dataset, groupBy }),
		charts: getGroupedBarCharts(payload.charts, groupBy)
	}
}
