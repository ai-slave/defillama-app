import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import type { ScatterTooltipParams } from '~/components/ECharts/ScatterChart/types'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { escapeSqlChartHtml, readSqlNumber } from '../rowValues'
import { makeValueFormatter } from '../valueFormatters'
import { buildScatterPresentation, type ScatterPresentationInput } from './scatterPresentation'

const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart'))

interface ScatterChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height: string
}

export function ScatterChartAdapter({ config, result, classified, onReady, height }: ScatterChartAdapterProps) {
	const formatter = useMemo(() => makeValueFormatter(config.numberFormat), [config.numberFormat])

	const numericCols = classified.filter((c) => c.coarse === 'number')
	const xCol = numericCols.find((column) => column.name === config.xCol) ?? numericCols[0] ?? null
	const yCol =
		numericCols.find((column) => column.name === config.yCols[0] && column !== xCol) ??
		numericCols.find((column) => column !== xCol) ??
		null
	const categoryCols = classified.filter((c) => c.coarse === 'category')
	const labelCol =
		categoryCols.find((column) => /^(name|protocol|project|token)$/i.test(column.name)) ?? categoryCols[0] ?? null
	const groupCol =
		categoryCols.find((column) => column.name === config.splitByCol) ??
		categoryCols.find((column) => column !== labelCol && /^category$/i.test(column.name)) ??
		categoryCols.find((column) => column !== labelCol) ??
		null
	const rankCol = numericCols.find((column) => /(^|_)rank$/i.test(column.name)) ?? null

	const chartData = useMemo(() => {
		if (!xCol || !yCol) return []
		const points: Array<ScatterPresentationInput> = []
		for (let index = 0; index < result.rows.length; index++) {
			const row = result.rows[index]
			const x = readSqlNumber(row[xCol.index])
			const y = readSqlNumber(row[yCol.index])
			if (x == null || y == null) continue
			const labelValue = labelCol ? row[labelCol.index] : null
			const groupValue = groupCol ? row[groupCol.index] : null
			const label = labelValue == null ? undefined : String(labelValue)
			const group = groupCol ? (groupValue == null ? 'Other' : String(groupValue)) : undefined
			const rank = rankCol ? readSqlNumber(row[rankCol.index]) : null
			points.push({ x, y, label, group, importance: rank == null ? -index : -rank })
		}
		return buildScatterPresentation(points, config.seriesColors)
	}, [result, xCol, yCol, labelCol, groupCol, rankCol, config.seriesColors])

	const tooltipFormatter = (params: ScatterTooltipParams) => {
		if (!params?.value || params.value.length < 2) return ''
		const [x, y, label] = params.value
		const lines: Array<string> = []
		if (label) lines.push(`<strong>${escapeSqlChartHtml(String(label))}</strong>`)
		const group = params.data && !Array.isArray(params.data) ? params.data.groupName : undefined
		if (group) lines.push(`Category: ${escapeSqlChartHtml(String(group))}`)
		lines.push(`${escapeSqlChartHtml(xCol?.name ?? 'x')}: ${formatter.tooltip(x)}`)
		lines.push(`${escapeSqlChartHtml(yCol?.name ?? 'y')}: ${formatter.tooltip(y)}`)
		return lines.join('<br/>')
	}

	if (!xCol || !yCol) return <EmptyHint message="Scatter needs at least two numeric columns." />

	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center" style={{ height }}>
					<LoadingSpinner size={18} />
				</div>
			}
		>
			<ScatterChart
				chartData={chartData}
				xAxisLabel={xCol.name}
				yAxisLabel={yCol.name}
				valueSymbol={formatter.valueSymbol}
				height={height}
				showLabels
				tooltipFormatter={tooltipFormatter}
				onReady={onReady}
			/>
		</Suspense>
	)
}

function EmptyHint({ message }: { message: string }) {
	return (
		<div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-subtle text-sm text-pro-text-secondary">
			{message}
		</div>
	)
}
