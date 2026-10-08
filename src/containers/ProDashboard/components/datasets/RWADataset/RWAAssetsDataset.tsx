import { useQuery } from '@tanstack/react-query'
import {
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	createColumnHelper,
	createPaginatedRowModel,
	type PaginationState,
	rowPaginationFeature,
	type SortingState,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import { useCallback, useContext, useState } from 'react'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import { useTableSearch } from '~/components/Table/utils'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { PRO_RWA_ASSETS_TABLE_QUERY_KEY } from '~/containers/ProDashboard/tableQueryKeys'
import { fetchRWAActiveTVLs } from '~/containers/RWA/api'
import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import { RWASuspiciousWarning } from '~/containers/RWA/SuspiciousWarning'
import { Icon } from '~/ui/Icon'
import {
	Input,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import { downloadCSV } from '~/utils/download'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardLoading } from '../../ProCardStatus'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import {
	buildRWAAllChainsAssetTableRows,
	buildRWAAssetCsv,
	buildRWAChainAssetTableRows,
	type RWAAssetTableRow
} from './rwaAssetsTableData'

const tableFeaturesConfig = tableFeatures({
	...orderedFilteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, RWAAssetTableRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		cell: (info) => (
			<span className="flex items-center gap-1 label-md">
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
		header: 'Active AUM',
		cell: (info) => formatUsd(info.getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—',
		meta: { align: 'end' },
		size: 150
	}),
	columnHelper.accessor((row) => row.onChainMcap ?? undefined, {
		id: 'onChainMcap',
		header: 'Onchain AUM',
		cell: (info) => formatUsd(info.getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—',
		meta: { align: 'end' },
		size: 150
	}),
	columnHelper.accessor((row) => row.defiActiveTvl ?? undefined, {
		id: 'defiActiveTvl',
		header: 'DeFi Active TVL',
		cell: (info) => formatUsd(info.getValue(), USD_LOWERCASE_MILLIONS_OPTIONS),
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
])

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
const EMPTY_DATA: Array<RWAAssetTableRow> = []
const STALE_TIME = 5 * 60 * 1000

function useRWAAssetsTableData(chain?: string) {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const selectRows = useCallback(
		(data: Array<IFetchedRWAProject>) =>
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

export function RWAAssetsDataset({ chain }: { chain?: string }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'activeMcap', desc: true }])
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(DEFAULT_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const { data, isLoading, error } = useRWAAssetsTableData(chain)
	const instance = useTable({
		features: tableFeaturesConfig,
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
		autoResetPageIndex: true
	})
	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading
						variant="table"
						label={chain === undefined ? 'Loading RWA assets data…' : `Loading RWA assets for ${chain}…`}
					/>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-secondary">Failed to load RWA assets data</div>
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
								const rows = instance.getFilteredRowModel().rows.map((row) => row.original)
								downloadCSV(
									chain === undefined ? 'rwa-assets.csv' : `rwa-${chain}.csv`,
									buildRWAAssetCsv(rows, chain === undefined),
									{ addTimestamp: true }
								)
							}}
							smol
						/>
						<div className={searchFieldInlineWrapperStyles}>
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
							<Input
								type="text"
								aria-label="Search assets"
								placeholder="Search assets…"
								onInput={(event) => setProjectName(event.currentTarget.value)}
								className={searchFieldInputPlacementStyles}
							/>
						</div>
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
