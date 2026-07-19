import { formatChartValue } from '~/components/ECharts/formatters'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import type { ChartConfiguration, ChartDataSeries } from '~/containers/LlamaAI/types'
import {
	buildLogoByCategory,
	getChartColor,
	oldBlue,
	parseStringNumber
} from '~/containers/LlamaAI/utils/chartAdapters/shared'

const normalizeHallmarks = (hallmarks?: Array<[number] | [number, string]>): Array<[number, string]> => {
	if (!hallmarks?.length) return []
	const labels = hallmarks.map((h) => h[1]).filter(Boolean)
	if (labels.length > 1 && labels.every((l) => l === labels[0])) {
		return hallmarks.map((h) => [h[0], ''])
	}
	return hallmarks.map((h) => [h[0], h[1] || ''])
}

export type LlamaAICartesianChartProps = Pick<
	IMultiSeriesChart2Props,
	| 'dataset'
	| 'charts'
	| 'chartOptions'
	| 'valueSymbol'
	| 'groupBy'
	| 'hallmarks'
	| 'hallmarkStyle'
	| 'hideDataZoom'
	| 'categoryLogos'
>

export type LlamaAICartesianDatasetRow = LlamaAICartesianChartProps['dataset']['source'][number]
export type LlamaAICartesianSeriesConfig = NonNullable<LlamaAICartesianChartProps['charts']>[number]

function setCartesianRowValue(row: LlamaAICartesianDatasetRow, name: string, value: number | string | null) {
	if (name === '__proto__') {
		Object.defineProperty(row, name, { value, enumerable: true, configurable: true, writable: true })
	} else {
		row[name] = value
	}
}

export interface LlamaAICartesianSeriesMeta {
	name: string
	seriesIndex: number
	metricClass: 'flow' | 'stock'
	baseType: 'line' | 'area' | 'bar'
	apiColor?: string
	resolvedColor: string
	valueSymbol?: string
	yAxisIndex?: number
	isPrimaryAxis: boolean
	canStack: boolean
	canPercentage: boolean
	canGroup: boolean
}

export interface AdaptedLlamaAICartesianChart {
	chartType: 'cartesian'
	props: LlamaAICartesianChartProps
	title: string
	description: string
	rowCount: number
	axisType: 'time' | 'category'
	isTimeChart: boolean
	hasHallmarks: boolean
	groupingPolicy: 'always' | 'never'
	defaultExportKind: 'cartesian'
	seriesMeta: LlamaAICartesianSeriesMeta[]
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
	jan: 0,
	january: 0,
	feb: 1,
	february: 1,
	mar: 2,
	march: 2,
	apr: 3,
	april: 3,
	may: 4,
	jun: 5,
	june: 5,
	jul: 6,
	july: 6,
	aug: 7,
	august: 7,
	sep: 8,
	sept: 8,
	september: 8,
	oct: 9,
	october: 9,
	nov: 10,
	november: 10,
	dec: 11,
	december: 11
}

const DATE_LIKE_FIELD_RE = /(^|_)(date|day|month|time|timestamp)$/i

const asRecord = (row: unknown): Record<string, unknown> =>
	row && typeof row === 'object' ? (row as Record<string, unknown>) : {}

