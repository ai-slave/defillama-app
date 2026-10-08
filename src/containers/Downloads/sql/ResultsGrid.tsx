import { lazy, Suspense, useMemo, useRef } from 'react'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { formatNumber } from '~/utils/numberFormat'
import { inferFineKindFromArrowType, type FineKind } from './columnKind'
import type { QueryResult } from './exportResults'
import { TypeBadge } from './primitives'

interface SparklineShim {
	data?: Array<[number, number]>
	color?: string
	height?: number | string
	smooth?: boolean
}

const SparklineChart = lazy(() =>
	import('~/components/ECharts/SparklineChart').then((m) => ({ default: m.SparklineChart }))
) as unknown as React.FC<SparklineShim>

const ROW_HEIGHT = 28
const HEADER_HEIGHT = 42

interface ResultsGridProps {
	result: QueryResult
}

export function ResultsGrid({ result }: ResultsGridProps) {
	const parentRef = useRef<HTMLDivElement>(null)

	const rowVirtualizer = useVirtualItems({
		count: result.rows.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 12
	})

	const columnMeta = useMemo(
		() =>
			result.columns.map((c, columnIndex) => {
				let kind = inferFineKindFromArrowType(c.type)
				if (kind === 'other') {
					const sample = result.rows.find((row) => row[columnIndex] != null)
					if (
						sample &&
						Array.isArray(sample[columnIndex]) &&
						(sample[columnIndex] as Array<any>).every((v) => v == null || typeof v === 'number')
					) {
						kind = 'list'
					}
				}
				const width = kind === 'list' ? 140 : estimateColumnWidth(c.name, result.rows, columnIndex, kind)
				return { ...c, columnIndex, kind, width }
			}),
		[result]
	)

	const gridTemplate = useMemo(() => columnMeta.map((c) => `${c.width}px`).join(' '), [columnMeta])
	const totalWidth = useMemo(() => columnMeta.reduce((sum, c) => sum + c.width, 0), [columnMeta])

	return (
		<div ref={parentRef} className="relative max-h-[420px] overflow-auto rounded-[4px] border border-subtle bg-surface">
			<div style={{ width: Math.max(totalWidth, 0), minWidth: '100%' }}>
				<div
					role="row"
					className="sticky top-0 z-20 grid border-b border-subtle mono-sm text-pro-text-secondary"
					style={{
						gridTemplateColumns: gridTemplate,
						height: HEADER_HEIGHT,
						background: 'var(--bg-surface)'
					}}
				>
					{columnMeta.map((col) => {
						const isNumeric = col.kind === 'int' || col.kind === 'float'
						return (
							<div
								role="columnheader"
								key={col.columnIndex}
								className={`border-subtle/60 flex flex-col justify-center gap-0.5 truncate border-l px-2.5 first:border-l-0 ${
									isNumeric ? 'items-end text-right' : 'items-start text-left'
								}`}
							>
								<div className="flex items-center gap-1.5">
									<TypeBadge kind={col.kind} />
									<span className="truncate font-mono font-bold text-pro-text-primary">{col.name}</span>
								</div>
								<span className="truncate mono-sm tracking-tight text-pro-text-tertiary/80">{col.type}</span>
							</div>
						)
					})}
				</div>
				<div style={{ height: rowVirtualizer.totalSize, position: 'relative' }}>
					{rowVirtualizer.items.map((v) => {
						const row = result.rows[v.index]
						const zebra = v.index % 2 === 1
						return (
							<div
								role="row"
								key={v.index}
								className={`absolute inset-x-0 grid mono-sm tabular-nums transition-colors hover:bg-brand/5 ${
									zebra ? 'bg-pro-app-bg/25' : ''
								}`}
								style={{
									transform: `translateY(${v.start}px)`,
									height: ROW_HEIGHT,
									gridTemplateColumns: gridTemplate
								}}
							>
								{columnMeta.map((col) => {
									const value = row[col.columnIndex]
									const isNull = value === null || value === undefined || value === ''
									const isNumeric = col.kind === 'int' || col.kind === 'float'
									const isList = col.kind === 'list' && Array.isArray(value)
									return (
										<div
											role="cell"
											key={col.columnIndex}
											className={`border-subtle/30 flex items-center truncate border-l px-2.5 first:border-l-0 ${
												isNumeric ? 'justify-end text-pro-text-primary' : 'text-pro-text-primary'
											} ${isNull ? 'text-pro-text-tertiary/50' : ''}`}
											title={isNull || isList ? '' : cellToTitle(value)}
										>
											{isList ? (
												<Suspense fallback={<span className="mono-sm text-pro-text-tertiary">…</span>}>
													<SparklineChart data={toSparklineData(value as Array<unknown>)} height={20} />
												</Suspense>
											) : (
												<span className="truncate">
													{isNull ? <span aria-hidden>·</span> : formatCell(value, col.kind)}
												</span>
											)}
										</div>
									)
								})}
							</div>
						)
					})}
					{result.rows.length === 0 ? (
						<div className="flex items-center justify-center py-8 mono-sm text-pro-text-tertiary">0 rows</div>
					) : null}
				</div>
			</div>
		</div>
	)
}

function toSparklineData(values: Array<unknown>): Array<[number, number]> {
	const data: Array<[number, number]> = []
	for (let index = 0; index < values.length; index++) {
		const value = values[index]
		if (typeof value === 'number' && Number.isFinite(value)) {
			data.push([index, value])
		}
	}
	return data
}

function formatCell(value: unknown, kind: FineKind): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'bigint') return value.toLocaleString()
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return String(value)
		if (kind === 'date') {
			const date = new Date(value > 1e12 ? value : value * 1000)
			if (Number.isFinite(date.getTime())) return date.toISOString().slice(0, 10)
		}
		if (Number.isInteger(value)) return formatNumber(value, { maximumFractionDigits: 0 })
		return formatNumber(value, { maximumFractionDigits: 6 })
	}
	if (value instanceof Date) return value.toISOString().slice(0, 10)
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value)
		} catch {
			return String(value)
		}
	}
	return String(value)
}

function cellToTitle(value: unknown): string {
	const formatted = formatCell(value, 'other')
	return formatted.length > 60 ? formatted : ''
}

function estimateColumnWidth(header: string, rows: Array<Array<unknown>>, columnIndex: number, kind: FineKind): number {
	const sample = rows.slice(0, 40)
	let max = header.length + 3
	for (const row of sample) {
		const rendered = formatCell(row[columnIndex], kind)
		if (rendered.length > max) max = rendered.length
	}
	const charWidth = kind === 'int' || kind === 'float' ? 7.2 : 7
	return Math.max(96, Math.min(max * charWidth + 28, 320))
}
