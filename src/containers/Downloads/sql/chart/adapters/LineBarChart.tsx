import type { LineSeriesOption } from 'echarts/charts'
import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import { createCappedRemainderTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type {
	CanonicalMultiSeriesChartDataset,
	MultiSeriesChartOptions,
	MultiSeriesChartSeriesConfig,
	MultiSeriesYAxisOption
} from '~/components/ECharts/MultiSeriesChart/types'
import { getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { CHART_COLORS } from '~/constants/colors'
import { LoadingSpinner } from '~/ui/Loaders'
import { SPLIT_TOP_N, type ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { SQL_CHART_HEIGHT } from '../chartLayout'
import { pivotRowsForSplit } from '../pivot'
import { escapeSqlChartHtml, readSqlNumber, readSqlTimestampMs } from '../rowValues'
import { makeValueFormatter, type ValueFormatter } from '../valueFormatters'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type SqlSeriesSpec = {
	name: string
	sourceIndex: number
	type: 'line' | 'bar'
	color: string
	stack?: string
	yAxisIndex?: number
	areaStyle?: LineSeriesOption['areaStyle']
}

const SQL_X_DIMENSION = 'x'

interface LineBarChartProps {
	config: ChartConfig
	result: QueryResult
	classified: ClassifiedColumn[]
	onReady?: (instance: echarts.ECharts | null) => void
	forceType?: 'line' | 'bar'
	forceArea?: boolean
	forceStack?: string
}

export function LineBarChart({
	config,
	result,
	classified,
	onReady,
	forceType,
	forceArea,
	forceStack
}: LineBarChartProps) {
	const xColumn = classified.find((c) => c.name === config.xCol) ?? null
	const xAxisType: 'time' | 'category' = xColumn?.coarse === 'date' ? 'time' : 'category'
	const formatter = useMemo(() => makeValueFormatter(config.numberFormat), [config.numberFormat])

	const { chartModel, truncatedCount } = useMemo(() => {
		if (!xColumn)
			return {
				chartModel: { dataset: { dimensions: [], source: [] }, charts: [] },
				truncatedCount: 0
			}

		const areaOpacity = forceStack ? 0.55 : 0.35
		const colorBySeries = new Map(Object.entries(config.seriesColors))
		const kindBySeries = new Map(Object.entries(config.seriesKinds))
		const rightAxisSeries = new Set(config.rightAxisCols)

		if (config.splitByCol && config.yCols.length === 1) {
			const yCol = config.yCols[0]
			const yColumn = classified.find((column) => column.name === yCol)
			const splitColumn = classified.find((column) => column.name === config.splitByCol)
			if (!yColumn || !splitColumn) {
				return { chartModel: { dataset: { dimensions: [], source: [] }, charts: [] }, truncatedCount: 0 }
			}
			const pivot = pivotRowsForSplit(result.rows, xColumn.index, yColumn.index, splitColumn.index, {
				topN: SPLIT_TOP_N
			})
			let rows = pivot.rows
			if (config.stackMode === 'expand') rows = normalizeRowsToPercent(rows)
			const specs = pivot.keys.map<SqlSeriesSpec>((key, i) => ({
				name: key,
				sourceIndex: i + 1,
				type: forceType ?? seriesKind(config.chartType, kindBySeries.get(key), 'line'),
				color: colorBySeries.get(key) ?? CHART_COLORS[i % CHART_COLORS.length],
				stack: resolveStack(config.stackMode, forceStack, rightAxisSeries.has(key)),
				yAxisIndex: rightAxisSeries.has(key) ? 1 : undefined,
				areaStyle: forceArea ? { opacity: areaOpacity } : undefined
			}))
			return {
				chartModel: buildSqlChartModel(rows, 0, xAxisType, specs, xAxisType === 'category'),
				truncatedCount: pivot.truncatedCount
			}
		}

		const valueIndexes = config.yCols.map((name) => classified.find((column) => column.name === name)?.index ?? -1)
		const rawRows = config.stackMode === 'expand' ? normalizeWideRowsToPercent(result.rows, valueIndexes) : result.rows

		const specs = config.yCols.map<SqlSeriesSpec>((yName, i) => {
			return {
				name: yName,
				sourceIndex: valueIndexes[i],
				type: forceType ?? seriesKind(config.chartType, kindBySeries.get(yName), 'line'),
				color: colorBySeries.get(yName) ?? CHART_COLORS[i % CHART_COLORS.length],
				stack: resolveStack(config.stackMode, forceStack, rightAxisSeries.has(yName)),
				yAxisIndex: rightAxisSeries.has(yName) ? 1 : undefined,
				areaStyle: forceArea ? { opacity: areaOpacity } : undefined
			}
		})
		return {
			chartModel: buildSqlChartModel(rawRows, xColumn.index, xAxisType, specs),
			truncatedCount: 0
		}
	}, [result, config, classified, xColumn, xAxisType, forceType, forceArea, forceStack])

	const chartOptions = useMemo(
		() => buildChartOptions(config, xAxisType, formatter, truncatedCount > 0 ? 'Other' : null),
		[config, xAxisType, formatter, truncatedCount]
	)

	if (!xColumn) return null

	return (
		<div className="relative">
			<Suspense
				fallback={
					<div className="flex items-center justify-center" style={{ height: SQL_CHART_HEIGHT }}>
						<LoadingSpinner size={18} />
					</div>
				}
			>
				<MultiSeriesChart
					dataset={chartModel.dataset}
					charts={chartModel.charts}
					height={SQL_CHART_HEIGHT}
					valueSymbol={formatter.valueSymbol}
					hideDataZoom={chartModel.dataset.source.length < 2}
					chartOptions={chartOptions}
					onReady={onReady}
					hideDefaultLegend={false}
					exportButtons="hidden"
				/>
			</Suspense>
			{truncatedCount > 0 ? (
				<p className="mt-1.5 text-[11px] text-pro-text-tertiary">
					Showing top {SPLIT_TOP_N} series by magnitude. {truncatedCount} folded into <em>Other</em>.
				</p>
			) : null}
		</div>
	)
}

export function buildSqlChartModel(
	rows: ReadonlyArray<readonly unknown[]>,
	xIndex: number,
	xAxisType: 'time' | 'category',
	series: SqlSeriesSpec[],
	preserveNullCategory = false
): { dataset: CanonicalMultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] } {
	const source: CanonicalMultiSeriesChartDataset['source'] = []
	for (const input of rows) {
		const parsedX = toXValue(input[xIndex], xAxisType)
		if (parsedX == null && !(preserveNullCategory && xAxisType === 'category')) continue
		const inputX = parsedX ?? ''
		const row = new Array<number | string | null>(series.length + 1)
		row[0] = inputX
		for (let i = 0; i < series.length; i++) {
			row[i + 1] = toYValue(input[series[i].sourceIndex])
		}
		source.push(row)
	}

	const charts = new Array<MultiSeriesChartSeriesConfig>(series.length)
	for (let i = 0; i < series.length; i++) {
		const item = series[i]
		const { sourceIndex: _sourceIndex, ...chart } = item
		charts[i] = {
			...chart,
			encode: { x: 0, y: i + 1 }
		}
	}
	return { dataset: { dimensions: [SQL_X_DIMENSION, ...series.map((item) => item.name)], source }, charts }
}

function seriesKind(
	chartType: ChartConfig['chartType'],
	configuredKind: 'line' | 'bar' | undefined,
	fallback: 'line' | 'bar'
): 'line' | 'bar' {
	if (configuredKind) return configuredKind
	if (chartType === 'bar') return 'bar'
	if (chartType === 'line') return 'line'
	return fallback
}

function normalizeRowsToPercent(rows: Array<Array<number | string | null>>): Array<Array<number | string | null>> {
	return rows.map((row) => {
		let total = 0
		for (let index = 1; index < row.length; index++) {
			const v = row[index]
			if (typeof v === 'number' && Number.isFinite(v)) total += v
		}
		if (total <= 0) return row
		const out = row.slice()
		for (let index = 1; index < row.length; index++) {
			const v = row[index]
			out[index] = typeof v === 'number' && Number.isFinite(v) ? v / total : null
		}
		return out
	})
}

function normalizeWideRowsToPercent(rows: unknown[][], valueIndexes: number[]): unknown[][] {
	return rows.map((row) => {
		let total = 0
		for (const index of valueIndexes) {
			const n = toYValue(row[index])
			if (n != null) total += n
		}
		if (total <= 0) return row
		const out = row.slice()
		for (const index of valueIndexes) {
			const n = toYValue(row[index])
			out[index] = n == null ? null : n / total
		}
		return out
	})
}

function resolveStack(
	stackMode: ChartConfig['stackMode'],
	forceStack: string | undefined,
	isRightAxisSeries: boolean
): string | undefined {
	if (forceStack) return forceStack
	if (stackMode === 'stacked' || stackMode === 'expand') {
		return isRightAxisSeries ? 'right' : 'left'
	}
	return undefined
}

function buildChartOptions(
	config: ChartConfig,
	xAxisType: 'time' | 'category',
	formatter: ValueFormatter,
	explicitRemainderLabel: string | null
): MultiSeriesChartOptions {
	const yAxisBase: MultiSeriesYAxisOption = { axisLabel: { formatter: (value: number) => formatter.axis(value) } }
	const opts: MultiSeriesChartOptions = { yAxis: yAxisBase }
	if (config.stackMode === 'expand') {
		opts.yAxis = { ...yAxisBase, max: 1, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` } }
	}

	if (xAxisType === 'category') {
		opts.xAxis = { type: 'category' }
		opts.tooltip = {
			trigger: 'axis',
			confine: true,
			formatter: (params: unknown) => {
				const items = normalizeTooltipItems(params)
				if (items.length === 0) return ''
				const header = escapeSqlChartHtml(String(items[0].axisValue ?? items[0].name ?? ''))
				const rows: Array<{ marker: string; name: string; value: number }> = []
				for (const item of items) {
					const name = item.seriesName
					if (!name) continue
					const rawValue = getTooltipRawYValue(item, name)
					const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
					if (!value || !Number.isFinite(value)) continue
					rows.push({ marker: item.marker ?? '', name, value })
				}
				rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

				let content = ''
				for (let index = 0; index < rows.length && index < 10; index++) {
					const row = rows[index]
					content += `<li style="list-style:none">${row.marker}${escapeSqlChartHtml(row.name)}&nbsp;&nbsp;${formatter.tooltip(row.value)}</li>`
				}
				return `<div style="font-weight:600;margin-bottom:4px">${header}</div>${content || '<div style="color:#999">No data</div>'}`
			}
		}
	} else {
		opts.tooltip = {
			trigger: 'axis',
			confine: true,
			formatter: createCappedRemainderTooltipFormatter({
				valueSymbol: formatter.valueSymbol,
				explicitRemainderLabel
			})
		}
	}

	return opts
}

function toXValue(value: unknown, axisType: 'time' | 'category'): number | string | null {
	if (value == null) return null
	if (axisType === 'time') return readSqlTimestampMs(value)
	const s = typeof value === 'string' ? value : String(value)
	return s === '' ? null : s
}

function toYValue(value: unknown): number | null {
	return readSqlNumber(value, true)
}
