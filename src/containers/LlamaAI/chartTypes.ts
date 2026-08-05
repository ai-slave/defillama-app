export interface ChartConfiguration {
	id: string
	datasetName?: string
	type: 'line' | 'area' | 'bar' | 'combo' | 'pie' | 'scatter' | 'hbar' | 'candlestick'
	title: string
	description: string
	valueSymbol?: string
	/** Explicit colors keyed by slice/point name — used by pie & scatter, which color per-category not per-series. */
	seriesColors?: Record<string, string>
	source?: string
	axes: {
		x: {
			field: string
			label: string
			type: 'time' | 'category' | 'value'
			valueSymbol?: string
			entityType?: 'protocol' | 'chain' | 'token' | 'stablecoin' | 'equity'
			logoCategories?: string[]
			logoKeys?: Record<string, string>
		}
		yAxes: Array<{
			id: string
			fields: string[]
			label: string
			position: 'left' | 'right'
			scale?: 'linear' | 'log'
			valueSymbol?: string
			min?: number | 'dataMin'
			max?: number | 'dataMax'
			interval?: number
		}>
	}
	series: Array<{
		name: string
		type: 'line' | 'area' | 'bar' | 'hbar' | 'scatter' | 'candlestick'
		yAxisId: string
		metricClass: 'flow' | 'stock'
		dataMapping: {
			xField: string
			yField: string
			entityFilter?: { field: string; value: string }
		}
		styling: {
			color?: string
			opacity?: number
		}
	}>
	dataTransformation: {
		groupBy?: string
		timeField: string
		metrics: string[]
	}
	hallmarks?: Array<[number] | [number, string]>
	hallmarkStyle?: 'event-rail' | 'mark-line'
	legend?: { show?: boolean }
	displayOptions?: {
		canStack: boolean
		canShowPercentage: boolean
		canShowCumulative: boolean
		supportsGrouping: boolean
		defaultStacked?: boolean
		defaultPercentage?: boolean
		defaultLogScale?: boolean
		showLabels?: boolean
	}
}

/** User-editable presentation fields sent to POST /agentic/update-chart-style. Data bindings are not editable. */
export interface ChartStylePatch {
	title?: string
	description?: string
	source?: string
	valueSymbol?: string
	type?: ChartConfiguration['type']
	seriesColors?: Record<string, string>
	showLabels?: boolean
	defaultStacked?: boolean
	defaultPercentage?: boolean
	defaultLogScale?: boolean
	hallmarkStyle?: 'mark-line' | 'event-rail'
	hallmarks?: Array<[number, string]>
	legend?: { show?: boolean }
	xAxisLabel?: string
	yAxes?: Array<{
		id: string
		label?: string
		position?: 'left' | 'right'
		valueSymbol?: string
		min?: number | 'dataMin'
		max?: number | 'dataMax'
		interval?: number
	}>
	series?: Array<{ name?: string; color?: string; opacity?: number; type?: 'line' | 'bar' | 'area' }>
	order?: number[]
}

export type ChartDataSeries = unknown[]
export type ChartDataByKey = Record<string, ChartDataSeries>

const CHART_TYPES = new Set<string>(['line', 'area', 'bar', 'combo', 'pie', 'scatter', 'hbar', 'candlestick'])
const SERIES_TYPES = new Set<string>(['line', 'area', 'bar', 'hbar', 'scatter', 'candlestick'])
const AXIS_TYPES = new Set<string>(['time', 'category', 'value'])
const ENTITY_TYPES = new Set<string>(['protocol', 'chain', 'token', 'stablecoin', 'equity'])