const parseStrictDateLabelToMs = (timestamp: unknown): number | null => {
	// Be stricter than Date.parse for labels produced by the model; ambiguous
	// strings should stay categorical instead of becoming browser-dependent dates.
	if (typeof timestamp === 'number') {
		if (!Number.isFinite(timestamp)) return null
		return timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp
	}

	if (timestamp instanceof Date) {
		const value = timestamp.getTime()
		return Number.isNaN(value) ? null : value
	}

	if (typeof timestamp !== 'string') return null

	const value = timestamp.trim()
	if (!value) return null

	if (/^\d{10}$/.test(value)) {
		return Number(value) * 1000
	}

	if (/^\d{13}$/.test(value)) {
		return Number(value)
	}

	const isoMonthMatch = value.match(/^(\d{4})-(\d{2})$/)
	if (isoMonthMatch) {
		const year = Number(isoMonthMatch[1])
		const month = Number(isoMonthMatch[2])
		if (month < 1 || month > 12) return null
		return Date.UTC(year, month - 1, 1)
	}

	const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (isoDateMatch) {
		const year = Number(isoDateMatch[1])
		const month = Number(isoDateMatch[2])
		const day = Number(isoDateMatch[3])
		if (month < 1 || month > 12 || day < 1 || day > 31) return null
		const d = new Date(Date.UTC(year, month - 1, day))
		if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
		return d.getTime()
	}

	if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
		const date = new Date(value)
		return Number.isNaN(date.getTime()) ? null : date.getTime()
	}

	const monthNameMatch = value.match(/^([A-Za-z]+)\s+(\d{4})$/)
	if (monthNameMatch) {
		const monthIndex = MONTH_NAME_TO_INDEX[monthNameMatch[1].toLowerCase()]
		if (monthIndex == null) return null
		return Date.UTC(Number(monthNameMatch[2]), monthIndex, 1)
	}

	return null
}

const looksLikeDateField = (field: string) => DATE_LIKE_FIELD_RE.test(field)

const normalizeCategoryXValue = (rawValue: unknown) => {
	if (rawValue == null) return null
	// Historical category charts used an "Unknown" bucket for blank labels; keep that
	// fallback without treating numeric zero as blank.
	if (typeof rawValue === 'string' && rawValue.trim() === '') return 'Unknown'
	return String(rawValue)
}

function inferTimeSeriesAxis(
	config: ChartConfiguration,
	rawData: ChartDataSeries
): {
	axisType: 'time' | 'category'
	dimensionName: 'timestamp' | 'category'
	normalizeXValue: (rawValue: unknown) => number | string | null
	reason: 'declared-time' | 'promoted-date-category' | 'category'
} {
	if (config.axes.x.type === 'time') {
		return {
			axisType: 'time',
			dimensionName: 'timestamp',
			normalizeXValue: (rawValue) => parseStrictDateLabelToMs(rawValue),
			reason: 'declared-time'
		}
	}

	if (config.axes.x.type !== 'category' || !looksLikeDateField(config.axes.x.field)) {
		return {
			axisType: 'category',
			dimensionName: 'category',
			normalizeXValue: normalizeCategoryXValue,
			reason: 'category'
		}
	}

	const rawValues: string[] = []
	let hasNonStringValue = false
	for (const row of rawData) {
		const value = asRecord(row)[config.axes.x.field]
		if (value == null || String(value).trim().length === 0) continue
		if (typeof value !== 'string') {
			hasNonStringValue = true
			break
		}
		rawValues.push(value)
	}

	if (rawValues.length === 0 || hasNonStringValue) {
		return {
			axisType: 'category',
			dimensionName: 'category',
			normalizeXValue: normalizeCategoryXValue,
			reason: 'category'
		}
	}

	const uniqueTimestamps = new Set<number>()
	let allParsed = true
	for (const value of rawValues) {
		const parsedValue = parseStrictDateLabelToMs(value)
		if (parsedValue == null) {
			allParsed = false
			break
		}
		uniqueTimestamps.add(parsedValue)
	}

	// Some model configs mark a date-like dimension as category. Promote only
	// when every populated value parses and there is enough variation for a time axis.
	if (allParsed && uniqueTimestamps.size >= 2) {
		return {
			axisType: 'time',
			dimensionName: 'timestamp',
			normalizeXValue: (rawValue) => parseStrictDateLabelToMs(rawValue),
			reason: 'promoted-date-category'
		}
	}

	return {
		axisType: 'category',
		dimensionName: 'category',
		normalizeXValue: normalizeCategoryXValue,
		reason: 'category'
	}
}

const BASE_TYPE_MAP: Record<string, 'line' | 'area' | 'bar'> = { area: 'area', bar: 'bar', line: 'line' }

