import { createChartRow } from '~/components/ECharts/dynamicRow'
import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChart2Dataset,
	MultiSeriesChart2SeriesConfig
} from '~/components/ECharts/types'
import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/utils'
import { CHART_COLORS } from '~/constants/colors'
import type {
	StablecoinVolumeBreakdownChartPoint,
	StablecoinVolumeChartKind,
	StablecoinVolumeChartResponse,
	StablecoinVolumeTotalChartPoint
} from './api.types'
import { getGroupedBarCharts } from './chartGrouping'

export interface StablecoinVolumeChartPayload {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
	valueSymbol: '$'
	stacked: boolean
	showTotalInTooltip: boolean
}

interface StablecoinVolumeChartOptions {
	chart: StablecoinVolumeChartKind
	limit?: number
	trimIncompleteTail?: boolean
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

const buildCharts = (names: string[], stacked: boolean): MultiSeriesChart2SeriesConfig[] => {
	const charts: MultiSeriesChart2SeriesConfig[] = []
	for (let i = 0; i < names.length; i++) {
		const name = names[i]
		charts.push({
			type: 'bar',
			name,
			encode: { x: 'timestamp', y: name },
			color: CHART_COLORS[i % CHART_COLORS.length],
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
	const source: MultiSeriesChart2Dataset['source'] = []
	const lastCompletePointIndex = getLastCompletePointIndex(data, trimIncompleteTail)
	for (let i = 0; i <= lastCompletePointIndex; i++) {
		const point = data[i]
		source.push({
			timestamp: point[0] * 1e3,
			[TOTAL_VOLUME_NAME]: point[1]
		})
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

const getTopBreakdownKeys = (
	points: StablecoinVolumeBreakdownChartPoint[],
	lastCompletePointIndex: number,
	limit: number
): string[] => {
	const latest = getLatestBreakdown(points, lastCompletePointIndex)
	const entries: Array<{ key: string; value: number }> = []
	for (const key in latest) {
		const value = latest[key]
		if (value > 0) entries.push({ key, value })
	}
	entries.sort((a, b) => b.value - a.value)
	const keys: string[] = []
	for (let i = 0; i < entries.length && i < limit; i++) {
		keys.push(entries[i].key)
	}
	return keys
}

const buildBreakdownVolumePayload = (
	data: StablecoinVolumeChartResponse,
	options: StablecoinVolumeChartOptions
): StablecoinVolumeChartPayload => {
	const points = data as StablecoinVolumeBreakdownChartPoint[]
	const lastCompletePointIndex = getLastCompletePointIndex(points, options.trimIncompleteTail === true)
	const keys = getTopBreakdownKeys(points, lastCompletePointIndex, clampLimit(options.limit))
	const labelsByKey = new Map<string, string>()
	const dimensions = ['timestamp']
	for (const key of keys) {
		const label = formatDimensionLabel(key, options.chart)
		labelsByKey.set(key, label)
		dimensions.push(label)
	}
	const includeOthers = keys.length > 0
	let hasOthersValue = false

	const selectedKeysSet = new Set(keys)
	const source: MultiSeriesChart2Dataset['source'] = []
	for (let i = 0; i <= lastCompletePointIndex; i++) {
		const [timestamp, breakdown] = points[i]
		const row = createChartRow<number>(timestamp * 1e3)
		for (const key of keys) {
			const label = labelsByKey.get(key)
			if (!label) continue
			row[label] = breakdown[key] ?? 0
		}

		if (includeOthers) {
			let others = 0
			for (const key in breakdown) {
				if (selectedKeysSet.has(key)) continue
				others += breakdown[key]
			}
			if (others > 0) hasOthersValue = true
			row[OTHERS_NAME] = others
		}

		source.push(row)
	}

	if (includeOthers && hasOthersValue) dimensions.push(OTHERS_NAME)

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
		charts: buildCharts(seriesNames, stacked),
		valueSymbol: '$',
		stacked,
		showTotalInTooltip: stacked
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
