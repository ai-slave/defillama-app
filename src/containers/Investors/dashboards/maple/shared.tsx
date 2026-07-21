import type { Table } from '@tanstack/react-table'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'

export const MAPLE_USD_CATEGORY_CHART_OPTIONS = createCategoryChartOptions('$')
export const MAPLE_PERCENT_CATEGORY_CHART_OPTIONS = createCategoryChartOptions('%')
export const MAPLE_DOLLAR_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('$')
export const MAPLE_UNITLESS_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('')

export const MAPLE_CSV_ONLY_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			{children}
		</div>
	)
}

export function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			<div className="flex h-[400px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
	)
}

export function KpiCard({ label, value }: { label: string; value: string | number | null }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<span className="text-2xl font-semibold text-pro-text-primary">{value ?? '—'}</span>
		</div>
	)
}

export function KpiSkeleton({ label }: { label: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<div className="h-8 w-24 animate-pulse rounded-sm bg-tertiary opacity-20" />
		</div>
	)
}

export function Pagination<T>({ table }: { table: Table<T> }) {
	const { pageIndex, pageSize } = table.getState().pagination
	const total = table.getFilteredRowModel().rows.length

	return (
		<div className="mt-2 flex items-center justify-between text-xs text-pro-text-label">
			<span>
				{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} of {total}
			</span>
			<div className="flex gap-2">
				<button
					onClick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
					className="disabled:opacity-30"
				>
					← Prev
				</button>
				<button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="disabled:opacity-30">
					Next →
				</button>
			</div>
		</div>
	)
}

export const formatPct = (v: number | null) => (v != null ? `${v.toFixed(2)}%` : '—')
