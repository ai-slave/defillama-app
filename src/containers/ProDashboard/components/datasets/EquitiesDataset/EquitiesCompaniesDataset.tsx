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
import { useTableSearch } from '~/components/Table/utils'
import type { IEquitiesCompanyApiItem } from '~/containers/Equities/api.types'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { PRO_EQUITIES_COMPANIES_QUERY_KEY } from '~/containers/ProDashboard/tableQueryKeys'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import {
	Input,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import { formatRatio, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardLoading } from '../../ProCardStatus'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import {
	formatEquitiesDividendYield,
	formatEquitiesVolume,
	getEquitiesCompanyCsvRow
} from './EquitiesCompaniesDataset.utils'

const tableFeaturesConfig = tableFeatures({
	...orderedFilteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, IEquitiesCompanyApiItem>()

const columns = columnHelper.columns([
	columnHelper.accessor('ticker', {
		id: 'ticker',
		header: 'Ticker',
		enableSorting: false,
		cell: (info) => <span className="block truncate title-md">{info.getValue()}</span>,
		size: 100,
		maxSize: 100
	}),
	columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: (info) => <span className="block truncate body-md">{info.getValue()}</span>,
		size: 200,
		maxSize: 200
	}),
	columnHelper.accessor((row) => row.currentPrice ?? undefined, {
		id: 'currentPrice',
		header: 'Price',
		cell: (info) => formatUsd(info.getValue(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' },
		size: 120
	}),
	columnHelper.accessor((row) => row.marketCap ?? undefined, {
		id: 'marketCap',
		header: 'Market Cap',
		cell: (info) => formatUsd(info.getValue(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor((row) => row.volume ?? undefined, {
		id: 'volume',
		header: 'Volume',
		cell: (info) => formatEquitiesVolume(info.getValue()),
		meta: { align: 'end' },
		size: 130
	}),
	columnHelper.accessor((row) => row.priceChangePercentage1d ?? undefined, {
		id: 'priceChangePercentage1d',
		header: '1d Change',
		cell: (info) => {
			const val = info.getValue()
			return val == null ? '—' : <Change value={val} />
		},
		meta: { align: 'end' },
		size: 110
	}),
	columnHelper.accessor((row) => row.priceChangePercentage7d ?? undefined, {
		id: 'priceChangePercentage7d',
		header: '7d Change',
		cell: (info) => {
			const val = info.getValue()
			return val == null ? '—' : <Change value={val} />
		},
		meta: { align: 'end' },
		size: 110
	}),
	columnHelper.accessor((row) => row.priceChangePercentage1m ?? undefined, {
		id: 'priceChangePercentage1m',
		header: '1m Change',
		cell: (info) => {
			const val = info.getValue()
			return val == null ? '—' : <Change value={val} />
		},
		meta: { align: 'end' },
		size: 110
	}),
	columnHelper.accessor((row) => row.trailingPE ?? undefined, {
		id: 'trailingPE',
		header: 'P/E',
		cell: (info) => formatRatio(info.getValue()) ?? '—',
		meta: { align: 'end' },
		size: 90
	}),
	columnHelper.accessor((row) => row.dividendYield ?? undefined, {
		id: 'dividendYield',
		header: 'Div Yield',
		cell: (info) => formatEquitiesDividendYield(info.getValue()),
		meta: { align: 'end' },
		size: 100
	}),
	columnHelper.accessor((row) => row.revenueTTM ?? undefined, {
		id: 'revenueTTM',
		header: 'Revenue TTM',
		cell: (info) => formatUsd(info.getValue(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor((row) => row.earningsTTM ?? undefined, {
		id: 'earningsTTM',
		header: 'Earnings TTM',
		cell: (info) => formatUsd(info.getValue(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' },
		size: 140
	})
])

const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
	'ticker',
	'name',
	'currentPrice',
	'marketCap',
	'volume',
	'priceChangePercentage1d',
	'priceChangePercentage7d',
	'priceChangePercentage1m',
	'trailingPE',
	'dividendYield',
	'revenueTTM',
	'earningsTTM'
]

const STALE_TIME = 5 * 60 * 1000

function useEquitiesCompaniesTableData() {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)

	const { data, isLoading, error } = useQuery({
		queryKey: PRO_EQUITIES_COMPANIES_QUERY_KEY,
		queryFn: () => {
			if (!authToken) throw new Error('Missing Pro dashboard proxy auth token')
			return fetchProDashboardProxy('equitiesCompanies', {}, authToken)
		},
		enabled: streamDone && Boolean(authToken),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})
	return { data, isLoading: isLoading || (!streamDone && data === undefined), error }
}

const EMPTY_DATA: Array<IEquitiesCompanyApiItem> = []

export function EquitiesCompaniesDataset() {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'marketCap', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})

	const { data, isLoading, error } = useEquitiesCompaniesTableData()
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

	const [_searchValue, setSearchValue] = useTableSearch({ instance, columnToSearch: 'name' })

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading equities data…" />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-secondary">Failed to load equities data</div>
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
									[
										'Ticker',
										'Name',
										'Price',
										'Market Cap',
										'Volume',
										'1d Change',
										'7d Change',
										'1m Change',
										'P/E',
										'Div Yield',
										'Revenue TTM',
										'Earnings TTM'
									]
								]
								for (const row of rows) {
									csv.push(getEquitiesCompanyCsvRow(row.original))
								}

								downloadCSV('equities-companies.csv', csv, { addTimestamp: true })
							}}
							smol
						/>
						<div className={searchFieldInlineWrapperStyles}>
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
							<Input
								type="text"
								aria-label="Search companies"
								placeholder="Search companies…"
								onInput={(e) => setSearchValue(e.currentTarget.value)}
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
