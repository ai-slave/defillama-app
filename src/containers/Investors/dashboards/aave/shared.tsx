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
import { Children } from 'react'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type {
	PaginatedTableInstance,
	PaginationFeatures,
	SortingFeatures,
	VisibilityFeatures
} from '~/components/Table/features/contracts'
import { SortIcon } from '~/components/Table/SortIcon'

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
										'relative inline-flex flex-nowrap items-center gap-1 text-[11px] font-semibold tracking-wider text-pro-text-tertiary uppercase'
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
											className={`truncate border-b border-subtle px-3 py-2.5 text-[13px] text-pro-text-primary transition-colors ${
												rowIdx % 2 === 1 ? 'bg-pro-cards-bg' : ''
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

export function PageLoader() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
		</div>
	)
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
			<h3 className="mb-4 text-[11px] font-semibold tracking-wider text-pro-text-tertiary uppercase">{title}</h3>
			{children}
		</div>
	)
}

export function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
			<h3 className="mb-4 text-[11px] font-semibold tracking-wider text-pro-text-tertiary uppercase">{title}</h3>
			<div className="flex h-[400px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
	)
}

export function KpiCard({ label, value }: { label: string; value: string | number | null }) {
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
			<span className="text-[11px] font-medium tracking-wide text-pro-text-tertiary">{label}</span>
			<span className="mono-lg text-pro-text-primary tabular-nums">{value ?? '—'}</span>
		</div>
	)
}

export function KpiSkeleton({ label }: { label: string }) {
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
			<span className="text-[11px] font-medium tracking-wide text-pro-text-tertiary">{label}</span>
			<div className="h-7 w-20 animate-pulse rounded-sm bg-tertiary opacity-20" />
		</div>
	)
}

/** Full-width metric strip — items stretch evenly, separated by vertical dividers */
export function MetricStrip({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex gap-0 overflow-x-auto rounded-lg border border-pro-cards-border bg-pro-cards-bg">
			{Array.isArray(children) ? (
				Children.map(children, (child, i) => (
					<div className={`flex-1 px-5 py-3 ${i > 0 ? 'border-l border-subtle' : ''}`} style={{ minWidth: '120px' }}>
						{child}
					</div>
				))
			) : (
				<div className="flex-1 px-5 py-3">{children}</div>
			)}
		</div>
	)
}

/** Section wrapper with uppercase label and optional right-side actions */
export function SectionHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between">
			<h3 className="text-[11px] font-semibold tracking-wider text-pro-text-tertiary uppercase">{title}</h3>
			{actions}
		</div>
	)
}

/** Time window toggle buttons — matches select height (py-1.5 + text-sm line-height) */
export function WindowToggle({
	options,
	value,
	onChange
}: {
	options: Array<{ value: string; label: string }>
	value: string
	onChange: (v: string) => void
}) {
	return (
		<div className="flex">
			{options.map((w, i) => (
				<button
					type="button"
					key={w.value}
					onClick={() => onChange(w.value)}
					className={`px-3 py-1.5 text-sm leading-tight font-medium transition-colors ${
						i === 0 ? 'rounded-l-md' : ''
					}${i === options.length - 1 ? 'rounded-r-md' : ''} ${
						value === w.value
							? 'bg-sl-accent text-on-brand'
							: 'bg-pro-cards-bg text-pro-text-tertiary hover:text-pro-text-primary'
					} ${value !== w.value ? 'border border-pro-cards-border' : ''}`}
					style={i > 0 && value !== w.value ? { marginLeft: '-1px' } : undefined}
				>
					{w.label}
				</button>
			))}
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
		<div className="mt-3 flex items-center justify-between border-t border-subtle pt-3 text-[11px] text-pro-text-tertiary">
			<span className="tabular-nums">
				{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} of {total}
			</span>
			<div className="flex gap-1">
				<button
					type="button"
					onClick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
					className="rounded-sm px-2 py-1 transition-colors hover:bg-sl-hover-bg disabled:opacity-30"
				>
					Prev
				</button>
				<button
					type="button"
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
					className="rounded-sm px-2 py-1 transition-colors hover:bg-sl-hover-bg disabled:opacity-30"
				>
					Next
				</button>
			</div>
		</div>
	)
}
