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
import { useTableSearch } from '~/components/Table/utils'
import type { IEquitiesFilingApiItem } from '~/containers/Equities/api.types'
import { parseEquityTickerCountryParam } from '~/containers/Equities/tickerCountry'
import { getEquitiesTableQueryKey } from '~/containers/ProDashboard/equitiesTableQueryKeys'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { getProEquitiesFilingsCacheKey } from '~/containers/ProDashboard/tableQueryKeys'
import { Icon } from '~/ui/Icon'
import type { CsvCell } from '~/utils/csvCell'
import { formatDate } from '~/utils/dateFormat'
import { downloadCSV } from '~/utils/download'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardLoading } from '../../ProCardStatus'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'

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
		cell: (info) => <span className="block truncate text-sm">{info.getValue()}</span>,
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
					className="flex flex-1 items-center justify-center gap-4 rounded-md bg-brand-muted p-1.5 hover:bg-pro-btn-secondary-hover"
				>
					<Icon name="arrow-up-right" height={14} width={14} />
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

	const { data, isLoading, error } = useQuery({
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
		data,
		isLoading: isLoading || (tickerCountry !== null && !streamDone && data === undefined),
		error
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

	const { data, isLoading, error } = useEquitiesFilingsData(ticker)
	const filingForms = useMemo(() => {
		if (!data) return []
		const forms = new Set<string>()
		for (const filing of data) {
			if (filing.form) forms.add(filing.form)
		}
		return Array.from(forms).sort()
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

	const [_searchValue, setSearchValue] = useTableSearch({ instance, columnToSearch: 'documentDescription' })

	if (!ticker) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">No ticker specified</div>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading SEC filings…" />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load SEC filings</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<div className="flex flex-wrap items-center justify-end gap-2">
						<label className="flex items-center gap-2 text-sm">
							<span className="text-pro-text-secondary">Form</span>
							<select
								value={selectedForm}
								onChange={(e) => setSelectedForm(e.currentTarget.value)}
								className="rounded-md border border-pro-cards-border bg-pro-glass-bg px-2 py-1 text-sm text-pro-text-primary"
							>
								<option value="All">All</option>
								{filingForms.map((form) => (
									<option key={form} value={form}>
										{form}
									</option>
								))}
							</select>
						</label>
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
						<input
							type="text"
							placeholder="Search filings..."
							onInput={(e) => setSearchValue(e.currentTarget.value)}
							className="rounded-md border border-pro-cards-border bg-pro-glass-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors focus:border-brand focus:outline-hidden"
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
