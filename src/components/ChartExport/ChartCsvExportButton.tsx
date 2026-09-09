import type { DatasetComponentOption } from 'echarts'
import type * as echarts from 'echarts/core'
import { useCallback } from 'react'
import { CSVDownloadButton, type CsvPayload, type PrepareCsv } from '~/components/CsvDownloadButton'
import { buttonStyles } from '~/ui/Button'
import type { CsvCell } from '~/utils/csvCell'
import { formatIsoDate } from '~/utils/dateFormat'

function isRecord(x: unknown): x is Record<string, unknown> {
	return !!x && typeof x === 'object' && !Array.isArray(x)
}

function isStringArray(x: unknown): x is Array<string> {
	return Array.isArray(x) && x.every((v) => typeof v === 'string')
}

function getOwnRecordValue(record: Record<string, unknown>, key: string): unknown {
	return Object.hasOwn(record, key) ? record[key] : undefined
}

function normalizeEpochSeconds(x: unknown): number | null {
	if (typeof x !== 'number' && typeof x !== 'string') return null
	const n = typeof x === 'number' ? x : Number(x)
	if (!Number.isFinite(n)) return null
	// Heuristic: ms timestamps are ~1e12+, seconds are ~1e9+
	return n > 1e12 ? Math.floor(n / 1e3) : Math.floor(n)
}

function coerceXKey(x: unknown): string | number | null {
	if (typeof x === 'number') return Number.isFinite(x) ? x : null
	if (typeof x !== 'string') return null
	const trimmed = x.trim()
	if (!trimmed) return x
	const asNum = Number(trimmed)
	return Number.isFinite(asNum) ? asNum : x
}

function toChartCsvCell(value: unknown): CsvCell {
	if (typeof value === 'number') return Number.isFinite(value) ? value : ''
	return typeof value === 'string' || typeof value === 'boolean' ? value : ''
}

function getDatasetFromOption(option: ReturnType<echarts.ECharts['getOption']>): {
	dimensions: Array<string> | null
	source: Array<unknown> | null
} {
	const datasetOption = option.dataset as DatasetComponentOption | Array<DatasetComponentOption> | undefined
	const dataset = Array.isArray(datasetOption) ? datasetOption[0] : datasetOption
	const dimensionsRaw = dataset?.dimensions
	const sourceRaw = dataset?.source

	if (!Array.isArray(sourceRaw)) return { dimensions: null, source: null }
	if (!dimensionsRaw) return { dimensions: null, source: sourceRaw }

	const dimensions: Array<string> = []
	const indexes: Array<number> = []
	for (const [index, dimension] of dimensionsRaw.entries()) {
		const name = typeof dimension === 'string' ? dimension : dimension.displayName
		if (name === undefined) continue
		dimensions.push(name)
		indexes.push(index)
	}

	const source =
		indexes.length === dimensionsRaw.length
			? sourceRaw
			: sourceRaw.map((row) => (Array.isArray(row) ? indexes.map((index) => row[index]) : row))
	return { dimensions: dimensions.length > 0 ? dimensions : null, source }
}

export function buildCsvRowsFromDataset(
	dimensions: Array<string> | null,
	source: Array<unknown> | null
): Array<Array<CsvCell>> {
	if (!source || source.length === 0) return []

	// ECharts dataset.source can be:
	// - object rows: [{ timestamp: 1, A: 2 }, ...]
	// - array rows with explicit `dimensions`: [[1,2,...], ...]
	// - array rows with header row: [['timestamp','A',...], [1,2,...], ...]
	let dataRows: Array<unknown> = source

	const headerDimsFromSource = !dimensions && isStringArray(source[0]) ? source[0] : null
	const dims =
		dimensions ??
		headerDimsFromSource ??
		(() => {
			const first = source[0]
			if (!isRecord(first)) return []
			const keys = new Set<string>()
			let hasTimestamp = false
			for (const key in first) {
				if (!Object.hasOwn(first, key)) continue
				if (key === 'timestamp') {
					hasTimestamp = true
					continue
				}
				keys.add(key)
			}
			return hasTimestamp ? ['timestamp', ...keys] : [...keys]
		})()

	if (!dimensions && headerDimsFromSource) {
		dataRows = source.slice(1)
	}

	if (dims.length === 0) return []

	const hasTimestamp = dims.includes('timestamp')
	const seriesDims = hasTimestamp ? dims.filter((k) => k !== 'timestamp') : dims

	const rows: Array<Array<CsvCell>> = []

	if (hasTimestamp) {
		rows.push(['Timestamp', 'Date', ...seriesDims])
		const tsIndex = dims.indexOf('timestamp')
		const seriesIndexes = seriesDims.map((k) => dims.indexOf(k))

		for (const row of dataRows) {
			let tsRaw: unknown = ''
			let values: Array<CsvCell> = []

			if (isRecord(row)) {
				tsRaw = getOwnRecordValue(row, 'timestamp')
				values = seriesDims.map((k) => toChartCsvCell(getOwnRecordValue(row, k)))
			} else if (Array.isArray(row)) {
				tsRaw = tsIndex >= 0 ? row[tsIndex] : ''
				values = seriesIndexes.map((idx) => toChartCsvCell(idx >= 0 ? row[idx] : ''))
			} else {
				continue
			}

			const tsSeconds = normalizeEpochSeconds(tsRaw)
			rows.push([
				toChartCsvCell(tsRaw),
				tsSeconds != null ? (formatIsoDate(tsSeconds, { input: 'seconds' }) ?? '') : '',
				...values
			])
		}
		return rows
	}

	rows.push([...dims])
	for (const row of dataRows) {
		if (isRecord(row)) {
			rows.push(dims.map((k) => toChartCsvCell(getOwnRecordValue(row, k))))
			continue
		}
		if (Array.isArray(row)) {
			rows.push(dims.map((_, idx) => toChartCsvCell(row[idx])))
			continue
		}
	}
	return rows
}

