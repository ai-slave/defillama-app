import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import type { HeadlessChartExportButtons } from '~/components/ChartExport/types'
import type { PieTooltipParams } from '~/components/ECharts/PieChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { CHART_SERIES_LIMIT, chartColor, OTHERS_COLOR } from '~/constants/colors'
import { EmptyState, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { formatPercent } from '~/utils/numberFormat'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { readSqlNumber } from '../rowValues'
import { makeValueFormatter } from '../valueFormatters'

const PieChart = lazy(() => import('~/components/ECharts/PieChart'))

interface PieChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	exportButtons: HeadlessChartExportButtons
	height: string
}

export function PieChartAdapter({ config, result, classified, onReady, exportButtons, height }: PieChartAdapterProps) {
	const formatter = useMemo(() => makeValueFormatter(config.numberFormat), [config.numberFormat])
	const nameCol = classified.find(
		(column) => column.name === (config.xCol ?? classified.find((c) => c.coarse === 'category')?.name)
	)
	const valueCol = classified.find(
		(column) => column.name === (config.yCols[0] ?? classified.find((c) => c.coarse === 'number')?.name)
	)

	const { chartData, stackColors, truncated } = useMemo(() => {
		return nameCol && valueCol
			? buildSqlPieData(result.rows, nameCol.index, valueCol.index, config.seriesColors)
			: { chartData: [], stackColors: {}, truncated: 0 }
	}, [result, nameCol, valueCol, config.seriesColors])

	const isDonut = config.chartType === 'donut'

	const tooltipFormatter = (params: PieTooltipParams) => {
		const value = readSqlNumber(params.value) ?? 0
		const percent = typeof params.percent === 'number' ? params.percent : 0
		return `<strong>${escapeHtml(String(params.name ?? ''))}</strong><br/>${formatter.tooltip(value)} (${formatPercent(percent, { input: 'percent' })})`
	}

	if (!nameCol || !valueCol)
		return (
			<EmptyState size="md" icon="bar-chart-2" title="Not enough columns for a pie" framed className="h-[220px]">
				Pie needs a category column and a numeric column.
			</EmptyState>
		)

	return (
		<div className="flex flex-col gap-1.5">
			<Suspense
				fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-0 w-full" style={{ height }} />}
			>
				<PieChart
					exportButtons={exportButtons}
					chartData={chartData}
					stackColors={stackColors}
					valueSymbol={formatter.valueSymbol}
					radius={isDonut ? ['42%', '70%'] : undefined}
					showLegend
					height={height}
					tooltipFormatter={tooltipFormatter}
					onReady={onReady}
				/>
			</Suspense>
			{truncated > 0 ? (
				<p className="body-sm text-tertiary">
					Top {CHART_SERIES_LIMIT} slices. {truncated} folded into Other.
				</p>
			) : null}
		</div>
	)
}

export function buildSqlPieData(
	rows: Array<Array<unknown>>,
	nameIndex: number,
	valueIndex: number,
	seriesColors: Record<string, string>
) {
	const totals = new Map<string, number>()
	for (const row of rows) {
		const rawName = row[nameIndex]
		const name = rawName == null ? '∅' : String(rawName)
		const value = readSqlNumber(row[valueIndex])
		if (value == null) continue
		totals.set(name, (totals.get(name) ?? 0) + value)
	}

	// A query's own "Other" category joins the folded tail, so the chart draws one Other slice, last.
	const existingOther = totals.get('Other')
	totals.delete('Other')
	const entries = [...totals.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
	const top = entries.slice(0, CHART_SERIES_LIMIT)
	const rest = entries.slice(CHART_SERIES_LIMIT)
	const chartData = top.map(([name, value]) => ({ name, value }))
	if (rest.length > 0 || existingOther !== undefined) {
		let otherValue = existingOther ?? 0
		for (const [, value] of rest) otherValue += value
		chartData.push({ name: 'Other', value: otherValue })
	}

	const configuredColors = new Map(Object.entries(seriesColors))
	const colorEntries = new Array<[string, string]>(chartData.length)
	for (let index = 0; index < chartData.length; index++) {
		const name = chartData[index].name
		colorEntries[index] = [name, configuredColors.get(name) ?? (name === 'Other' ? OTHERS_COLOR : chartColor(index))]
	}
	return { chartData, stackColors: Object.fromEntries(colorEntries), truncated: rest.length }
}