const getCartesianBaseType = (
	config: ChartConfiguration,
	seriesConfig: ChartConfiguration['series'][number]
): 'line' | 'area' | 'bar' => {
	const type = config.type === 'combo' ? seriesConfig.type : config.type
	return BASE_TYPE_MAP[type] ?? 'line'
}

const isValidCartesianPoint = (
	x: string | number | null | undefined,
	value: number | null,
	baseType: 'line' | 'area' | 'bar',
	axisType: 'time' | 'category'
) => {
	if (axisType === 'time') {
		if (typeof x !== 'number' || Number.isNaN(x)) return false
		return baseType === 'bar' ? value != null && !Number.isNaN(value) : value == null || !Number.isNaN(value)
	}

	if (typeof x !== 'string' || x.length === 0) return false
	return value != null && !Number.isNaN(value)
}

const getTooltipValueFromParams = (item: any) => {
	const seriesName = item?.seriesName
	const data = item?.data
	if (data && typeof data === 'object' && !Array.isArray(data) && seriesName && seriesName in data) {
		return data[seriesName]
	}
	if (Array.isArray(item?.value)) return item.value[1]
	return item?.value
}

const getNumericTooltipValueFromParams = (item: any): number | null => {
	const rawValue = getTooltipValueFromParams(item)
	const value = rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
	return value == null || Number.isNaN(value) ? null : value
}

export const createCategoryTooltipFormatter = (
	valueSymbol: string,
	charts: LlamaAICartesianSeriesConfig[] = []
): ((params: unknown) => string) => {
	const symbolBySeries = new Map<string, string>()
	for (const chart of charts) symbolBySeries.set(chart.name, chart.valueSymbol ?? valueSymbol)

	return (params: unknown) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const header = String(items[0]?.name ?? items[0]?.axisValue ?? items[0]?.data?.category ?? '')
		const values: Array<{ marker: string; seriesName: string; value: number; symbol: string }> = []
		for (const item of items) {
			const seriesName = item?.seriesName
			if (!seriesName) continue
			const value = getNumericTooltipValueFromParams(item)
			if (value == null) continue
			values.push({
				marker: item?.marker ?? '',
				seriesName,
				value,
				symbol: symbolBySeries.get(seriesName) ?? valueSymbol
			})
		}
		values.sort((a, b) => b.value - a.value)

		let lines = ''
		for (const item of values) {
			lines += `<div>${item.marker} ${item.seriesName}: ${formatChartValue(item.value, item.symbol)}</div>`
		}

		return `<div style="margin-bottom: 8px; font-weight: 600;">${header}</div>${lines}`
	}
}

