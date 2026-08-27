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
import { useCallback, useContext, useState } from 'react'
import { useTableSearch } from '~/components/Table/utils'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { PRO_RWA_ASSETS_TABLE_QUERY_KEY } from '~/containers/ProDashboard/tableQueryKeys'
import { fetchRWAActiveTVLs } from '~/containers/RWA/api'
import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import { RWASuspiciousWarning } from '~/containers/RWA/SuspiciousWarning'
import { downloadCSV } from '~/utils/download'
import { formatUsd } from '~/utils/numberFormat'
import { CSVExportButton } from '../../CSVExportButton'
import { LoadingSpinner } from '../../LoadingSpinner'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import {
	buildRWAAllChainsAssetTableRows,
	buildRWAAssetCsv,
	buildRWAChainAssetTableRows,
	type RWAAssetTableRow
} from './rwaAssetsTableData'

const columnHelper = createColumnHelper<RWAAssetTableRow>()
const formatNullableUsd = (value: number | null) =>
	value == null ? '—' : formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })

const columns = [
	columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		cell: (info) => (
			<span className="flex items-center gap-1 text-sm font-medium">
				<span className="truncate">{info.getValue()}</span>
				{info.row.original.suspicious ? <RWASuspiciousWarning reason={info.row.original.suspiciousReason} /> : null}
			</span>
		),
		size: 240,
		maxSize: 240
	}),
	columnHelper.accessor('assetGroup', {
		id: 'assetGroup',
		header: 'Asset Group',
		cell: (info) => info.getValue() || '—',
		size: 140
	}),
	columnHelper.accessor((row) => row.activeMcap ?? undefined, {
		id: 'activeMcap',
		header: 'Active Mcap',
		cell: (info) => formatNullableUsd(info.getValue()),
		meta: { align: 'end' },
		size: 150
	}),
	columnHelper.accessor((row) => row.onChainMcap ?? undefined, {
		id: 'onChainMcap',
		header: 'Onchain Mcap',
		cell: (info) => formatNullableUsd(info.getValue()),
		meta: { align: 'end' },
		size: 150
	}),
	columnHelper.accessor((row) => row.defiActiveTvl ?? undefined, {
		id: 'defiActiveTvl',
		header: 'DeFi Active TVL',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 150
	}),
	columnHelper.accessor('category', {
		id: 'category',
		header: 'Category',
		cell: (info) => info.getValue() || '—',
		size: 140
	}),
	columnHelper.accessor('type', {
		id: 'type',
		header: 'Type',
		cell: (info) => info.getValue() || '—',
		size: 120
	})
]

const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
	'name',
	'assetGroup',
	'activeMcap',
	'onChainMcap',
	'defiActiveTvl',
	'category',
	'type'
]
const DEFAULT_COLUMN_SIZING: ColumnSizingState = {
	name: 240,
	assetGroup: 140,
	activeMcap: 150,
	onChainMcap: 150,
	defiActiveTvl: 150,
	category: 140,
	type: 120
}
const getAssetsCoreRowModel = getCoreRowModel<RWAAssetTableRow>()
const getAssetsSortedRowModel = getSortedRowModel<RWAAssetTableRow>()
const getAssetsFilteredRowModel = getFilteredRowModel<RWAAssetTableRow>()
const getAssetsPaginationRowModel = getPaginationRowModel<RWAAssetTableRow>()
const EMPTY_DATA: RWAAssetTableRow[] = []
const STALE_TIME = 5 * 60 * 1000

function useRWAAssetsTableData(chain?: string) {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const selectRows = useCallback(
		(data: IFetchedRWAProject[]) =>
			chain === undefined ? buildRWAAllChainsAssetTableRows(data) : buildRWAChainAssetTableRows(data, chain),
		[chain]
	)

	const hasValidChain = chain === undefined || chain.length > 0
	const { data, isLoading, error } = useQuery({
		queryKey: PRO_RWA_ASSETS_TABLE_QUERY_KEY,
		enabled: streamDone && hasValidChain,
		queryFn: () => (authToken ? fetchProDashboardProxy('rwaAssetsList', {}, authToken) : fetchRWAActiveTVLs()),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		select: selectRows
	})
	return { data, isLoading: isLoading || (hasValidChain && !streamDone && data === undefined), error }
}

function RWAAssetsTable({ chain }: { chain?: string }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'activeMcap', desc: true }])
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(DEFAULT_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const { data, isLoading, error } = useRWAAssetsTableData(chain)
	const instance = useReactTable({
		defaultColumn: { sortUndefined: 'last' },
		data: data ?? EMPTY_DATA,
		columns,
		state: { sorting, columnOrder, columnSizing, columnFilters, pagination },
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onColumnOrderChange: setColumnOrder,
		onColumnSizingChange: setColumnSizing,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		getCoreRowModel: getAssetsCoreRowModel,
		getSortedRowModel: getAssetsSortedRowModel,
		getFilteredRowModel: getAssetsFilteredRowModel,
		getPaginationRowModel: getAssetsPaginationRowModel,
		autoResetPageIndex: true
	})
	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	const title = chain === undefined ? 'RWA Assets' : `RWA on ${chain}`

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">{title}</h3>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">
						{chain === undefined ? 'Loading RWA assets data...' : `Loading RWA assets for ${chain}...`}
					</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">{title}</h3>
				</div>
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load RWA assets data</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col p-4">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<h3 className="mr-auto text-lg font-semibold text-pro-text-primary">{title}</h3>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<CSVExportButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows.map((row) => row.original)
								downloadCSV(
									chain === undefined ? 'rwa-assets.csv' : `rwa-${chain}.csv`,
									buildRWAAssetCsv(rows, chain === undefined),
									{ addTimestamp: true }
								)
							}}
							smol
						/>
						<input
							type="text"
							placeholder="Search assets..."
							onInput={(event) => setProjectName(event.currentTarget.value)}
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

export function RWAAssetsDataset() {
	return <RWAAssetsTable />
}

export function RWAChainAssetsDataset({ chain }: { chain: string }) {
	return <RWAAssetsTable chain={chain} />
}