export function isChartDataRow(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isStringRecord(value: unknown): value is Record<string, string> {
	if (!isChartDataRow(value)) return false
	for (const key in value) {
		if (typeof value[key] !== 'string') return false
	}
	return true
}

function hasOptionalString(value: Record<string, unknown>, key: string): boolean {
	return value[key] === undefined || typeof value[key] === 'string'
}

function hasOptionalBoolean(value: Record<string, unknown>, key: string): boolean {
	return value[key] === undefined || typeof value[key] === 'boolean'
}

function hasOptionalNumber(value: Record<string, unknown>, key: string): boolean {
	return value[key] === undefined || typeof value[key] === 'number'
}

function isXAxis(value: unknown): boolean {
	if (!isChartDataRow(value)) return false
	if (typeof value.field !== 'string' || typeof value.label !== 'string') return false
	if (typeof value.type !== 'string' || !AXIS_TYPES.has(value.type)) return false
	if (!hasOptionalString(value, 'valueSymbol')) return false
	if (value.entityType !== undefined && (typeof value.entityType !== 'string' || !ENTITY_TYPES.has(value.entityType))) {
		return false
	}
	if (value.logoCategories !== undefined && !isStringArray(value.logoCategories)) return false
	return value.logoKeys === undefined || isStringRecord(value.logoKeys)
}

function isYAxis(value: unknown): boolean {
	if (!isChartDataRow(value)) return false
	if (typeof value.id !== 'string' || !isStringArray(value.fields) || typeof value.label !== 'string') return false
	if (value.position !== 'left' && value.position !== 'right') return false
	if (value.scale !== undefined && value.scale !== 'linear' && value.scale !== 'log') return false
	if (!hasOptionalString(value, 'valueSymbol') || !hasOptionalNumber(value, 'interval')) return false
	if (value.min !== undefined && value.min !== 'dataMin' && typeof value.min !== 'number') return false
	return value.max === undefined || value.max === 'dataMax' || typeof value.max === 'number'
}

function isChartSeries(value: unknown): boolean {
	if (!isChartDataRow(value)) return false
	if (typeof value.name !== 'string' || typeof value.type !== 'string' || !SERIES_TYPES.has(value.type)) return false
	if (typeof value.yAxisId !== 'string' || (value.metricClass !== 'flow' && value.metricClass !== 'stock')) return false
	if (!isChartDataRow(value.dataMapping)) return false
	if (typeof value.dataMapping.xField !== 'string' || typeof value.dataMapping.yField !== 'string') return false
	const entityFilter = value.dataMapping.entityFilter
	if (
		entityFilter !== undefined &&
		(!isChartDataRow(entityFilter) || typeof entityFilter.field !== 'string' || typeof entityFilter.value !== 'string')
	) {
		return false
	}
	if (!isChartDataRow(value.styling)) return false
	return hasOptionalString(value.styling, 'color') && hasOptionalNumber(value.styling, 'opacity')
}

function isDataTransformation(value: unknown): boolean {
	return (
		isChartDataRow(value) &&
		hasOptionalString(value, 'groupBy') &&
		typeof value.timeField === 'string' &&
		isStringArray(value.metrics)
	)
}

function isDisplayOptions(value: unknown): boolean {
	if (!isChartDataRow(value)) return false
	for (const key of ['canStack', 'canShowPercentage', 'canShowCumulative', 'supportsGrouping']) {
		if (typeof value[key] !== 'boolean') return false
	}
	return (
		hasOptionalBoolean(value, 'defaultStacked') &&
		hasOptionalBoolean(value, 'defaultPercentage') &&
		hasOptionalBoolean(value, 'defaultLogScale') &&
		hasOptionalBoolean(value, 'showLabels')
	)
}

function isHallmarks(value: unknown): boolean {
	if (!Array.isArray(value)) return false
	return value.every(
		(hallmark) =>
			Array.isArray(hallmark) &&
			(hallmark.length === 1 || hallmark.length === 2) &&
			typeof hallmark[0] === 'number' &&
			(hallmark.length === 1 || typeof hallmark[1] === 'string')
	)
}

export function isChartConfiguration(value: unknown): value is ChartConfiguration {
	if (!isChartDataRow(value)) return false
	if (typeof value.id !== 'string' || !value.id || typeof value.type !== 'string' || !CHART_TYPES.has(value.type)) {
		return false
	}
	if (typeof value.title !== 'string' || typeof value.description !== 'string') return false
	if (!hasOptionalString(value, 'datasetName') || !hasOptionalString(value, 'valueSymbol')) return false
	if (!hasOptionalString(value, 'source')) return false
	if (value.seriesColors !== undefined && !isStringRecord(value.seriesColors)) return false
	if (!isChartDataRow(value.axes) || !isXAxis(value.axes.x)) return false
	if (!Array.isArray(value.axes.yAxes) || value.axes.yAxes.length === 0 || !value.axes.yAxes.every(isYAxis))
		return false
	if (!Array.isArray(value.series) || value.series.length === 0 || !value.series.every(isChartSeries)) return false
	if (!isDataTransformation(value.dataTransformation)) return false
	if (value.hallmarks !== undefined && !isHallmarks(value.hallmarks)) return false
	if (
		value.hallmarkStyle !== undefined &&
		value.hallmarkStyle !== 'event-rail' &&
		value.hallmarkStyle !== 'mark-line'
	) {
		return false
	}
	if (value.legend !== undefined && (!isChartDataRow(value.legend) || !hasOptionalBoolean(value.legend, 'show'))) {
		return false
	}
	if (value.displayOptions !== undefined && !isDisplayOptions(value.displayOptions)) return false
	return true
}

export function isChartData(value: unknown): value is ChartDataSeries | ChartDataByKey {
	if (Array.isArray(value)) return true
	if (!isChartDataRow(value)) return false
	for (const key in value) {
		if (!Array.isArray(value[key])) return false
	}
	return true
}