export function adaptCartesianChartData(
	config: ChartConfiguration,
	rawData: ChartDataSeries
): AdaptedLlamaAICartesianChart {
	try {
		if (!rawData || rawData.length === 0) throw new Error('No data provided')
		if (!config.series?.length) throw new Error('No series configuration found')

		const axisInference = inferTimeSeriesAxis(config, rawData)
		const { axisType, dimensionName, normalizeXValue } = axisInference
		const seriesNames = new Set<string>()
		for (const series of config.series) {
			if (series.name === dimensionName) {
				throw new Error(`Series name "${series.name}" is reserved for the x-axis dimension`)
			}
			if (seriesNames.has(series.name)) throw new Error(`Duplicate series name "${series.name}" is not allowed`)
			seriesNames.add(series.name)
		}
		const yAxisIdToIndex = new Map<string, number>()
		const yAxisIndexToSymbol = new Map<number, string>()

		for (let index = 0; index < (config.axes.yAxes?.length ?? 0); index++) {
			const axis = config.axes.yAxes[index]
			yAxisIdToIndex.set(axis.id, index)
			yAxisIndexToSymbol.set(index, axis.valueSymbol ?? config.valueSymbol ?? '')
		}

		const rowsByX = new Map<string | number, LlamaAICartesianDatasetRow>()
		const categoryOrder: Array<string | number> = []
		const charts: LlamaAICartesianSeriesConfig[] = []
		const seriesMeta: LlamaAICartesianSeriesMeta[] = []

		for (let seriesIndex = 0; seriesIndex < config.series.length; seriesIndex++) {
			const seriesConfig = config.series[seriesIndex]
			const baseType = getCartesianBaseType(config, seriesConfig)
			const chartType = baseType === 'bar' ? 'bar' : 'line'
			const chartName = seriesConfig.name
			const yAxisIndex = yAxisIdToIndex.get(seriesConfig.yAxisId) ?? 0
			const seriesValueSymbol = yAxisIndexToSymbol.get(yAxisIndex) ?? config.valueSymbol ?? ''
			const apiColor = seriesConfig.styling?.color
			const isPrimaryAxis = yAxisIndex === 0

			const entityFilter = seriesConfig.dataMapping.entityFilter
			const entityValue = entityFilter?.value
			const normalizedEntityValue = entityValue == null ? null : String(entityValue).toLowerCase()

			const resolvedColor = apiColor || getChartColor(entityValue, seriesIndex, oldBlue)

			const seenXValues = new Set<string | number>()
			for (const row of rawData) {
				const record = asRecord(row)
				if (entityFilter) {
					const rowValue = record[entityFilter.field]
					const filterValue = entityFilter.value
					const matches =
						rowValue === filterValue ||
						(rowValue != null &&
							normalizedEntityValue != null &&
							String(rowValue).toLowerCase() === normalizedEntityValue)
					if (!matches) continue
				}
				const xValue = normalizeXValue(record[seriesConfig.dataMapping.xField])
				const value = record[seriesConfig.dataMapping.yField]
				const numericValue = value == null ? null : parseStringNumber(value)

				if (xValue == null) continue
				if (!isValidCartesianPoint(xValue, numericValue, baseType, axisType)) continue
				if (seenXValues.has(xValue)) continue
				seenXValues.add(xValue)

				if (!rowsByX.has(xValue)) {
					const chartRow = {} as LlamaAICartesianDatasetRow
					setCartesianRowValue(chartRow, dimensionName, xValue)
					rowsByX.set(xValue, chartRow)
					categoryOrder.push(xValue)
				}

				setCartesianRowValue(rowsByX.get(xValue)!, chartName, numericValue)
			}

			charts.push({
				type: chartType,
				name: chartName,
				encode: { x: dimensionName, y: chartName },
				color: resolvedColor,
				valueSymbol: seriesValueSymbol,
				yAxisIndex
			})

			seriesMeta.push({
				name: chartName,
				seriesIndex,
				metricClass: seriesConfig.metricClass,
				baseType,
				apiColor,
				resolvedColor,
				valueSymbol: seriesValueSymbol,
				yAxisIndex,
				isPrimaryAxis,
				canStack: baseType !== 'line' || isPrimaryAxis,
				canPercentage: isPrimaryAxis,
				canGroup: axisType === 'time'
			})
		}

		const datasetSource =
			axisType === 'time'
				? Array.from(rowsByX.values()).sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
				: categoryOrder.map((key) => rowsByX.get(key)!)

		const dataset = {
			source: datasetSource,
			dimensions: [dimensionName, ...charts.map((chart) => chart.name)]
		}

		const chartOptions: Record<string, any> = {}

		if (axisType === 'category') {
			// Long/many category labels overlap on a vertical axis and ECharts silently hides some
			// (interval:'auto'). When crowded, force every label to show and tilt them so all stay
			// readable, and reserve bottom room so the tilted text isn't clipped.
			const categoryLabels = categoryOrder.map((c) => String(c))
			const maxLabelLength = categoryLabels.reduce((m, c) => Math.max(m, c.length), 0)
			const crowded = categoryLabels.length > 6 || maxLabelLength > 10
			chartOptions.xAxis = {
				type: 'category',
				boundaryGap: true,
				...(crowded ? { axisLabel: { interval: 0, rotate: 35, hideOverlap: false } } : {})
			}
			if (crowded) {
				chartOptions.grid = { ...(chartOptions.grid ?? {}), bottom: Math.min(44 + maxLabelLength * 3, 120) }
			}
			chartOptions.tooltip = {
				formatter: createCategoryTooltipFormatter(config.valueSymbol ?? '', charts)
			}
		}

		const primaryAxisSymbol = config.axes.yAxes?.[0]?.valueSymbol ?? config.valueSymbol ?? ''
		if (config.axes.yAxes?.length) {
			chartOptions.yAxis = config.axes.yAxes.map((axis, index) => {
				const existingAxis = Array.isArray(chartOptions.yAxis)
					? (chartOptions.yAxis[index] ?? {})
					: index === 0
						? (chartOptions.yAxis ?? {})
						: {}
				const valueSymbol = axis.valueSymbol ?? config.valueSymbol ?? ''

				return {
					...existingAxis,
					position: axis.position,
					axisLabel: {
						...(existingAxis?.axisLabel ?? {}),
						formatter: (value: number) => formatChartValue(value, valueSymbol)
					},
					...(axis.min !== undefined ? { min: axis.min } : {}),
					...(axis.max !== undefined ? { max: axis.max } : {}),
					...(axis.interval !== undefined ? { interval: axis.interval } : {})
				}
			})
		} else {
			chartOptions.yAxis = {
				...(chartOptions.yAxis ?? {}),
				axisLabel: {
					...(chartOptions.yAxis?.axisLabel ?? {}),
					formatter: (value: number) => formatChartValue(value, primaryAxisSymbol)
				}
			}
		}

		let categoryLogos: string[] | undefined
		if (axisType === 'category') {
			// matched by lowercased category value, not index — categoryOrder is de-duplicated while backend
			// logo data is per-row, so index matching attaches logos to the wrong categories.
			const logoByCategory = buildLogoByCategory(config.axes.x)
			if (logoByCategory) {
				categoryLogos = categoryOrder.map((cat) => logoByCategory.get(String(cat).toLowerCase()) ?? '')
			}
		}

		return {
			chartType: 'cartesian',
			props: {
				dataset,
				charts,
				chartOptions: chartOptions as LlamaAICartesianChartProps['chartOptions'],
				valueSymbol: config.valueSymbol ?? (config.axes.yAxes?.length === 1 ? config.axes.yAxes[0]?.valueSymbol : ''),
				groupBy: axisType === 'time' ? 'daily' : undefined,
				hallmarks: axisType === 'time' && config.hallmarks?.length ? normalizeHallmarks(config.hallmarks) : undefined,
				hallmarkStyle:
					axisType === 'time' && config.hallmarks?.length ? (config.hallmarkStyle ?? 'mark-line') : undefined,
				hideDataZoom: axisType === 'category',
				...(categoryLogos && { categoryLogos })
			},
			title: config.title,
			description: config.description,
			rowCount: datasetSource.length,
			axisType,
			isTimeChart: axisType === 'time',
			hasHallmarks: axisType === 'time' && !!config.hallmarks?.length,
			groupingPolicy: axisType === 'time' ? 'always' : 'never',
			defaultExportKind: 'cartesian',
			seriesMeta
		}
	} catch (error) {
		console.log('Cartesian chart adapter error:', error)
		return {
			chartType: 'cartesian',
			props: {
				dataset: { source: [], dimensions: ['timestamp'] },
				charts: [],
				chartOptions: {},
				valueSymbol: config.valueSymbol ?? '',
				groupBy: config.axes.x.type === 'time' ? 'daily' : undefined,
				hallmarks: undefined
			},
			title: config.title || 'Chart Error',
			description: `Failed to render chart: ${error instanceof Error ? error.message : 'Unknown error'}`,
			rowCount: 0,
			axisType: config.axes.x.type === 'time' ? 'time' : 'category',
			isTimeChart: config.axes.x.type === 'time',
			hasHallmarks: false,
			groupingPolicy: config.axes.x.type === 'time' ? 'always' : 'never',
			defaultExportKind: 'cartesian',
			seriesMeta: []
		}
	}
}
