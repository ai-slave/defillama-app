import { useSelector } from '@tanstack/react-store'
import type { RowData as TableRowData } from '@tanstack/react-table'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { PaginatedTableInstance, PaginationFeatures } from '~/components/Table/features/contracts'
import { TablePager } from '~/containers/Investors/TablePager'
import { Skeleton } from '~/ui/Skeleton'

export const MAPLE_USD_CATEGORY_CHART_OPTIONS = createCategoryChartOptions('$')
export const MAPLE_PERCENT_CATEGORY_CHART_OPTIONS = createCategoryChartOptions('%')
export const MAPLE_DOLLAR_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('$')
export const MAPLE_UNITLESS_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('')

export const MAPLE_CSV_ONLY_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			{children}
		</div>
	)
}

export function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			<div className="flex h-[400px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
	)
}

export function KpiCard({ label, value }: { label: string; value: string | number | null }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-subtle bg-surface p-4">
			<span className="label-sm tracking-wide text-secondary">{label}</span>
			<span className="mono-xl text-primary">{value ?? '—'}</span>
		</div>
	)
}

export function KpiSkeleton({ label }: { label: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-subtle bg-surface p-4">
			<span className="label-sm tracking-wide text-secondary">{label}</span>
			<Skeleton className="h-8 w-24" />
		</div>
	)
}

export function Pagination<F extends PaginationFeatures, T extends TableRowData>({
	table
}: {
	table: PaginatedTableInstance<F, T>
}) {
	const { pageIndex, pageSize } = useSelector(table.atoms.pagination)
	const total = table.getFilteredRowModel().rows.length

	return (
		<TablePager
			label={
				<>
					{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} of {total}
				</>
			}
			canPrevious={table.getCanPreviousPage()}
			canNext={table.getCanNextPage()}
			onPrevious={() => table.previousPage()}
			onNext={() => table.nextPage()}
			className="mt-2"
		/>
	)
}
