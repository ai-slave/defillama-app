import { useSelector } from '@tanstack/react-store'
import { type RowData as TableRowData, FlexRender, Subscribe, type RowData, type Table } from '@tanstack/react-table'
import {
	column_getCanSort,
	column_getIsSorted,
	column_getSize,
	column_toggleSorting,
	row_getVisibleCells,
	table_getTotalSize,
	table_getVisibleLeafColumns
} from '@tanstack/react-table/static-functions'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type {
	PaginatedTableInstance,
	PaginationFeatures,
	SortingFeatures,
	VisibilityFeatures
} from '~/components/Table/features/contracts'
import { SortIcon } from '~/components/Table/SortIcon'
import { TablePager } from '~/containers/Investors/TablePager'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'

export const AAVE_AREA_EXPORT = { csv: true, png: true, filename: 'chart' } as const
export const AAVE_BAR_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const

export const AAVE_CATEGORY_DOLLAR_CHART_OPTIONS = createCategoryChartOptions('$')

export const AAVE_CATEGORY_PERCENT_CHART_OPTIONS = createCategoryChartOptions('%')

export const AAVE_PERCENT_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('%')

export function InvestorsTable<F extends SortingFeatures & VisibilityFeatures, T extends RowData>({
	instance,
	overrideRows
}: {
	instance: Table<F, T>
	overrideRows?: Array<import('@tanstack/react-table').Row<F, T>>
}) {
	return (
		<Subscribe source={instance.store}>
			{() => {
				const columns = table_getVisibleLeafColumns(instance)
				const gridTemplateColumns = columns.map((col) => `${column_getSize(col) ?? 100}fr`).join(' ')
				const rows = overrideRows ?? instance.getRowModel().rows

				return (
					<div className="w-full overflow-auto">
						<div style={{ display: 'grid', gridTemplateColumns, minWidth: `${table_getTotalSize(instance)}px` }}>
							{instance.getHeaderGroups().map((headerGroup) =>
								headerGroup.headers.map((header) => {
									const align = header.column.columnDef.meta?.align ?? 'start'
									const canSort = column_getCanSort(header.column)
									// A sortable header is a control: as a span with an onClick, sorting was mouse-only.
									const HEADER =
										'relative inline-flex flex-nowrap items-center gap-1 title-sm tracking-wider text-tertiary uppercase'
									return (
										<div
											key={header.id}
											className="truncate border-b border-subtle px-3 py-2.5"
											style={{ textAlign: align }}
										>
											{canSort ? (
												<button
													type="button"
													className={`${HEADER} cursor-pointer`}
													onClick={() => column_toggleSorting(header.column)}
												>
													<FlexRender header={header} />
													<SortIcon dir={column_getIsSorted(header.column)} />
												</button>
											) : (
												<span className={HEADER}>
													<FlexRender header={header} />
												</span>
											)}
										</div>
									)
								})
							)}
							{rows.map((row, rowIdx) =>
								row_getVisibleCells(row).map((cell) => {
									const align = cell.column.columnDef.meta?.align ?? 'start'
									return (
										<div
											key={cell.id}
											className={`truncate border-b border-subtle px-3 py-2.5 body-md text-primary transition-colors ${
												rowIdx % 2 === 1 ? 'bg-surface' : ''
											} ${align === 'end' ? 'tabular-nums' : ''}`}
											style={{ textAlign: align }}
										>
											<FlexRender cell={cell} />
										</div>
									)
								})
							)}
						</div>
					</div>
				)
			}}
		</Subscribe>
	)
}

export function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-5">
			<h3 className="mb-4 title-sm tracking-wider text-tertiary uppercase">{title}</h3>
			<SurfaceBodyLoadingStatus className="min-h-[400px]" />
		</div>
	)
}

/** Section wrapper with uppercase label and optional right-side actions */
export function SectionHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between">
			<h3 className="title-sm tracking-wider text-tertiary uppercase">{title}</h3>
			{actions}
		</div>
	)
}

export function Pagination<F extends PaginationFeatures, T extends TableRowData>({
	table
}: {
	table: PaginatedTableInstance<F, T>
}) {
	const { pageIndex, pageSize } = useSelector(table.atoms.pagination)
	const total = table.getPrePaginatedRowModel().rows.length

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
			className="mt-3 border-t border-subtle pt-3"
		/>
	)
}
