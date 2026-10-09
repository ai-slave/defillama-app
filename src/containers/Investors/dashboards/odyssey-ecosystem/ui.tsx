import * as React from 'react'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { keyedOccurrences, type RowIdentity } from '~/utils/keyedOccurrences'
import { formatPercent, formatUsd } from '~/utils/numberFormat'

export function ChartCard({
	title,
	subtitle,
	children
}: {
	title: string
	subtitle?: string
	children: React.ReactNode
}) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-1 label-md text-secondary">{title}</h3>
			{subtitle && <p className="mb-3 body-sm text-secondary">{subtitle}</p>}
			{children}
		</div>
	)
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{children}</h2>
}

export function ChartSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			<SurfaceBodyLoadingStatus className="min-h-[350px]" />
		</div>
	)
}

export interface Col<Row> {
	key: string
	label: string
	right?: boolean
	render?: (row: Row) => React.ReactNode
}

function renderTableValue(value: unknown): React.ReactNode {
	if (value == null || value === '') return '—'
	if (React.isValidElement(value) || typeof value === 'string' || typeof value === 'number') return value
	return String(value)
}

export function SimpleTable<Row extends object>({
	getRowKey,
	getOccurrenceKey,
	rows,
	cols,
	empty = 'No data'
}: {
	rows: Array<Row> | undefined
	cols: Array<Col<Row>>
	empty?: string
} & RowIdentity<Row>) {
	if (!rows || rows.length === 0) return <div className="px-2 py-4 body-sm text-secondary">{empty}</div>
	return (
		<div className="overflow-x-auto">
			<table className="w-full body-md">
				<thead>
					<tr className="border-b border-subtle bg-page">
						{cols.map((c) => (
							<th
								key={c.key}
								className={`px-3 py-2.5 title-sm tracking-wider whitespace-nowrap text-secondary uppercase ${c.right ? 'text-right' : 'text-left'}`}
							>
								{c.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{(getRowKey
						? rows.map((item) => ({ item, key: getRowKey(item) }))
						: keyedOccurrences(rows, getOccurrenceKey)
					).map(({ item: r, key }) => (
						<tr key={key} className="border-b border-subtle transition-colors last:border-0 hover:bg-hover-row">
							{cols.map((c) => {
								const value: unknown = c.render ? c.render(r) : Reflect.get(r, c.key)
								return (
									<td
										key={c.key}
										className={`px-3 py-2.5 ${c.right ? 'text-right font-medium text-primary tabular-nums' : 'text-secondary'}`}
									>
										{renderTableValue(value)}
									</td>
								)
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

export function fmtUsd(v: number | null | undefined): string {
	if (v == null || Number.isNaN(v)) return '—'
	const a = Math.abs(v)
	const fractionDigits = a >= 1e6 ? 2 : a >= 1e3 ? 1 : 0
	return formatUsd(v, {
		compact: true,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

export function UtilBar({ pct }: { pct: number | null | undefined }) {
	const p = Math.min(100, Math.max(0, pct ?? 0))
	const color = p >= 90 ? '#f87171' : p >= 70 ? '#fbbf24' : '#6366f1'
	return (
		<div className="flex items-center justify-end gap-2">
			<div className="h-2 w-20 shrink-0 rounded-sm bg-surface-elevated-2">
				<div style={{ width: `${p}%`, background: color }} className="h-2 rounded-sm" />
			</div>
			<span className="min-w-[44px] text-right">
				{formatPercent(p, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}
			</span>
		</div>
	)
}
