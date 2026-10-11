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
import { TablePager } from '~/components/Table/TablePager'
import { useTableSearch } from '~/components/Table/utils'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { PRO_RWA_ASSETS_TABLE_QUERY_KEY } from '~/containers/ProDashboard/tableQueryKeys'
import { fetchRWAActiveTVLs } from '~/containers/RWA/api'
import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import { RWASuspiciousWarning } from '~/containers/RWA/SuspiciousWarning'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { SearchField } from '~/ui/SearchField'
import { downloadCSV } from '~/utils/download'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from '../../ProCardStatus'
import { TABLE_PAGE_SIZES, TableBody } from '../../Table/TableBody'
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
	const query = useQuery({
		queryKey: PRO_RWA_ASSETS_TABLE_QUERY_KEY,
		enabled: streamDone && hasValidChain,
		queryFn: () => (authToken ? fetchProDashboardProxy('rwaAssetsList', {}, authToken) : fetchRWAActiveTVLs()),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		select: selectRows
	})
	return { query, isLoading: query.isLoading || (hasValidChain && !streamDone && query.data === undefined) }
}

export function RWAAssetsDataset({ chain }: { chain?: string }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'activeMcap', desc: true }])
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(DEFAULT_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const { query: assetsQuery, isLoading } = useRWAAssetsTableData(chain)
	const { data } = assetsQuery
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
	const [projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	if (queryReadFailed(assetsQuery)) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load RWA assets data" retry={assetsQuery} />
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading
						variant="table"
						label={chain === undefined ? 'Loading RWA assets data' : `Loading RWA assets for ${chain}`}
					/>
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
						<SearchField
							label="Search assets"
							value={projectName}
							onChange={setProjectName}
							placeholder="Search assets…"
							className={searchFieldInlineWrapperStyles}
						/>
					</div>
				</div>
			</div>
			{queryRefreshFailed(assetsQuery) ? <ProCardRefreshFailed retry={assetsQuery} /> : null}
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
