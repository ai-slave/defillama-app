import {
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { useTableSearch } from '~/components/Table/utils'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import { CSVExportButton } from '../../CSVExportButton'
import { LoadingSpinner } from '../../LoadingSpinner'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import { stablecoinsDatasetColumns } from './columns'
import { type StablecoinsTableRow, useStablecoinsData } from './useStablecoinsData'

interface StablecoinsDatasetProps {
	chain: string
}

const EMPTY_DATA: StablecoinsTableRow[] = []
const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
	'name',
	'price',
	'mcap',
	'change_1d',
	'change_7d',
	'change_1m',
	'chains'
]
const DEFAULT_COLUMN_SIZING: ColumnSizingState = {
	name: 280,
	mcap: 145,
	change_1d: 100,
	change_7d: 100,
	change_1m: 100,
	price: 100,
	chains: 200
}
const getStablecoinsCoreRowModel = getCoreRowModel<StablecoinsTableRow>()
const getStablecoinsSortedRowModel = getSortedRowModel<StablecoinsTableRow>()
const getStablecoinsFilteredRowModel = getFilteredRowModel<StablecoinsTableRow>()
const getStablecoinsPaginationRowModel = getPaginationRowModel<StablecoinsTableRow>()

export function StablecoinsDataset({ chain }: StablecoinsDatasetProps) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'mcap', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(DEFAULT_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})

	const { data, isLoading, error } = useStablecoinsData(chain)
	const instance = useReactTable({
		defaultColumn: { sortUndefined: 'last' },
		data: data ?? EMPTY_DATA,
		columns: stablecoinsDatasetColumns,
		state: {
			sorting,
			columnOrder,
			columnSizing,
			columnFilters,
			pagination
		},
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onColumnOrderChange: setColumnOrder,
		onColumnSizingChange: setColumnSizing,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		getCoreRowModel: getStablecoinsCoreRowModel,
		getSortedRowModel: getStablecoinsSortedRowModel,
		getFilteredRowModel: getStablecoinsFilteredRowModel,
		getPaginationRowModel: getStablecoinsPaginationRowModel,
		autoResetPageIndex: true
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-lg font-semibold text-pro-text-primary">{chain} Stablecoins</h3>
					</div>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">Loading stablecoin data...</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-lg font-semibold text-pro-text-primary">{chain} Stablecoins</h3>
					</div>
				</div>
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load stablecoins data</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col p-4">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<h3 className="mr-auto text-lg font-semibold text-pro-text-primary">{chain} Stablecoins</h3>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<CSVExportButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows
								const csv: CsvCell[][] = [
									['Stablecoin', 'Market Cap', '24h Change', '7d Change', '1m Change', 'Price', 'Chains']
								]
								for (const row of rows) {
									const item = row.original
									csv.push([
										item.name,
										item.mcap,
										item.change_1d,
										item.change_7d,
										item.change_1m,
										item.price,
										item.chains?.join(';')
									])
								}

								downloadCSV(`stablecoins-${chain}.csv`, csv, { addTimestamp: true })
							}}
							smol
						/>
						<input
							type="text"
							placeholder="Search stablecoins..."
							onInput={(e) => setProjectName(e.currentTarget.value)}
							className="rounded-md border pro-border bg-pro-glass-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors focus:border-brand focus:outline-hidden"
						/>
					</div>
				</div>
			</div>
			<TableBody table={instance} />
			<TablePagination
				pageSize={pagination.pageSize}
				pageIndex={pagination.pageIndex}
				pageCount={instance.getPageCount()}
				canPreviousPage={instance.getCanPreviousPage()}
				canNextPage={instance.getCanNextPage()}
				previousPage={instance.previousPage}
				nextPage={instance.nextPage}
				setPageSize={instance.setPageSize}
				showPageSizes={instance.getRowCount() > 10}
			/>
		</div>
	)
}
