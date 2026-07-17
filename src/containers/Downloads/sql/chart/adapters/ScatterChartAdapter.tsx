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
	title?: string
	xAxisLabel?: string
	yAxisLabel?: string
	valueSymbol?: string
	height?: string
	showLabels?: boolean
	tooltipFormatter?: (params: any) => string
	onReady?: (instance: any) => void
}

const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart')) as unknown as React.FC<IScatterChartShim>

interface ScatterChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: ClassifiedColumn[]
	onReady?: (instance: any) => void
}

export function ScatterChartAdapter({ config, result, classified, onReady }: ScatterChartAdapterProps) {
	const formatter = formatterFromConfig(config)

	const numericCols = classified.filter((c) => c.coarse === 'number').map((c) => c.name)
	const isNumeric = (name: string | null | undefined) => !!name && numericCols.includes(name)
	const xCol = isNumeric(config.xCol) ? (config.xCol as string) : (numericCols[0] ?? null)
	const yCol =
		isNumeric(config.yCols[0]) && config.yCols[0] !== xCol
			? config.yCols[0]
			: (numericCols.find((n) => n !== xCol) ?? null)
	const categoryCols = classified.filter((c) => c.coarse === 'category').map((c) => c.name)
	const labelCol = categoryCols.find((name) => /^(name|protocol|project|token)$/i.test(name)) ?? categoryCols[0] ?? null
	const groupCol =
		(config.splitByCol && categoryCols.includes(config.splitByCol) ? config.splitByCol : null) ??
		categoryCols.find((name) => name !== labelCol && /^category$/i.test(name)) ??
		categoryCols.find((name) => name !== labelCol) ??
		null
	const rankCol = numericCols.find((name) => /(^|_)rank$/i.test(name)) ?? null

	const chartData = useMemo(() => {
		if (!xCol || !yCol) return []
		const points: ScatterPresentationInput[] = []
		for (let index = 0; index < result.rows.length; index++) {
			const row = result.rows[index]
			const x = toNumber(row[xCol])
			const y = toNumber(row[yCol])
			if (x == null || y == null) continue
			const label = labelCol ? (row[labelCol] == null ? undefined : String(row[labelCol])) : undefined
			const group = groupCol ? (row[groupCol] == null ? 'Other' : String(row[groupCol])) : undefined
			const rank = rankCol ? toNumber(row[rankCol]) : null
			points.push({ x, y, label, group, importance: rank == null ? -index : -rank })
		}
		return buildScatterPresentation(points, config.seriesColors)
	}, [result, xCol, yCol, labelCol, groupCol, rankCol, config.seriesColors])

	const tooltipFormatter = (params: any) => {
		if (!params?.value || params.value.length < 2) return ''
		const [x, y, label] = params.value
		const lines: string[] = []
		if (label) lines.push(`<strong>${escape(String(label))}</strong>`)
		const group = params?.data?.groupName
		if (group) lines.push(`Category: ${escape(String(group))}`)
		lines.push(`${escape(xCol ?? 'x')}: ${formatter.tooltip(x)}`)
		lines.push(`${escape(yCol ?? 'y')}: ${formatter.tooltip(y)}`)
		return lines.join('<br/>')
	}

	if (!xCol || !yCol) return <EmptyHint message="Scatter needs at least two numeric columns." />

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

function EmptyHint({ message }: { message: string }) {
	return (
		<div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-subtle text-sm text-(--pro-text-secondary)">
			{message}
		</div>
	)
}
