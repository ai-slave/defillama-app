import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import type { ScatterTooltipParams } from '~/components/ECharts/ScatterChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { readSqlNumber } from '../rowValues'
import { makeValueFormatter } from '../valueFormatters'
import { buildScatterPresentation, type ScatterPresentationInput } from './scatterPresentation'

const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart'))

const MIN_SYMBOL = 9
const MAX_SYMBOL = 40

interface BubbleChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height: string
}

export function BubbleChartAdapter({ config, result, classified, onReady, height }: BubbleChartAdapterProps) {
	const formatter = useMemo(() => makeValueFormatter(config.numberFormat), [config.numberFormat])
	const numericCols = classified.filter((c) => c.coarse === 'number')
	const xCol = numericCols.find((column) => column.name === config.xCol) ?? numericCols[0] ?? null
	const yCol =
		numericCols.find((column) => column.name === config.yCols[0] && column !== xCol) ??
		numericCols.find((column) => column !== xCol) ??
		null
	const fallbackSize = numericCols.find((column) => column !== xCol && column !== yCol) ?? null
	const sizeCol =
		numericCols.find((column) => column.name === config.bubble?.sizeCol && column !== xCol && column !== yCol) ??
		fallbackSize
	const categoryCols = classified.filter((c) => c.coarse === 'category')
	const labelCol =
		categoryCols.find((column) => /^(name|protocol|project|token)$/i.test(column.name)) ?? categoryCols[0] ?? null
	const groupCol =
		categoryCols.find((column) => column.name === config.splitByCol) ??
		categoryCols.find((column) => column !== labelCol && /^category$/i.test(column.name)) ??
		categoryCols.find((column) => column !== labelCol) ??
		null

	const chartData = useMemo(() => {
		if (!xCol || !yCol || !sizeCol) return []
		const raw: Array<{ x: number; y: number; size: number; label?: string; group?: string }> = []
		let sizeMin = Infinity
		let sizeMax = -Infinity
		for (const row of result.rows) {
			const x = readSqlNumber(row[xCol.index])
			const y = readSqlNumber(row[yCol.index])
			const s = readSqlNumber(row[sizeCol.index])
			if (x == null || y == null || s == null) continue
			const labelValue = labelCol ? row[labelCol.index] : null
			const groupValue = groupCol ? row[groupCol.index] : null
			const label = labelValue == null ? undefined : String(labelValue)
			const group = groupCol ? (groupValue == null ? 'Other' : String(groupValue)) : undefined
			raw.push({ x, y, size: s, label, group })
			if (s < sizeMin) sizeMin = s
			if (s > sizeMax) sizeMax = s
		}
		if (raw.length === 0) return []
		const span = sizeMax - sizeMin || 1
		const points = new Array<ScatterPresentationInput>(raw.length)
		for (let index = 0; index < raw.length; index++) {
			const point = raw[index]
			const symbolSize = MIN_SYMBOL + ((point.size - sizeMin) / span) * (MAX_SYMBOL - MIN_SYMBOL)
			points[index] = {
				x: point.x,
				y: point.y,
				label: point.label,
				group: point.group,
				importance: symbolSize,
				symbolSize,
				valueExtra: point.size
			}
		}
		return buildScatterPresentation(points, config.seriesColors)
	}, [result, xCol, yCol, sizeCol, labelCol, groupCol, config.seriesColors])

	const tooltipFormatter = (params: ScatterTooltipParams) => {
		const [x, y, label, size] = params?.value ?? []
		const lines: Array<string> = []
		if (label) lines.push(`<strong>${escapeHtml(String(label))}</strong>`)
		const group = params.data && !Array.isArray(params.data) ? params.data.groupName : undefined
		if (group) lines.push(`Category: ${escapeHtml(String(group))}`)
		lines.push(`${escapeHtml(xCol?.name ?? 'x')}: ${formatter.tooltip(x)}`)
		lines.push(`${escapeHtml(yCol?.name ?? 'y')}: ${formatter.tooltip(y)}`)
		if (sizeCol) {
			lines.push(`${escapeHtml(sizeCol.name)}: ${formatter.tooltip(readSqlNumber(size) ?? 0)}`)
		}
		return lines.join('<br/>')
	}

	if (!xCol || !yCol || !sizeCol)
		return (
			<div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-subtle body-md text-secondary">
				Bubble needs at least three numeric columns (x, y, size).
			</div>
		)
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
