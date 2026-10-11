import { useSelector } from '@tanstack/react-store'
import type { RowData as TableRowData } from '@tanstack/react-table'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { PaginatedTableInstance, PaginationFeatures } from '~/components/Table/features/contracts'
import { TablePager } from '~/components/Table/TablePager'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'

export const MAPLE_USD_CATEGORY_CHART_OPTIONS = createCategoryChartOptions('$')
export const MAPLE_PERCENT_CATEGORY_CHART_OPTIONS = createCategoryChartOptions('%')
export const MAPLE_DOLLAR_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('$')
export const MAPLE_UNITLESS_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('')

export const MAPLE_CSV_ONLY_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const

export function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			<SurfaceBodyLoadingStatus className="min-h-[400px]" />
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
			pageIndex={pageIndex}
			pageCount={table.getPageCount()}
			onPageChange={(index) => table.setPageIndex(index)}
			range={{ from: pageIndex * pageSize + 1, to: Math.min((pageIndex + 1) * pageSize, total), total }}
			className="mt-2"
		/>
	)
}
