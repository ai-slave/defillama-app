import type {
	IMultiSeriesChartProps,
	MultiSeriesChartArrayRow,
	MultiSeriesChartDataset,
	MultiSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { formatChartValue } from '~/components/ECharts/shared/formatters'
import { getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { chartColor } from '~/constants/colors'
import { isChartDataRow, type ChartConfiguration, type ChartDataSeries } from '~/containers/LlamaAI/chartTypes'
import {
	buildLogoByCategory,
	parseChartDateMs,
	parseStringNumber
} from '~/containers/LlamaAI/utils/chartAdapters/shared'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'

const normalizeHallmarks = (hallmarks?: Array<[number] | [number, string]>): Array<[number, string]> => {
	if (!hallmarks?.length) return []
	const labels = hallmarks.map((h) => h[1]).filter(Boolean)
	if (labels.length > 1 && labels.every((l) => l === labels[0])) {
		return hallmarks.map((h) => [h[0], ''])
	}
	return hallmarks.map((h) => [h[0], h[1] || ''])
}

export type LlamaAICartesianChartProps = Omit<
	Pick<
		IMultiSeriesChartProps,
		| 'dataset'
		| 'charts'
		| 'chartOptions'
		| 'valueSymbol'
		| 'groupBy'
		| 'hallmarks'
		| 'hallmarkStyle'
		| 'hideDataZoom'
		| 'categoryLogos'
	>,
	'dataset'
> & { dataset: MultiSeriesChartDataset }

export type LlamaAICartesianDatasetRow = MultiSeriesChartArrayRow
export type LlamaAICartesianSeriesConfig = NonNullable<LlamaAICartesianChartProps['charts']>[number]

export interface LlamaAICartesianSeriesMeta {
	name: string
	seriesIndex: number
	metricClass: 'flow' | 'stock' | 'unknown'
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
	seriesMeta: Array<LlamaAICartesianSeriesMeta>
}

const MONTH_NAME_TO_INDEX = {
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
} satisfies Record<string, number>

const DATE_LIKE_FIELD_RE = /(^|_)(date|day|month|time|timestamp)$/i

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
		const date = parseChartDateMs(value)
		return Number.isNaN(date) ? null : date
	}

	const monthNameMatch = value.match(/^([A-Za-z]+)\s+(\d{4})$/)
	if (monthNameMatch) {
		const monthName = monthNameMatch[1]
		const year = monthNameMatch[2]
		if (monthName === undefined || year === undefined) return null
		const monthIndex = getOwnRegistryValue(MONTH_NAME_TO_INDEX, monthName.toLowerCase())
		if (monthIndex == null) return null
		return Date.UTC(Number(year), monthIndex, 1)
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

	const rawValues: Array<string> = []
	let hasNonStringValue = false
	for (const row of rawData) {
		if (!isChartDataRow(row)) continue
		const value = row[config.axes.x.field]
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

const BASE_TYPE_MAP = { area: 'area', bar: 'bar', line: 'line' } satisfies Record<string, 'line' | 'area' | 'bar'>

const getCartesianBaseType = (
	config: ChartConfiguration,
	seriesConfig: ChartConfiguration['series'][number]
): 'line' | 'area' | 'bar' => {
	const type = config.type === 'combo' ? seriesConfig.type : config.type
	return getOwnRegistryValue(BASE_TYPE_MAP, type) ?? 'line'
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

export const createCategoryTooltipFormatter = (
	valueSymbol: string,
	charts: Array<LlamaAICartesianSeriesConfig> = []
): ((params: unknown) => string) => {
	const symbolBySeries = new Map<string, string>()
	for (const chart of charts) symbolBySeries.set(chart.name, chart.valueSymbol ?? valueSymbol)

	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		const firstItem = items[0]
		if (!firstItem) return ''
		const header = String(firstItem.name ?? firstItem.axisValue ?? '')
		const values: Array<{ marker: string; seriesName: string; value: number; symbol: string }> = []
		for (const item of items) {
			const seriesName = item.seriesName
			if (!seriesName) continue
			const rawValue = getTooltipRawYValue(item, seriesName)
			const value = rawValue == null || rawValue === '-' ? null : Number(rawValue)
			if (value == null || Number.isNaN(value)) continue
			values.push({
				marker: typeof item.marker === 'string' ? item.marker : '',
				seriesName,
				value,
				symbol: symbolBySeries.get(seriesName) ?? valueSymbol
			})
		}
		values.sort((a, b) => b.value - a.value)

		let lines = ''
		for (const item of values) {
			lines += `<div>${item.marker} ${escapeHtml(item.seriesName)}: ${escapeHtml(formatChartValue(item.value, item.symbol))}</div>`
		}

		return `<div style="margin-bottom: 8px; font-weight: 600;">${escapeHtml(header)}</div>${lines}`
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
			if (seriesNames.has(series.name)) throw new Error(`Duplicate series name "${series.name}" is not allowed`)
			seriesNames.add(series.name)
		}
		const yAxisIdToIndex = new Map<string, number>()
		const yAxisIndexToSymbol = new Map<number, string>()

		for (const [index, axis] of config.axes.yAxes.entries()) {
			yAxisIdToIndex.set(axis.id, index)
			yAxisIndexToSymbol.set(index, axis.valueSymbol ?? config.valueSymbol ?? '')
		}

		const rowsByX = new Map<string | number, LlamaAICartesianDatasetRow>()
		const categoryOrderKey = new Map<string | number, number>()
		const charts: Array<LlamaAICartesianSeriesConfig> = []
		const seriesMeta: Array<LlamaAICartesianSeriesMeta> = []
		const runtimeSeries: Array<{
			baseType: 'line' | 'area' | 'bar'
			xField: string
			yField: string
			filterField: string | null
			filterValue: unknown
			normalizedEntityValue: string | null
			seenXValues: Set<string | number>
		}> = []

		for (const [seriesIndex, seriesConfig] of config.series.entries()) {
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

			const resolvedColor = apiColor || chartColor(seriesIndex)

			runtimeSeries.push({
				baseType,
				xField: seriesConfig.dataMapping.xField,
				yField: seriesConfig.dataMapping.yField,
				filterField: entityFilter?.field ?? null,
				filterValue: entityFilter?.value,
				normalizedEntityValue,
				seenXValues: new Set<string | number>()
			})

			charts.push({
				type: chartType,
				name: chartName,
				encode: { x: 0, y: seriesIndex + 1 },
				color: resolvedColor,
				valueSymbol: seriesValueSymbol,
				yAxisIndex
			})

			const meta: LlamaAICartesianSeriesMeta = {
				name: chartName,
				seriesIndex,
				metricClass: seriesConfig.metricClass,
				baseType,
				resolvedColor,
				valueSymbol: seriesValueSymbol,
				yAxisIndex,
				isPrimaryAxis,
				canStack: baseType !== 'line' || isPrimaryAxis,
				canPercentage: isPrimaryAxis,
				canGroup: axisType === 'time'
			}
			if (apiColor !== undefined) meta.apiColor = apiColor
			seriesMeta.push(meta)
		}

		for (let rawRowIndex = 0; rawRowIndex < rawData.length; rawRowIndex++) {
			const record = rawData[rawRowIndex]
			if (!isChartDataRow(record)) continue
			for (const [seriesIndex, runtime] of runtimeSeries.entries()) {
				const { baseType, xField, yField, filterField, filterValue, normalizedEntityValue, seenXValues } = runtime
				if (filterField) {
					const rowValue = record[filterField]
					const matches =
						rowValue === filterValue ||
						(rowValue != null &&
							normalizedEntityValue != null &&
							String(rowValue).toLowerCase() === normalizedEntityValue)
					if (!matches) continue
				}
				const xValue = normalizeXValue(record[xField])
				const value = record[yField]
				const numericValue = value == null ? null : parseStringNumber(value)

				if (xValue == null) continue
				if (!isValidCartesianPoint(xValue, numericValue, baseType, axisType)) continue
				if (seenXValues.has(xValue)) continue
				seenXValues.add(xValue)
				const orderKey = seriesIndex * rawData.length + rawRowIndex

				let chartRow = rowsByX.get(xValue)
				if (!chartRow) {
					chartRow = new Array<number | string | null | undefined>(config.series.length + 1)
					chartRow[0] = xValue
					rowsByX.set(xValue, chartRow)
				}
				const previousOrderKey = categoryOrderKey.get(xValue)
				if (previousOrderKey == null || orderKey < previousOrderKey) categoryOrderKey.set(xValue, orderKey)

				chartRow[seriesIndex + 1] = numericValue
			}
		}

		const categoryOrder =
			axisType === 'category'
				? Array.from(rowsByX.keys()).sort((a, b) => {
						const aOrder = categoryOrderKey.get(a)
						const bOrder = categoryOrderKey.get(b)
						if (aOrder === undefined || bOrder === undefined) return 0
						return aOrder - bOrder
					})
				: []
		const datasetSource: Array<LlamaAICartesianDatasetRow> = []
		if (axisType === 'time') {
			const entries = Array.from(rowsByX.entries()).sort(([a], [b]) => Number(a) - Number(b))
			for (const [, row] of entries) datasetSource.push(row)
		} else {
			for (const key of categoryOrder) {
				const row = rowsByX.get(key)
				if (row) datasetSource.push(row)
			}
		}

		const dataset: MultiSeriesChartDataset = {
			source: datasetSource,
			dimensions: [dimensionName, ...charts.map((chart) => chart.name)]
		}

		const chartOptions: MultiSeriesChartOptions = {}

		if (axisType === 'category') {
			// Long/many category labels overlap on a vertical axis and ECharts silently hides some
			// (interval:'auto'). When crowded, force every label to show and tilt them so all stay
			// readable, and reserve bottom room so the tilted text isn't clipped.
			const categoryLabels = categoryOrder.map((c) => String(c))
			let maxLabelLength = 0
			for (const c of categoryLabels) maxLabelLength = Math.max(maxLabelLength, c.length)
			const crowded = categoryLabels.length > 6 || maxLabelLength > 10
			chartOptions.xAxis = {
				type: 'category',
				boundaryGap: true,
				...(crowded ? { axisLabel: { interval: 0, rotate: 35, hideOverlap: false } } : {})
			}
			if (crowded) {
				chartOptions.grid = { ...chartOptions.grid, bottom: Math.min(44 + maxLabelLength * 3, 120) }
			}
			chartOptions.tooltip = {
				formatter: createCategoryTooltipFormatter(config.valueSymbol ?? '', charts)
			}
		}

		const primaryAxisSymbol = config.axes.yAxes?.[0]?.valueSymbol ?? config.valueSymbol ?? ''
		if (config.axes.yAxes.length > 0) {
			chartOptions.yAxis = config.axes.yAxes.map((axis) => {
				const valueSymbol = axis.valueSymbol ?? config.valueSymbol ?? ''

				return {
					position: axis.position,
					axisLabel: {
						formatter: (value: number) => formatChartValue(value, valueSymbol)
					},
					...(axis.min !== undefined ? { min: axis.min } : {}),
					...(axis.max !== undefined ? { max: axis.max } : {}),
					...(axis.interval !== undefined ? { interval: axis.interval } : {})
				}
			})
		} else {
			chartOptions.yAxis = {
				axisLabel: {
					formatter: (value: number) => formatChartValue(value, primaryAxisSymbol)
				}
			}
		}

		let categoryLogos: Array<string> | undefined
		if (axisType === 'category') {
			// matched by lowercased category value, not index — categoryOrder is de-duplicated while backend
			// logo data is per-row, so index matching attaches logos to the wrong categories.
			const logoByCategory = buildLogoByCategory(config.axes.x)
			if (logoByCategory) {
				const logos = new Array<string>(categoryOrder.length)
				let complete = true
				for (let index = 0; index < categoryOrder.length; index++) {
					const logo = logoByCategory.get(String(categoryOrder[index]).toLowerCase())
					if (!logo) complete = false
					logos[index] = logo ?? ''
				}
				// The renderer replaces native category labels with logos. A partial set would
				// therefore make unmapped categories anonymous, so keep text labels instead.
				if (complete) categoryLogos = logos
			}
		}

		const props: LlamaAICartesianChartProps = {
			dataset,
			charts,
			chartOptions,
			valueSymbol:
				config.valueSymbol ?? (config.axes.yAxes.length === 1 ? (config.axes.yAxes[0]?.valueSymbol ?? '') : ''),
			hideDataZoom: axisType === 'category'
		}
		if (axisType === 'time') props.groupBy = 'daily'
		if (axisType === 'time' && config.hallmarks?.length) {
			props.hallmarks = normalizeHallmarks(config.hallmarks)
			props.hallmarkStyle = config.hallmarkStyle ?? 'mark-line'
		}
		if (categoryLogos !== undefined) props.categoryLogos = categoryLogos

		return {
			chartType: 'cartesian',
			props,
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
		const props: LlamaAICartesianChartProps = {
			dataset: { source: [], dimensions: ['timestamp'] },
			charts: [],
			chartOptions: {},
			valueSymbol: config.valueSymbol ?? ''
		}
		if (config.axes.x.type === 'time') props.groupBy = 'daily'
		return {
			chartType: 'cartesian',
			props,
			title: config.title || 'Chart error',
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
