import * as React from 'react'
import { formatTooltipChartDate, formatTooltipValue } from '~/components/ECharts/formatters'
import { Tooltip } from '~/ui/Tooltip'

// MultiSeriesChart's tooltip formats every series with a single valueSymbol, so a '%' series sharing
// a chart with '$' series (supply/borrow vs utilization) shows as '$'. Override just the tooltip
// formatter via chartOptions — keeps the shared chart component untouched. Series carrying '%' in
// their name (e.g. "Utilization %") render as a percentage; everything else as USD.
export const dollarPctChartOptions = {
	tooltip: {
		formatter: (params: Array<{ value: [number, number | null | '-']; marker: string; seriesName: string }>) => {
			const date = formatTooltipChartDate(params[0].value[0], 'daily')
			const rows = params
				.filter((p) => p.value[1] != null && p.value[1] !== '-')
				.map(
					(p) =>
						`<li style="list-style:none">${p.marker}${p.seriesName}&nbsp;&nbsp;${formatTooltipValue(
							Number(p.value[1]),
							p.seriesName.includes('%') ? '%' : '$'
						)}</li>`
				)
				.join('')
			return date + rows
		}
	}
}

export function KpiCard({
	label,
	value,
	sub,
	info
}: {
	label: string
	value?: string | number
	sub?: string
	/** When set, renders a "*" next to the label that reveals this text on hover. */
	info?: string
}) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="flex items-center gap-0.5 text-xs font-medium tracking-wide text-pro-text-label">
				{label}
				{info && (
					<Tooltip content={info} className="cursor-help">
						<span className="text-pro-text-secondary">*</span>
					</Tooltip>
				)}
			</span>
			{value != null ? (
				<span className="text-2xl font-semibold text-pro-text-primary">{value}</span>
			) : (
				<div className="h-7 w-24 animate-pulse rounded-sm bg-tertiary opacity-20" />
			)}
			{sub && <span className="text-[11px] text-pro-text-secondary">{sub}</span>}
		</div>
	)
}

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
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-1 text-sm font-medium text-pro-text-label">{title}</h3>
			{subtitle && <p className="mb-3 text-xs text-pro-text-secondary">{subtitle}</p>}
			{children}
		</div>
	)
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="text-xs font-semibold tracking-wider text-pro-text-label uppercase">{children}</h2>
}

export function formatNullablePercent(value: number | null): string {
	return value == null ? '—' : `${value}%`
}

export function ChartSkeleton({ title, height = 'h-[350px]' }: { title: string; height?: string }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			<div className={`flex ${height} items-center justify-center`}>
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
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
	rows,
	cols,
	empty = 'No data'
}: {
	rows: Row[] | undefined
	cols: Array<Col<Row>>
	empty?: string
}) {
	if (!rows || rows.length === 0) return <div className="px-2 py-4 text-xs text-pro-text-secondary">{empty}</div>
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-pro-cards-border bg-pro-app-bg/40">
						{cols.map((c) => (
							<th
								key={c.key}
								className={`px-3 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-pro-text-label uppercase ${c.right ? 'text-right' : 'text-left'}`}
							>
								{c.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((r, i) => (
						<tr
							key={i}
							className="border-b border-pro-cards-border/60 transition-colors last:border-0 hover:bg-sl-hover-bg"
						>
							{cols.map((c) => {
								const value: unknown = c.render ? c.render(r) : Reflect.get(r, c.key)
								return (
									<td
										key={c.key}
										className={`px-3 py-2.5 ${c.right ? 'text-right font-medium text-pro-text-primary tabular-nums' : 'text-pro-text-secondary'}`}
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
	const s = v < 0 ? '-' : ''
	if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`
	if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`
	if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`
	return `${s}$${a.toFixed(0)}`
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
	if (v == null || Number.isNaN(v)) return '—'
	return v.toLocaleString(undefined, { maximumFractionDigits: digits })
}
export function UtilBar({ pct }: { pct: number | null | undefined }) {
	const p = Math.min(100, Math.max(0, pct ?? 0))
	const color = p >= 90 ? '#f87171' : p >= 70 ? '#fbbf24' : '#6366f1'
	return (
		<div className="flex items-center justify-end gap-2">
			<div className="h-2 w-20 shrink-0 rounded-sm bg-pro-cards-border">
				<div style={{ width: `${p}%`, background: color }} className="h-2 rounded-sm" />
			</div>
			<span className="min-w-[44px] text-right">{p.toFixed(1)}%</span>
		</div>
	)
}