export function buildCsvFromDataset({
	dimensions,
	source,
	filenameBase
}: {
	dimensions: Array<string> | null
	source: Array<unknown> | null
	filenameBase: string | undefined
}): { filename: string; rows: Array<Array<CsvCell>> } {
	const rows = buildCsvRowsFromDataset(dimensions, source)
	if (rows.length === 0) throw new Error('No chart data available for CSV export')

	const base = filenameBase || 'chart'
	const date = new Date().toISOString().split('T')[0]
	return { filename: `${base}-${date}`, rows }
}

function buildCsvRowsFromSeriesFallback(option: any): Array<Array<CsvCell>> {
	const seriesRaw = option?.series
	const seriesArr: Array<any> = Array.isArray(seriesRaw) ? seriesRaw : seriesRaw ? [seriesRaw] : []
	if (seriesArr.length === 0) return []
	const isScatterChart = seriesArr.every((series) => series?.type === 'scatter')

	const xAxisRaw = option?.xAxis
	const xAxis = Array.isArray(xAxisRaw) ? xAxisRaw[0] : xAxisRaw
	const xAxisData: Array<unknown> | null = Array.isArray(xAxis?.data) ? xAxis.data : null
	const yAxisRaw = option?.yAxis
	const yAxis = Array.isArray(yAxisRaw) ? yAxisRaw[0] : yAxisRaw
	const yAxisData: Array<unknown> | null = Array.isArray(yAxis?.data) ? yAxis.data : null
	const categoryAxisData = xAxisData ?? yAxisData
	const isCategory =
		xAxis?.type === 'category' || yAxis?.type === 'category' || seriesArr.every((series) => series?.type === 'pie')
	const isTimeAxis = xAxis?.type === 'time'

	if (isScatterChart) {
		const xHeader = typeof xAxis?.name === 'string' && xAxis.name ? xAxis.name : 'X'
		const yHeader = typeof yAxis?.name === 'string' && yAxis.name ? yAxis.name : 'Y'
		const rows: Array<Array<CsvCell>> = [[xHeader, yHeader, 'Entity']]

		for (const series of seriesArr) {
			const data: Array<unknown> = Array.isArray(series?.data) ? series.data : []
			for (const point of data) {
				let value: unknown = point
				if (isRecord(point) && 'value' in point) {
					value = point.value
				}
				if (!Array.isArray(value) || value.length < 2) continue

				rows.push([
					toChartCsvCell(value[0]),
					toChartCsvCell(value[1]),
					toChartCsvCell(typeof value[2] === 'string' ? value[2] : (series?.name ?? ''))
				])
			}
		}

		return rows
	}

	const seriesNames: Array<string> = []
	const rowsByX = new Map<string | number, Record<string, CsvCell>>() // key type must be stable

	for (let s = 0; s < seriesArr.length; s++) {
		const series = seriesArr[s]
		const name = typeof series?.name === 'string' && series.name ? series.name : `series_${s + 1}`
		seriesNames.push(name)

		const data: Array<unknown> = Array.isArray(series?.data) ? series.data : []
		for (let i = 0; i < data.length; i++) {
			const point = data[i]
			let x: unknown = categoryAxisData?.[i]
			let y: unknown = null

			if (Array.isArray(point)) {
				x = point[0]
				y = point[1]
			} else if (isRecord(point) && 'value' in point) {
				const v = point['value']
				if (Array.isArray(v)) {
					x = v[0]
					y = v[1]
				} else {
					y = v
					if ('name' in point) x = point['name']
				}
			} else {
				y = point
			}

			const xKey = isCategory && typeof x === 'string' ? x : coerceXKey(x)
			if (xKey == null) continue

			const existing = rowsByX.get(xKey) ?? {}
			existing[name] = toChartCsvCell(y)
			rowsByX.set(xKey, existing)
		}
	}

	if (rowsByX.size === 0) return []

	const xKeys = Array.from(rowsByX.keys())
	const allNumeric = xKeys.every((k) => typeof k === 'number')
	const sorted = allNumeric && !isCategory ? Array.from(xKeys).sort((a, b) => Number(a) - Number(b)) : xKeys

	const includeDate = isTimeAxis
	const headerLabel = xAxis?.type === 'category' || yAxis?.type === 'category' ? 'category' : 'x'
	const header: Array<CsvCell> = includeDate ? [headerLabel, 'Date', ...seriesNames] : [headerLabel, ...seriesNames]
	const rows: Array<Array<CsvCell>> = [header]

	for (const xKey of sorted) {
		const record = rowsByX.get(xKey) ?? {}
		const tsSeconds = includeDate ? normalizeEpochSeconds(xKey) : null
		rows.push([
			toChartCsvCell(xKey),
			...(includeDate ? [tsSeconds != null ? (formatIsoDate(tsSeconds, { input: 'seconds' }) ?? '') : ''] : []),
			...seriesNames.map((name) => toChartCsvCell(record[name]))
		])
	}

	return rows
}

