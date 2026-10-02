import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import type { CustomTimePeriod, TimePeriod } from '../dashboardTypes'
import { getTimePeriodBounds } from '../timePeriod'

const DATE_LIKE_FIELD_RE = /(^|_)(date|day|month|time|timestamp)$/i

function parseRowTimestampSec(value: unknown): number | null {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return null
		return value.toString().length <= 10 ? value : Math.floor(value / 1000)
	}

	if (typeof value !== 'string') return null

	const trimmed = value.trim()
	if (!trimmed) return null

	if (/^\d{10}$/.test(trimmed)) return Number(trimmed)
	if (/^\d{13}$/.test(trimmed)) return Math.floor(Number(trimmed) / 1000)

	const isoMonthMatch = trimmed.match(/^(\d{4})-(\d{2})$/)
	if (isoMonthMatch) {
		const year = Number(isoMonthMatch[1])
		const month = Number(isoMonthMatch[2])
		if (month < 1 || month > 12) return null
		return Math.floor(Date.UTC(year, month - 1, 1) / 1000)
	}

	const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (isoDateMatch) {
		const year = Number(isoDateMatch[1])
		const month = Number(isoDateMatch[2])
		const day = Number(isoDateMatch[3])
		if (month < 1 || month > 12 || day < 1 || day > 31) return null
		const date = new Date(Date.UTC(year, month - 1, day))
		if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
		return Math.floor(date.getTime() / 1000)
	}

	const parsed = Date.parse(trimmed)
	if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000)

	return null
}

function getTimeField(config: ChartConfiguration): string {
	return config.dataTransformation?.timeField || config.axes.x.field
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRowField(row: unknown, field: string): unknown {
	return isRecord(row) ? row[field] : undefined
}

function isTimeSeriesChart<Row>(config: ChartConfiguration, rows: Array<Row>): boolean {
	if (config.axes.x.type === 'time') return true
	if (config.type === 'pie' || config.type === 'hbar') return false

	const timeField = getTimeField(config)
	if (config.axes.x.type !== 'category' || !DATE_LIKE_FIELD_RE.test(timeField)) return false

	let hasValue = false
	for (const row of rows) {
		const value = getRowField(row, timeField)
		if (value == null || String(value).trim().length === 0) continue
		hasValue = true
		if (parseRowTimestampSec(value) == null) return false
	}
	return hasValue
}

function filterRowsByTimePeriod<Row>(
	rows: Array<Row>,
	timeField: string,
	bounds: { start: number; end: number }
): Array<Row> {
	return rows.filter((row) => {
		const timestamp = parseRowTimestampSec(getRowField(row, timeField))
		if (timestamp == null) return true
		return timestamp >= bounds.start && timestamp <= bounds.end
	})
}

function filterChartRows<Row>(
	config: ChartConfiguration,
	rows: Array<Row>,
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null
): Array<Row> {
	if (rows.length === 0) return rows

	const bounds = getTimePeriodBounds(timePeriod, customPeriod)
	if (!bounds || !isTimeSeriesChart(config, rows)) return rows

	const filtered = filterRowsByTimePeriod(rows, getTimeField(config), bounds)
	return filtered.length < 2 ? rows : filtered
}

export function filterLlamaAIChartPayload<Row>(
	charts: Array<ChartConfiguration>,
	chartData: Array<Row>,
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null
): Array<Row>
export function filterLlamaAIChartPayload<Datasets extends Record<string, Array<unknown>>>(
	charts: Array<ChartConfiguration>,
	chartData: Datasets,
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null
): Datasets
export function filterLlamaAIChartPayload(
	charts: Array<ChartConfiguration>,
	chartData: Array<unknown> | Record<string, Array<unknown>>,
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null
): Array<unknown> | Record<string, Array<unknown>> {
	if (Array.isArray(chartData)) {
		const config = charts[0]
		if (!config) return chartData
		return filterChartRows(config, chartData, timePeriod, customPeriod)
	}

	const filtered: Record<string, Array<unknown>> = { ...chartData }

	for (const chart of charts) {
		const key = chart.datasetName || chart.id
		const rows = chartData[key]
		if (!Array.isArray(rows)) continue
		filtered[key] = filterChartRows(chart, rows, timePeriod, customPeriod)
	}

	return filtered
}
