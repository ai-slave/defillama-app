import {
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	createPaginatedRowModel,
	type PaginationState,
	rowPaginationFeature,
	type SortingState,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import * as React from 'react'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import { useTableSearch } from '~/components/Table/utils'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardLoading } from '../../ProCardStatus'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import { stablecoinsDatasetColumns } from './columns'
import { type StablecoinsTableRow, useStablecoinsData } from './useStablecoinsData'

export const tableFeaturesConfig = tableFeatures({
	...orderedFilteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

interface StablecoinsDatasetProps {
	chain: string
}

const EMPTY_DATA: Array<StablecoinsTableRow> = []
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
	const instance = useTable({
		features: tableFeaturesConfig,
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
		autoResetPageIndex: true
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading stablecoin data…" />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-secondary">Failed to load stablecoins data</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<div className="flex flex-wrap items-center justify-end gap-2">
						<CSVExportButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows
								const csv: Array<Array<CsvCell>> = [
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
							className="rounded-md border border-medium bg-page px-3 py-1.5 body-md text-primary transition-colors focus:border-brand focus:outline-hidden"
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
