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
	charts: Array<MultiSeriesChartSeriesConfig>
	valueSymbol: '$'
	stacked: boolean
	showTotalInTooltip: boolean
	availableSeries?: Array<string>
}

interface StablecoinVolumeChartOptions {
	/** `null` is reserved for user-requested complete exports. */
	limit?: number | null
	trimIncompleteTail?: boolean
	selectedNames?: Array<string> | null
	excludedNames?: Array<string> | null
}

export type StablecoinVolumeChartSource =
	| { chart: 'total'; data: Array<StablecoinVolumeTotalChartPoint> }
	| {
			chart: Exclude<StablecoinVolumeChartKind, 'total'>
			data: Array<StablecoinVolumeBreakdownChartPoint>
	  }

type StablecoinVolumeChartInput = StablecoinVolumeChartSource & StablecoinVolumeChartOptions

const DEFAULT_BREAKDOWN_LIMIT = 20
const MAX_BREAKDOWN_LIMIT = 50
const TOTAL_VOLUME_NAME = 'Volume'
const OTHERS_NAME = 'Others'

const formatDimensionLabel = (key: string, chart: StablecoinVolumeChartKind): string => {
	if (chart === 'token' || chart === 'currency') return key.toUpperCase()
	return key
}

const clampLimit = (limit: number | null | undefined, seriesCount: number): number => {
	if (limit === null) return seriesCount
	if (limit == null) return DEFAULT_BREAKDOWN_LIMIT
	return Math.min(MAX_BREAKDOWN_LIMIT, limit)
}

const buildCharts = (
	names: Array<string>,
	stacked: boolean,
	colorIndexByName?: ReadonlyMap<string, number>
): Array<MultiSeriesChartSeriesConfig> => {
	const charts: Array<MultiSeriesChartSeriesConfig> = []
	for (const [index, name] of names.entries()) {
		const colorIndex = (colorIndexByName?.get(name) ?? index) % CHART_COLORS.length
		charts.push({
			type: 'bar',
			name,
			encode: { x: 'timestamp', y: name },
			color: name === OTHERS_NAME ? '#AAAAAA' : (CHART_COLORS[colorIndex] ?? CHART_COLORS[0]),
			barMinWidth: 1,
			barMaxWidth: 24,
			...(stacked ? { stack: 'stablecoin-volume', large: false } : {})
		})
	}
	return charts
}

const hasBreakdownVolume = (breakdown: Record<string, number>): boolean => {
	for (const key in breakdown) {
		const value = breakdown[key]
		if (value !== undefined && value !== 0) return true
	}
	return false
}

const getLastCompletePointIndex = (data: StablecoinVolumeChartResponse, trimIncompleteTail: boolean): number => {
	if (!trimIncompleteTail) return data.length - 1
	// The volume APIs can append an unfinished all-zero bucket. Keep interior zeroes, but avoid a false trailing cliff.
	return data.findLastIndex((point) => {
		const value = point[1]
		return typeof value === 'number' ? value !== 0 : hasBreakdownVolume(value)
	})
}

