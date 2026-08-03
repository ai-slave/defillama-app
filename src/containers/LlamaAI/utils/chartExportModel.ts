import type { PngExportProfile } from '~/components/ChartExport/ChartPngExportButton'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import type { AdaptedChartData } from '~/containers/LlamaAI/utils/adaptedChartTypes'
import type { CsvCell } from '~/utils/csvCell'
import { formatIsoDate } from '~/utils/dateFormat'
import { formatPercent } from '~/utils/numberFormat'

export interface ChartExportModel {
	csvRows: CsvCell[][]
	csvFilename: string
	pngProfile: PngExportProfile
}

function slugifyTitle(title: string) {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function normalizeTimestampToSeconds(value: unknown) {
	if (typeof value !== 'number' && typeof value !== 'string') return null
	const numeric = typeof value === 'number' ? value : Number(value)
	if (!Number.isFinite(numeric)) return null
	return numeric > 1e12 ? Math.floor(numeric / 1e3) : Math.floor(numeric)
}

function toCsvCell(value: unknown): CsvCell {
	if (typeof value === 'number') return Number.isFinite(value) ? value : ''
	return typeof value === 'string' || typeof value === 'boolean' ? value : ''
}

function formatChartPercent(value: number, total: number): string {
	if (!Number.isFinite(value) || total <= 0) return '0%'
	return `${formatPercent(value / total, { input: 'fraction', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
}

function buildCartesianCsvRows(
	config: ChartConfiguration,
	adaptedChart: Extract<AdaptedChartData, { chartType: 'cartesian' }>
) {
	const dims = adaptedChart.props.dataset.dimensions
	const rows = adaptedChart.props.dataset.source
	const xKey = adaptedChart.isTimeChart ? 'timestamp' : 'category'
	const seriesKeys = dims.filter((dim) => dim !== xKey)

	if (adaptedChart.isTimeChart) {
		const csvRows: CsvCell[][] = [['Timestamp', 'Date', ...seriesKeys]]
		for (const row of rows) {
			const timestamp = row[0]
			const seconds = normalizeTimestampToSeconds(timestamp)
			csvRows.push([
				toCsvCell(timestamp),
				seconds != null ? (formatIsoDate(seconds, { input: 'seconds' }) ?? '') : '',
				...seriesKeys.map((_, index) => toCsvCell(row[index + 1]))
			])
		}
		return csvRows
	}

	const categoryHeader = config.axes.x.label || 'Category'
	const csvRows: CsvCell[][] = [[categoryHeader, ...seriesKeys]]
	for (const row of rows) {
		csvRows.push([toCsvCell(row[0]), ...seriesKeys.map((_, index) => toCsvCell(row[index + 1]))])
	}
	return csvRows
}

export function buildExportModel(config: ChartConfiguration, adaptedChart: AdaptedChartData): ChartExportModel | null {
	const csvFilename = slugifyTitle(config.title) || 'chart'

	switch (adaptedChart.chartType) {
		case 'cartesian':
			return {
				csvRows: buildCartesianCsvRows(config, adaptedChart),
				csvFilename,
				pngProfile: 'default'
			}
		case 'pie': {
			const pieData = adaptedChart.props.chartData ?? []
			const total = pieData.reduce((sum, item) => sum + item.value, 0)
			const csvRows: CsvCell[][] = [['Name', 'Value', 'Percentage']]
			for (const item of pieData) {
				csvRows.push([item.name, item.value, formatChartPercent(item.value, total)])
			}
			return {
				csvRows,
				csvFilename,
				pngProfile: 'default'
			}
		}
		case 'scatter': {
			const csvRows: CsvCell[][] = [
				[adaptedChart.props.xAxisLabel || 'X', adaptedChart.props.yAxisLabel || 'Y', 'Entity']
			]
			for (const point of adaptedChart.props.chartData ?? []) {
				if (!Array.isArray(point) || point.length < 3) continue
				csvRows.push([toCsvCell(point[0]), toCsvCell(point[1]), toCsvCell(point[2])])
			}
			return {
				csvRows,
				csvFilename,
				pngProfile: 'scatterWithImageSymbols'
			}
		}
		case 'hbar': {
			const groupedSeries = adaptedChart.props.series
			const csvRows: CsvCell[][] = []
			if (groupedSeries) {
				csvRows.push(['Category', ...groupedSeries.map((series) => series.name)])
				for (const [index, [category]] of adaptedChart.data.entries()) {
					csvRows.push([category, ...groupedSeries.map((series) => toCsvCell(series.values[index]))])
				}
			} else {
				csvRows.push(['Category', 'Value'], ...adaptedChart.data)
			}
			return {
				csvRows,
				csvFilename,
				pngProfile: 'hbar'
			}
		}
		default:
			return null
	}
}
