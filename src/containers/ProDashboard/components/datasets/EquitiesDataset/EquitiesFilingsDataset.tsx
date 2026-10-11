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
import { useContext, useMemo, useState } from 'react'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import { TablePager } from '~/components/Table/TablePager'
import { useTableSearch } from '~/components/Table/utils'
import type { IEquitiesFilingApiItem } from '~/containers/Equities/api.types'
import { parseEquityTickerCountryParam } from '~/containers/Equities/tickerCountry'
import { getEquitiesTableQueryKey } from '~/containers/ProDashboard/equitiesTableQueryKeys'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { getProEquitiesFilingsCacheKey } from '~/containers/ProDashboard/tableQueryKeys'
import { Icon } from '~/ui/Icon'
import { SearchField } from '~/ui/SearchField'
import { Select } from '~/ui/Select'
import type { CsvCell } from '~/utils/csvCell'
import { formatDate } from '~/utils/dateFormat'
import { downloadCSV } from '~/utils/download'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from '../../ProCardStatus'
import { TABLE_PAGE_SIZES, TableBody } from '../../Table/TableBody'

const tableFeaturesConfig = tableFeatures({
	...orderedFilteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, IEquitiesFilingApiItem>()

const columns = columnHelper.columns([
	columnHelper.accessor('filingDate', {
		id: 'filingDate',
		header: 'Filing Date',
		cell: (info) => formatDate(info.getValue()) ?? '-',
		size: 120
	}),
	columnHelper.accessor((row) => row.reportDate ?? undefined, {
		id: 'reportDate',
		header: 'Report Date',
		cell: (info) => formatDate(info.getValue()) ?? '-',
		size: 120
	}),
	columnHelper.accessor('form', {
		id: 'form',
		header: 'Form',
		cell: (info) => <span className="font-medium">{info.getValue()}</span>,
		size: 90
	}),
	columnHelper.accessor('documentDescription', {
		id: 'documentDescription',
		header: 'Description',
		cell: (info) => <span className="block truncate body-md">{info.getValue()}</span>,
		size: 400
	}),
	columnHelper.accessor('primaryDocumentUrl', {
		id: 'primaryDocumentUrl',
		header: 'Source',
		enableSorting: false,
		cell: (info) => (
			<span className="flex w-full max-w-[80px] items-center justify-end">
				<a
					href={info.getValue()}
					target="_blank"
					rel="noopener noreferrer"
					className="flex flex-1 items-center justify-center gap-4 rounded-md bg-brand-tint p-1.5 hover:bg-brand-tint-strong"
				>
					<Icon name="arrow-up-right" className="size-3.5" />
					<span className="sr-only">open in new tab</span>
				</a>
			</span>
		),
		meta: { align: 'end' },
		size: 80
	})
])

const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
	'filingDate',
	'reportDate',
	'form',
	'documentDescription',
	'primaryDocumentUrl'
]

const STALE_TIME = 5 * 60 * 1000

function useEquitiesFilingsData(ticker: string) {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const tickerCountry = parseEquityTickerCountryParam(ticker)

	const query = useQuery({
		queryKey: getEquitiesTableQueryKey('filings', ticker) ?? getProEquitiesFilingsCacheKey(ticker),
		queryFn: async () => {
			if (!tickerCountry) throw new Error('Missing ticker param')
			if (!authToken) throw new Error('Missing Pro dashboard proxy auth token')
			return fetchProDashboardProxy(
				'equitiesFilings',
				{ ticker: tickerCountry.ticker, country: tickerCountry.country },
				authToken
			)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: Boolean(tickerCountry) && Boolean(authToken) && streamDone
	})
	return {
		query,
		isLoading: query.isLoading || (tickerCountry !== null && !streamDone && query.data === undefined)
	}
}

const EMPTY_DATA: Array<IEquitiesFilingApiItem> = []

export function EquitiesFilingsDataset({ ticker }: { ticker: string }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'filingDate', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})
	const [selectedForm, setSelectedForm] = useState<string>('All')

	const { query: filingsQuery, isLoading } = useEquitiesFilingsData(ticker)
	const { data } = filingsQuery
	const formOptions = useMemo(() => {
		const forms = new Set<string>()
		for (const filing of data ?? []) {
			if (filing.form) forms.add(filing.form)
		}
		return ['All', ...Array.from(forms).sort()]
	}, [data])

	const filteredData = useMemo(() => {
		if (!data) return EMPTY_DATA
		if (selectedForm === 'All') return data
		const matchingFilings: Array<IEquitiesFilingApiItem> = []
		for (const filing of data) {
			if (filing.form === selectedForm) matchingFilings.push(filing)
		}
		return matchingFilings
	}, [data, selectedForm])

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data: filteredData,
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

	const [searchValue, setSearchValue] = useTableSearch({ instance, columnToSearch: 'documentDescription' })

	if (!ticker) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardEmpty message="No ticker specified." />
				</div>
			</div>
		)
	}

	if (queryReadFailed(filingsQuery)) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load SEC filings" retry={filingsQuery} />
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading SEC filings" />
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Select
							heading="Form"
							variant="filter"
							size="md"
							allValues={formOptions}
							selectedValues={selectedForm}
							setSelectedValues={setSelectedForm}
							label={
								<>
									<span className="text-tertiary">Form:</span>
									<span className="truncate">{selectedForm}</span>
								</>
							}
							labelType="none"
							triggerProps={{ 'aria-label': 'Filter filings by form' }}
						/>
						<CSVExportButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows
								const csv: Array<Array<CsvCell>> = [['Filing Date', 'Report Date', 'Form', 'Description', 'URL']]
								for (const row of rows) {
									const item = row.original
									csv.push([
										item.filingDate,
										item.reportDate,
										item.form,
										item.documentDescription,
										item.primaryDocumentUrl
									])
								}

								downloadCSV(`equities-${ticker}-filings.csv`, csv, { addTimestamp: true })
							}}
							smol
						/>
						<SearchField
							label="Search filings"
							value={searchValue}
							onChange={setSearchValue}
							placeholder="Search filings…"
							width="inline"
						/>
					</div>
				</div>
			</div>
			{queryRefreshFailed(filingsQuery) ? <ProCardRefreshFailed retry={filingsQuery} /> : null}
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
