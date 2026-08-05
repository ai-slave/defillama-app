import { useQuery } from '@tanstack/react-query'
import {
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { useContext } from 'react'
import { useTableSearch } from '~/components/Table/utils'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { PRO_RWA_CHAINS_TABLE_QUERY_KEY } from '~/containers/ProDashboard/tableQueryKeys'
import { fetchRWAStats } from '~/containers/RWA/api'
import type { IRWAStatsResponse } from '~/containers/RWA/api.types'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { CSVExportButton } from '../../CSVExportButton'
import { LoadingSpinner } from '../../LoadingSpinner'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'

type RWAChainsTableRow = {
	chain: string
	totalAssetIssuers: number
	totalAssetCount: number
	totalActiveMcap: number
	totalOnChainMcap: number
	totalDefiActiveTvl: number
}

const columnHelper = createColumnHelper<RWAChainsTableRow>()

const columns = [
	columnHelper.accessor('chain', {
		id: 'chain',
		header: 'Chain',
		cell: (info) => <span className="block truncate text-sm font-medium">{info.getValue()}</span>,
		size: 200,
		maxSize: 200
	}),
	columnHelper.accessor('totalAssetIssuers', {
		id: 'totalAssetIssuers',
		header: 'Asset Issuers',
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor('totalAssetCount', {
		id: 'totalAssetCount',
		header: 'Asset Count',
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor('totalActiveMcap', {
		id: 'totalActiveMcap',
		header: 'Active Mcap',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 160
	}),
	columnHelper.accessor('totalOnChainMcap', {
		id: 'totalOnChainMcap',
		header: 'Onchain Mcap',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 160
	}),
	columnHelper.accessor('totalDefiActiveTvl', {
		id: 'totalDefiActiveTvl',
		header: 'DeFi Active TVL',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 160
	})
]

const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
	'chain',
	'totalAssetIssuers',
	'totalAssetCount',
	'totalActiveMcap',
	'totalOnChainMcap',
	'totalDefiActiveTvl'
]
const DEFAULT_COLUMN_SIZING: ColumnSizingState = {
	chain: 200,
	totalAssetIssuers: 140,
	totalAssetCount: 140,
	totalActiveMcap: 160,
	totalOnChainMcap: 160,
	totalDefiActiveTvl: 160
}
const getRWAChainsCoreRowModel = getCoreRowModel<RWAChainsTableRow>()
const getRWAChainsSortedRowModel = getSortedRowModel<RWAChainsTableRow>()
const getRWAChainsFilteredRowModel = getFilteredRowModel<RWAChainsTableRow>()
const getRWAChainsPaginationRowModel = getPaginationRowModel<RWAChainsTableRow>()

const STALE_TIME = 5 * 60 * 1000

function selectRWAChainRows(data: IRWAStatsResponse): RWAChainsTableRow[] {
	if (!data.byChain) return []
	const rows: RWAChainsTableRow[] = []
	for (const chain in data.byChain) {
		const stats = data.byChain[chain]
		if (!stats) continue
		rows.push({
			chain,
			totalAssetIssuers: stats.base.assetIssuers.length,
			totalAssetCount: stats.base.assetCount,
			totalActiveMcap: stats.base.activeMcap,
			totalOnChainMcap: stats.base.onChainMcap,
			totalDefiActiveTvl: stats.base.defiActiveTvl
		})
	}
	return rows
}

function useRWAChainsTableData() {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)

	const { data, isLoading, error } = useQuery({
		queryKey: PRO_RWA_CHAINS_TABLE_QUERY_KEY,
		enabled: streamDone,
		queryFn: async () => {
			if (authToken) {
				return fetchProDashboardProxy('rwaStats', {}, authToken)
			}
			return fetchRWAStats()
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		select: selectRWAChainRows
	})
	return { data, isLoading: isLoading || (!streamDone && data === undefined), error }
}

const EMPTY_DATA: RWAChainsTableRow[] = []

export function RWAChainsDataset() {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'totalActiveMcap', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(DEFAULT_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})

	const { data, isLoading, error } = useRWAChainsTableData()
	const instance = useReactTable({
		data: data ?? EMPTY_DATA,
		columns,
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
		getCoreRowModel: getRWAChainsCoreRowModel,
		getSortedRowModel: getRWAChainsSortedRowModel,
		getFilteredRowModel: getRWAChainsFilteredRowModel,
		getPaginationRowModel: getRWAChainsPaginationRowModel,
		autoResetPageIndex: true
	})

	const [_chainName, setChainName] = useTableSearch({ instance, columnToSearch: 'chain' })

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">RWA By Chain</h3>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">Loading RWA chains data...</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">RWA By Chain</h3>
				</div>
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load RWA chains data</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col p-4">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<h3 className="mr-auto text-lg font-semibold text-pro-text-primary">RWA By Chain</h3>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<CSVExportButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows
								const csv: CsvCell[][] = [
									['Chain', 'Asset Issuers', 'Asset Count', 'Active Mcap', 'Onchain Mcap', 'DeFi Active TVL']
								]
								for (const row of rows) {
									const item = row.original
									csv.push([
										item.chain,
										item.totalAssetIssuers,
										item.totalAssetCount,
										item.totalActiveMcap,
										item.totalOnChainMcap,
										item.totalDefiActiveTvl
									])
								}

								downloadCSV('rwa-by-chain.csv', csv, { addTimestamp: true })
							}}
							smol
						/>
						<input
							type="text"
							placeholder="Search chains..."
							onInput={(e) => setChainName(e.currentTarget.value)}
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
