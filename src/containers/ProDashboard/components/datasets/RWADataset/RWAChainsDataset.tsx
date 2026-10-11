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
import * as React from 'react'
import { useContext } from 'react'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import { TablePager } from '~/components/Table/TablePager'
import { useTableSearch } from '~/components/Table/utils'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { PRO_RWA_CHAINS_TABLE_QUERY_KEY } from '~/containers/ProDashboard/tableQueryKeys'
import { fetchRWAStats } from '~/containers/RWA/api'
import type { IRWAStatsResponse } from '~/containers/RWA/api.types'
import { Icon } from '~/ui/Icon'
import {
	Input,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from '../../ProCardStatus'
import { TABLE_PAGE_SIZES, TableBody } from '../../Table/TableBody'

const tableFeaturesConfig = tableFeatures({
	...orderedFilteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

type RWAChainsTableRow = {
	chain: string
	totalAssetIssuers: number
	totalAssetCount: number
	totalActiveMcap: number
	totalOnChainMcap: number
	totalDefiActiveTvl: number
}

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, RWAChainsTableRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('chain', {
		id: 'chain',
		header: 'Chain',
		cell: (info) => <span className="block truncate label-md">{info.getValue()}</span>,
		size: 200,
		maxSize: 200
	}),
	columnHelper.accessor((row) => row.totalAssetIssuers ?? undefined, {
		id: 'totalAssetIssuers',
		header: 'Asset Issuers',
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor((row) => row.totalAssetCount ?? undefined, {
		id: 'totalAssetCount',
		header: 'Asset Count',
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor((row) => row.totalActiveMcap ?? undefined, {
		id: 'totalActiveMcap',
		header: 'Active AUM',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 160
	}),
	columnHelper.accessor((row) => row.totalOnChainMcap ?? undefined, {
		id: 'totalOnChainMcap',
		header: 'Onchain AUM',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 160
	}),
	columnHelper.accessor((row) => row.totalDefiActiveTvl ?? undefined, {
		id: 'totalDefiActiveTvl',
		header: 'DeFi Active TVL',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' },
		size: 160
	})
])

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

const STALE_TIME = 5 * 60 * 1000

function selectRWAChainRows(data: IRWAStatsResponse): Array<RWAChainsTableRow> {
	if (!data.byChain) return []
	const rows: Array<RWAChainsTableRow> = []
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

	const query = useQuery({
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
	return { query, isLoading: query.isLoading || (!streamDone && query.data === undefined) }
}

const EMPTY_DATA: Array<RWAChainsTableRow> = []

export function RWAChainsDataset() {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'totalActiveMcap', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(DEFAULT_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})

	const { query: chainsQuery, isLoading } = useRWAChainsTableData()
	const { data } = chainsQuery
	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
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
		autoResetPageIndex: true
	})

	const [_chainName, setChainName] = useTableSearch({ instance, columnToSearch: 'chain' })

	if (queryReadFailed(chainsQuery)) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load RWA chains data" retry={chainsQuery} />
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading RWA chains data" />
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
									['Chain', 'Asset Issuers', 'Asset Count', 'Active AUM', 'Onchain AUM', 'DeFi Active TVL']
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
						<div className={searchFieldInlineWrapperStyles}>
							<Icon name="search" className={searchFieldIconStyles} />
							<Input
								type="text"
								aria-label="Search chains"
								placeholder="Search chains…"
								onInput={(e) => setChainName(e.currentTarget.value)}
								className={searchFieldInputPlacementStyles}
							/>
						</div>
					</div>
				</div>
			</div>
			{queryRefreshFailed(chainsQuery) ? <ProCardRefreshFailed retry={chainsQuery} /> : null}
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