function buildCsvFromChart({
	instance,
	filenameBase
}: {
	instance: echarts.ECharts
	filenameBase: string | undefined
}): { filename: string; rows: Array<Array<CsvCell>> } {
	const option = instance.getOption()
	const { dimensions, source } = getDatasetFromOption(option)
	const rows = buildCsvRowsFromDataset(dimensions, source)
	const rowsSafe = rows.length > 0 ? rows : buildCsvRowsFromSeriesFallback(option)

	if (rowsSafe.length === 0) {
		throw new Error('No chart data available for CSV export')
	}

	const base = filenameBase || 'chart'
	const date = new Date().toISOString().split('T')[0]
	return { filename: `${base}-${date}`, rows: rowsSafe }
}

export interface ChartCsvDataset {
	dimensions: Array<string> | null
	source: Array<unknown> | null
}

export type PrepareChartCsvDataset = () => ChartCsvDataset | Promise<ChartCsvDataset>

export type ChartCsvSource =
	| 'rendered-chart'
	| { type: 'dataset'; prepare: PrepareChartCsvDataset }
	| { type: 'prepare-csv'; prepare: PrepareCsv }

interface ChartCsvExportButtonProps {
	chartInstance: () => echarts.ECharts | null
	className?: string | undefined
	smol?: boolean | undefined
	disabled?: boolean | undefined
	filename?: string | undefined
	source: ChartCsvSource
	onExport?: ((info: { filename: string }) => void) | undefined
}

const DEFAULT_CLASSNAME = buttonStyles({ size: 'md' })

export function ChartCsvExportButton({
	chartInstance,
	className = DEFAULT_CLASSNAME,
	smol = true,
	disabled,
	filename,
	source,
	onExport
}: ChartCsvExportButtonProps) {
	const prepareCsv = useCallback(async (): Promise<CsvPayload> => {
		let result: CsvPayload
		if (source === 'rendered-chart') {
			const instance = chartInstance()
			if (!instance) throw new Error('Failed to get chart instance')
			result = buildCsvFromChart({ instance, filenameBase: filename })
		} else if (source.type === 'dataset') {
			const dataset = await source.prepare()
			result = buildCsvFromDataset({
				dimensions: dataset.dimensions,
				source: dataset.source,
				filenameBase: filename
			})
		} else {
			result = await source.prepare()
		}
		onExport?.({ filename: result.filename })
		return result
	}, [chartInstance, filename, source, onExport])

	return (
		<CSVDownloadButton prepareCsv={prepareCsv} replaceClassName className={className} smol={smol} disabled={disabled}>
			<span>{smol ? '.csv' : 'CSV'}</span>
		</CSVDownloadButton>
	)
}
