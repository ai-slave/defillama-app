import { lazy, Suspense, useMemo } from 'react'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { SQL_CHART_HEIGHT } from '../chartLayout'
import { formatterFromConfig } from '../valueFormatters'
import { buildScatterPresentation, type ScatterPresentationInput } from './scatterPresentation'

interface IScatterChartShim {
	chartData: Array<Record<string, any>>
	xAxisLabel?: string
	yAxisLabel?: string
	valueSymbol?: string
	height?: string
	showLabels?: boolean
	tooltipFormatter?: (params: any) => string
	onReady?: (instance: any) => void
	title?: string
}

const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart')) as unknown as React.FC<IScatterChartShim>

const MIN_SYMBOL = 9
const MAX_SYMBOL = 40

interface BubbleChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: ClassifiedColumn[]
	onReady?: (instance: any) => void
}

export function BubbleChartAdapter({ config, result, classified, onReady }: BubbleChartAdapterProps) {
	const formatter = formatterFromConfig(config)
	const numericCols = classified.filter((c) => c.coarse === 'number').map((c) => c.name)
	const isNumeric = (name: string | null | undefined) => !!name && numericCols.includes(name)
	const xCol = isNumeric(config.xCol) ? (config.xCol as string) : (numericCols[0] ?? null)
	const yCol =
		isNumeric(config.yCols[0]) && config.yCols[0] !== xCol
			? config.yCols[0]
			: (numericCols.find((n) => n !== xCol) ?? null)
	const fallbackSize = numericCols.find((n) => n !== xCol && n !== yCol) ?? null
	const sizeCol =
		isNumeric(config.bubble?.sizeCol ?? null) && config.bubble?.sizeCol !== xCol && config.bubble?.sizeCol !== yCol
			? config.bubble!.sizeCol!
			: fallbackSize
	const categoryCols = classified.filter((c) => c.coarse === 'category').map((c) => c.name)
	const labelCol = categoryCols.find((name) => /^(name|protocol|project|token)$/i.test(name)) ?? categoryCols[0] ?? null
	const groupCol =
		(config.splitByCol && categoryCols.includes(config.splitByCol) ? config.splitByCol : null) ??
		categoryCols.find((name) => name !== labelCol && /^category$/i.test(name)) ??
		categoryCols.find((name) => name !== labelCol) ??
		null

	const chartData = useMemo(() => {
		if (!xCol || !yCol || !sizeCol) return []
		const raw: Array<{ x: number; y: number; size: number; label?: string; group?: string }> = []
		for (const row of result.rows) {
			const x = toNumber(row[xCol])
			const y = toNumber(row[yCol])
			const s = toNumber(row[sizeCol])
			if (x == null || y == null || s == null) continue
			const label = labelCol ? (row[labelCol] == null ? undefined : String(row[labelCol])) : undefined
			const group = groupCol ? (row[groupCol] == null ? 'Other' : String(row[groupCol])) : undefined
			raw.push({ x, y, size: s, label, group })
		}
		if (raw.length === 0) return []
		const sMin = Math.min(...raw.map((r) => r.size))
		const sMax = Math.max(...raw.map((r) => r.size))
		const span = sMax - sMin || 1
		const points: ScatterPresentationInput[] = raw.map((point) => {
			const symbolSize = MIN_SYMBOL + ((point.size - sMin) / span) * (MAX_SYMBOL - MIN_SYMBOL)
			return {
				x: point.x,
				y: point.y,
				label: point.label,
				group: point.group,
				importance: symbolSize,
				symbolSize,
				valueExtra: point.size
			}
		})
		return buildScatterPresentation(points, config.seriesColors)
	}, [result, xCol, yCol, sizeCol, labelCol, groupCol, config.seriesColors])

	const tooltipFormatter = (params: any) => {
		const [x, y, label, size] = params?.value ?? []
		const lines: string[] = []
		if (label) lines.push(`<strong>${escape(String(label))}</strong>`)
		const group = params?.data?.groupName
		if (group) lines.push(`Category: ${escape(String(group))}`)
		lines.push(`${escape(xCol ?? 'x')}: ${formatter.tooltip(x)}`)
		lines.push(`${escape(yCol ?? 'y')}: ${formatter.tooltip(y)}`)
		if (sizeCol) lines.push(`${escape(sizeCol)}: ${formatter.tooltip(size)}`)
		return lines.join('<br/>')
	}

	if (!xCol || !yCol || !sizeCol)
		return (
			<div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-subtle text-sm text-pro-text-secondary">
				Bubble needs at least three numeric columns (x, y, size).
			</div>
		)
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center" style={{ height: SQL_CHART_HEIGHT }}>
					<LoadingSpinner size={18} />
				</div>
			}
		>
			<ScatterChart
				chartData={chartData as any}
				xAxisLabel={xCol}
				yAxisLabel={yCol}
				valueSymbol={formatter.valueSymbol}
				height={SQL_CHART_HEIGHT}
				showLabels
				tooltipFormatter={tooltipFormatter}
				onReady={onReady}
			/>
		</Suspense>
	)
}

function toNumber(v: unknown): number | null {
	if (typeof v === 'number') return Number.isFinite(v) ? v : null
	if (typeof v === 'bigint') return Number(v)
	if (typeof v === 'string') {
		const n = Number(v.trim())
		return Number.isFinite(n) ? n : null
	}
	return null
}

function escape(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
