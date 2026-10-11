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
import { TablePager } from '~/components/Table/TablePager'
import { useTableSearch } from '~/components/Table/utils'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { SearchField } from '~/ui/SearchField'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from '../../ProCardStatus'
import { TABLE_PAGE_SIZES, TableBody } from '../../Table/TableBody'
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

	const { query: stablecoinsQuery, isLoading } = useStablecoinsData(chain)
	const { data } = stablecoinsQuery
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

	const [projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	if (queryReadFailed(stablecoinsQuery)) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load stablecoins data" retry={stablecoinsQuery} />
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading stablecoin data" />
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
						<SearchField
							label="Search stablecoins"
							value={projectName}
							onChange={setProjectName}
							placeholder="Search stablecoins…"
							className={searchFieldInlineWrapperStyles}
						/>
					</div>
				</div>
			</div>
			{queryRefreshFailed(stablecoinsQuery) ? <ProCardRefreshFailed retry={stablecoinsQuery} /> : null}
			<TableBody table={instance} />
			<TablePager
				pageIndex={pagination.pageIndex}
				pageCount={instance.getPageCount()}
				onPageChange={instance.setPageIndex}
				pageSize={
					instance.getRowCount() > 10
						? { value: pagination.pageSize, options: TABLE_PAGE_SIZES, onChange: instance.setPageSize }
						: undefined
				}
				className="mt-2 justify-between"
			/>
		</div>
	)
}
