import {
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { selectTriggerStyles } from '~/components/Select/types'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { prepareTableCsv, useTableSearch } from '~/components/Table/utils'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInputStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { formatDate } from '~/utils/dateFormat'
import type { IEquitiesFilingApiItem } from './api.types'

const columnHelper = createColumnHelper<IEquitiesFilingApiItem>()
const DEFAULT_SORTING_STATE: SortingState = [{ id: 'filingDate', desc: true }]
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 10

const columns = [
	columnHelper.accessor('filingDate', {
		header: 'Filing Date',
		cell: ({ getValue }) => formatDate(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[120px]',
			align: 'start'
		}
	}),
	columnHelper.accessor((row) => row.reportDate ?? undefined, {
		id: 'reportDate',
		header: 'Report Date',
		cell: ({ getValue }) => formatDate(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[120px]',
			align: 'start'
		}
	}),
	columnHelper.accessor('form', {
		header: 'Form',
		meta: {
			headerClassName: 'w-[84px]',
			align: 'start'
		}
	}),
	columnHelper.accessor('documentDescription', {
		header: 'Description',
		filterFn: (row, _columnId, filterValue) => {
			const query = String(filterValue).trim().toLowerCase()
			if (!query) return true
			return (
				row.original.documentDescription.toLowerCase().includes(query) ||
				row.original.form.toLowerCase().includes(query)
			)
		},
		meta: {
			headerClassName: 'w-[min(520px,40vw)]',
			align: 'start'
		}
	}),
	columnHelper.accessor('primaryDocumentUrl', {
		header: 'Source URL',
		enableSorting: false,
		cell: ({ getValue }) => (
			<span className="flex w-full max-w-[80px] items-center justify-end">
				<a
					href={getValue()}
					target="_blank"
					rel="noopener noreferrer"
					className="flex flex-1 items-center justify-center gap-4 rounded-md bg-brand-muted p-1.5 hover:bg-(--interim-brand-tint-hover)"
				>
					<Icon name="arrow-up-right" height={14} width={14} />
					<span className="sr-only">open in new tab</span>
				</a>
			</span>
		),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	})
]

export function EquitiesFilingsTable({
	filings,
	filingForms
}: {
	filings: IEquitiesFilingApiItem[]
	filingForms: string[]
}) {
	const [selectedForm, setSelectedForm] = useState<string>('All')

	const filteredFilings = useMemo(() => {
		if (selectedForm === 'All') return filings
		const matchingFilings: IEquitiesFilingApiItem[] = []
		for (const filing of filings) {
			if (filing.form === selectedForm) matchingFilings.push(filing)
		}
		return matchingFilings
	}, [filings, selectedForm])
	const table = useReactTable({
		defaultColumn: { sortUndefined: 'last' },
		data: filteredFilings,
		columns,
		initialState: {
			pagination: {
				pageIndex: 0,
				pageSize: DEFAULT_PAGE_SIZE
			},
			sorting: DEFAULT_SORTING_STATE
		},
		enableSortingRemoval: false,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})
	const [_searchValue, setSearchValue] = useTableSearch({ instance: table, columnToSearch: 'documentDescription' })

	return (
		<Panel padding="none">
			<TableToolbar className="justify-end">
				<label className={searchFieldWrapperStyles}>
					<span className="sr-only">Search filings</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						onInput={(e) => setSearchValue(e.currentTarget.value)}
						placeholder="Search filings"
						className={searchFieldInputStyles}
					/>
				</label>
				<TableToolbarControlGroup>
					<label className="flex items-center gap-2 label-sm">
						<span className="text-secondary">Form</span>
						<select
							value={selectedForm}
							onChange={(e) => setSelectedForm(e.currentTarget.value)}
							className={selectTriggerStyles('filter', 'md')}
						>
							<option value="All">All</option>
							{filingForms.map((form) => (
								<option key={form} value={form}>
									{form}
								</option>
							))}
						</select>
					</label>
					<CSVDownloadButton
						prepareCsv={() => prepareTableCsv({ instance: table, filename: 'equities-filings' })}
						smol
						size="md"
					/>
				</TableToolbarControlGroup>
			</TableToolbar>
			<PaginatedTable table={table} pageSizeOptions={PAGE_SIZE_OPTIONS} shell="none" />
		</Panel>
	)
}
