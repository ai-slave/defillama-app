import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { CHART_COLORS } from '~/constants/colors'
import { ChartPanelBodyLoading } from '~/ui/ChartPanel'
import { EmptyState } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { readSqlNumber } from '../rowValues'
import { makeValueFormatter } from '../valueFormatters'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface HistogramChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height: string
}

export function HistogramChartAdapter({ config, result, classified, onReady, height }: HistogramChartAdapterProps) {
	const formatter = useMemo(() => makeValueFormatter(config.numberFormat), [config.numberFormat])
	const valueColName =
		config.histogram?.valueCol ?? config.yCols[0] ?? classified.find((c) => c.coarse === 'number')?.name ?? null
	const valueCol = classified.find((column) => column.name === valueColName) ?? null
	const binCount = Math.max(5, Math.min(200, config.histogram?.binCount ?? 30))

	const { chartModel, chartOptions } = useMemo(() => {
		if (!valueCol) return { chartModel: buildAlignedCartesianChartModel([], []), chartOptions: {} }
		const configuredColors = new Map(Object.entries(config.seriesColors))
		const values: Array<number> = []
		let min = Infinity
		let max = -Infinity
		for (const row of result.rows) {
			const value = readSqlNumber(row[valueCol.index])
			if (value == null) continue
			values.push(value)
			if (value < min) min = value
			if (value > max) max = value
		}
		if (values.length === 0) return { chartModel: buildAlignedCartesianChartModel([], []), chartOptions: {} }
		const span = max - min || 1
		const width = span / binCount
		const counts = new Array(binCount).fill(0)
		for (const v of values) {
			const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / width)))
			counts[idx] += 1
		}
		const categories = new Array<string>(counts.length)
		for (let i = 0; i < counts.length; i++) {
			const lo = min + i * width
			const hi = lo + width
			categories[i] = `${formatter.axis(lo)} – ${formatter.axis(hi)}`
		}
		return {
			chartModel: buildAlignedCartesianChartModel(
				categories,
				[
					{
						name: valueCol.name,
						type: 'bar' as const,
						color: configuredColors.get(valueCol.name) ?? CHART_COLORS[0],
						values: counts
					}
				],
				{ xDimension: 'bin', timestampMultiplier: 1 }
			),
			chartOptions: {
				yAxis: { axisLabel: { formatter: (v: number) => String(v) } },
				xAxis: { type: 'category', axisLabel: { rotate: binCount > 12 ? 35 : 0, fontSize: 10 } },
				grid: { bottom: 60 },
				tooltip: {
					trigger: 'axis',
					confine: true,
					formatter: (params: unknown) => {
						const items = normalizeTooltipItems(params)
						if (items.length === 0) return ''
						const p = items[0]
						const bin = escapeHtml(String(p.axisValue ?? p.name ?? ''))
						const name = p.seriesName ?? ''
						const count = Number(getTooltipRawYValue(p, name) ?? 0)
						return `<div style="font-weight:600;margin-bottom:4px">${bin}</div><div>${p.marker ?? ''}${escapeHtml(name)}&nbsp;&nbsp;${formatNumber(count)}</div>`
					}
				}
			} satisfies MultiSeriesChartOptions
		}
	}, [result, valueCol, binCount, formatter, config.seriesColors])

	if (!valueCol)
		return (
			<EmptyState size="md" icon="bar-chart-2" title="Not enough columns for a histogram" framed className="h-[220px]">
				Histogram needs a numeric column.
			</EmptyState>
		)

	return (
		<Suspense fallback={<ChartPanelBodyLoading className="min-h-0 w-full" style={{ height }} />}>
			<MultiSeriesChart
				dataset={chartModel.dataset}
				charts={chartModel.charts}
				height={height}
				hideDataZoom
				chartOptions={chartOptions}
				onReady={onReady}
				showLegend
				exportButtons="hidden"
			/>
		</Suspense>
	)
}