const buildTotalVolumePayload = (
	data: Array<StablecoinVolumeTotalChartPoint>,
	trimIncompleteTail: boolean
): StablecoinVolumeChartPayload => {
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	const lastCompletePointIndex = getLastCompletePointIndex(data, trimIncompleteTail)
	for (const [index, point] of data.entries()) {
		if (index > lastCompletePointIndex) break
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
	points: Array<StablecoinVolumeBreakdownChartPoint>,
	lastCompletePointIndex: number
): Record<string, number> => {
	for (let i = lastCompletePointIndex; i >= 0; i--) {
		const breakdown = points[i]?.[1]
		if (breakdown && hasBreakdownVolume(breakdown)) return breakdown
	}
	return {}
}

const getRankedBreakdownKeys = (
	points: Array<StablecoinVolumeBreakdownChartPoint>,
	lastCompletePointIndex: number
): Array<string> => {
	const latest = getLatestBreakdown(points, lastCompletePointIndex)
	const keys: Array<string> = []
	const seen = new Set<string>()
	for (const [index, point] of points.entries()) {
		if (index > lastCompletePointIndex) break
		for (const key in point[1]) {
			if (seen.has(key)) continue
			seen.add(key)
			keys.push(key)
		}
	}
	const originalOrder = new Map(keys.map((key, index) => [key, index]))
	keys.sort((a, b) => {
		const valueDifference = (latest[b] ?? 0) - (latest[a] ?? 0)
		if (valueDifference !== 0) return valueDifference
		const aOrder = originalOrder.get(a)
		const bOrder = originalOrder.get(b)
		return aOrder !== undefined && bOrder !== undefined ? aOrder - bOrder : 0
	})
	return keys
}

const buildBreakdownVolumePayload = (
	points: Array<StablecoinVolumeBreakdownChartPoint>,
	options: StablecoinVolumeChartOptions & { chart: Exclude<StablecoinVolumeChartKind, 'total'> }
): StablecoinVolumeChartPayload => {
	const lastCompletePointIndex = getLastCompletePointIndex(points, options.trimIncompleteTail === true)
	const rankedKeys = getRankedBreakdownKeys(points, lastCompletePointIndex)
	const rankedSeries = rankedKeys.map((key) => ({ key, label: formatDimensionLabel(key, options.chart) }))
	const availableSeries = rankedSeries.map((series) => series.label)
	const colorIndexByName = new Map(availableSeries.map((name, index) => [name, index]))
	// A pick list that names nothing here follows the default, as `resolveLocalSelection` shows it on the client.
	const selectedSet =
		options.selectedNames == null ||
		(options.selectedNames.length > 0 && !options.selectedNames.some((name) => availableSeries.includes(name)))
			? null
			: new Set(options.selectedNames)
	// So does an exclusion that leaves nothing.
	const excludedNames = options.excludedNames
	const excludedSet =
		excludedNames == null || availableSeries.every((name) => excludedNames.includes(name))
			? null
			: new Set(excludedNames)
	const selectedSeries = selectedSet
		? rankedSeries.filter((series) => selectedSet.has(series.label))
		: excludedSet
			? rankedSeries.filter((series) => !excludedSet.has(series.label))
			: rankedSeries
	const limit = clampLimit(options.limit, selectedSeries.length)
	const series = selectedSeries.slice(0, limit)
	const omittedSeries = selectedSeries.slice(limit)
	const dimensions: MultiSeriesTimeSeriesDataset['dimensions'] = ['timestamp']
	for (const selected of series) dimensions.push(selected.label)
	const includeOthers = omittedSeries.length > 0
	let hasOthersValue = false

	const omittedKeys = new Set(omittedSeries.map((item) => item.key))
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	for (const [index, point] of points.entries()) {
		if (index > lastCompletePointIndex) break
		const [timestamp, breakdown] = point
		const row: MultiSeriesTimeSeriesDataset['source'][number] = [timestamp * 1e3]
		row.length = series.length + 2
		for (const [seriesIndex, selected] of series.entries()) {
			row[seriesIndex + 1] = breakdown[selected.key] ?? 0
		}

		if (includeOthers) {
			let others = 0
			for (const key in breakdown) {
				const value = breakdown[key]
				if (value !== undefined && omittedKeys.has(key)) others += value
			}
			if (others > 0) hasOthersValue = true
			row[series.length + 1] = others
		}

		source.push(row)
	}

	if (includeOthers && hasOthersValue) dimensions.push(OTHERS_NAME)
	if (!hasOthersValue) {
		for (const row of source) row.length = dimensions.length
	}

	const seriesNames: Array<string> = []
	for (let i = 1; i < dimensions.length; i++) {
		const dimension = dimensions[i]
		if (dimension) seriesNames.push(dimension)
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

export const buildStablecoinVolumeChartPayload = (input: StablecoinVolumeChartInput): StablecoinVolumeChartPayload => {
	if (input.chart === 'total') {
		return buildTotalVolumePayload(input.data, input.trimIncompleteTail === true)
	}
	return buildBreakdownVolumePayload(input.data, input)
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
