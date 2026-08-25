import {
	createColumnHelper,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useDeferredValue, useMemo, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { PaginatedTable, usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInputStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { formatDateTime } from '~/utils/dateFormat'
import { preIpoIconUrl } from '~/utils/icons'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { PreIpoCompanyListItem } from './api.types'
import { preIpoDefinitions } from './definitions'
import { filterPreIpoCompanies, getPreIpoSectors } from './overviewData'
import { getSelectedPreIpoSectors, PRE_IPO_EXCLUDE_SECTOR_QUERY_KEY, PRE_IPO_SECTOR_QUERY_KEY } from './queryState'
import type { PreIpoOverviewPageProps } from './types'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 50 }
const DEFAULT_SORTING: SortingState = [{ id: 'latestEstimatedValuation', desc: true }]
const DAYS_PER_YEAR = 365
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12

function formatMoney(value: number | null | undefined): string {
	return (
		formatUsd(value, {
			compact: true,
			minimumCompactValue: 1_000_000,
			maximumFractionDigits: 2
		}) ?? '-'
	)
}

function formatPercentage(value: number | null | undefined): string {
	return (
		formatPercent(value, {
			input: 'percent',
			signDisplay: 'exceptZero',
			maximumFractionDigits: 2
		}) ?? '-'
	)
}

function formatAgeInLargestUnit(value: number | null | undefined): string {
	if (value == null) return '-'
	if (value < DAYS_PER_MONTH) return `${formatNumber(value)}D`
	if (value < DAYS_PER_YEAR) return `${formatNumber(Math.floor(value / DAYS_PER_MONTH))}MO`
	return `${formatNumber(value / DAYS_PER_YEAR, { maximumFractionDigits: 1 })}Y`
}

function CompanyCell({ row }: { row: { id: string; original: PreIpoCompanyListItem } }) {
	const rowIndex = usePaginatedTableDisplayRowNumber(row.id)
	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="inline-block min-w-5 shrink-0 text-left text-secondary" aria-hidden="true">
				{rowIndex}
			</span>
			<img
				src={preIpoIconUrl(row.original.id, 32)}
				alt={`${row.original.name} logo`}
				width={24}
				height={24}
				loading="lazy"
				className="size-6 shrink-0 rounded-full object-contain"
			/>
			<span className="flex min-w-0 flex-col">
				<BasicLink href={`/pre-ipo/${row.original.id}`} className="truncate font-medium text-link">
					{row.original.name}
				</BasicLink>
			</span>
		</span>
	)
}

const columnHelper = createColumnHelper<PreIpoCompanyListItem>()
const columns = [
	columnHelper.accessor('name', {
		header: 'Company',
		enableSorting: false,
		cell: ({ row }) => <CompanyCell row={row} />,
		meta: { headerClassName: 'w-[220px] min-w-[220px]', align: 'start' }
	}),
	columnHelper.accessor('id', {
		id: 'companyId',
		header: 'Company ID',
		enableSorting: false,
		meta: { hidden: true, csvOnly: true }
	}),
	columnHelper.accessor('sector', {
		header: 'Sector',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[180px] min-w-[180px]',
			cellClassName: 'truncate',
			align: 'start'
		}
	}),
	columnHelper.accessor((row) => row.latestEstimatedValuation ?? undefined, {
		id: 'latestEstimatedValuation',
		header: preIpoDefinitions.company.estimatedValuation.label,
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: {
			headerClassName: 'w-[168px] min-w-[168px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.estimatedValuation.description
		}
	}),
	columnHelper.accessor((row) => row.valuationChange1YPercentage ?? undefined, {
		id: 'valuationChange1YPercentage',
		header: preIpoDefinitions.company.valuationChange1Y.label,
		cell: ({ getValue }) => {
			const value = getValue()
			return (
				<span className={value == null || value === 0 ? undefined : value > 0 ? 'text-data-up' : 'text-data-down'}>
					{formatPercentage(value)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[112px] min-w-[112px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.valuationChange1Y.description
		}
	}),
	columnHelper.accessor((row) => row.latestRaise ?? undefined, {
		id: 'latestRaise',
		header: preIpoDefinitions.company.latestRaise.label,
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: {
			headerClassName: 'w-[132px] min-w-[132px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.latestRaise.description
		}
	}),
	columnHelper.accessor((row) => row.latestFundingValuation ?? undefined, {
		id: 'latestFundingValuation',
		header: preIpoDefinitions.company.latestFundingValuation.label,
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: {
			headerClassName: 'w-[200px] min-w-[200px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.latestFundingValuation.description
		}
	}),
	columnHelper.accessor((row) => row.totalRaised ?? undefined, {
		id: 'totalRaised',
		header: preIpoDefinitions.company.totalRaised.label,
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: {
			headerClassName: 'w-[132px] min-w-[132px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.totalRaised.description
		}
	}),
	columnHelper.accessor((row) => row.premiumVsLatestFundingPercentage ?? undefined, {
		id: 'premiumVsLatestFundingPercentage',
		header: preIpoDefinitions.company.premiumVsFunding.label,
		cell: ({ getValue }) => {
			const value = getValue()
			return (
				<span className={value == null || value === 0 ? undefined : value > 0 ? 'text-data-up' : 'text-data-down'}>
					{formatPercentage(value)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[172px] min-w-[172px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.premiumVsFunding.description
		}
	}),
	columnHelper.accessor((row) => row.daysSinceLatestFunding ?? undefined, {
		id: 'daysSinceLatestFunding',
		header: preIpoDefinitions.company.fundingAge.label,
		cell: ({ getValue }) => formatAgeInLargestUnit(getValue()),
		meta: {
			headerClassName: 'w-[132px] min-w-[132px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.fundingAge.description
		}
	})
]

export function PreIpoOverview({ companies, updatedAt }: PreIpoOverviewPageProps) {
	const router = useRouter()
	const [searchValue, setSearchValue] = useState('')
	const deferredSearchValue = useDeferredValue(searchValue)
	const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
	const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION)
	const sectors = useMemo(() => getPreIpoSectors(companies), [companies])
	const selectedSectors = useMemo(() => getSelectedPreIpoSectors(router.query, sectors), [router.query, sectors])
	const sectorFilter = useMemo(
		() => (selectedSectors.length === sectors.length ? null : new Set(selectedSectors)),
		[selectedSectors, sectors.length]
	)
	const filteredCompanies = useMemo(
		() => filterPreIpoCompanies(companies, deferredSearchValue, sectorFilter),
		[companies, deferredSearchValue, sectorFilter]
	)

	const table = useReactTable({
		data: filteredCompanies,
		columns,
		state: { sorting, pagination },
		initialState: { columnVisibility: { companyId: false } },
		defaultColumn: { sortUndefined: 'last' },
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onPaginationChange: (updater) => startTransition(() => setPagination(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	const resetPage = () => setPagination((state) => ({ ...state, pageIndex: 0 }))

	return (
		<div className="flex flex-col gap-2">
			<Card as="header" padding="sm" className="flex flex-col gap-2">
				<h1 className="heading-sm">Pre-IPO Companies</h1>
				<p className="body-sm text-secondary">
					Track private-company valuations, funding rounds, and markets where pre-IPO exposure is tradable.
				</p>
			</Card>
			<Panel padding="none">
				<TableToolbar className="justify-between">
					<label className={searchFieldWrapperStyles}>
						<span className="sr-only">Search companies, IDs, or sectors</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							onInput={(event) => {
								setSearchValue(event.currentTarget.value)
								resetPage()
							}}
							placeholder="Search companies..."
							className={searchFieldInputStyles}
						/>
					</label>
					<TableToolbarControlGroup className="ml-auto justify-end">
						<SelectWithCombobox
							allValues={sectors}
							selectedValues={selectedSectors}
							includeQueryKey={PRE_IPO_SECTOR_QUERY_KEY}
							excludeQueryKey={PRE_IPO_EXCLUDE_SECTOR_QUERY_KEY}
							onValuesChange={resetPage}
							label="Sector"
							labelType="smol"
							variant="filter-responsive"
							size="md"
							nestedMenu={false}
						/>
						<CSVDownloadButton
							prepareCsv={() =>
								prepareTableCsv({
									instance: table,
									filename: 'pre-ipo-companies',
									includeHiddenColumns: true
								})
							}
							smol
							size="md"
						/>
					</TableToolbarControlGroup>
				</TableToolbar>
				<PaginatedTable table={table} pageSizeOptions={PAGE_SIZE_OPTIONS} tableClassName="min-w-max!" shell="none" />
			</Panel>
			<p className="px-1 body-sm text-tertiary" suppressHydrationWarning>
				Updated{' '}
				{formatDateTime(updatedAt, {
					timeZone: 'local',
					timeZoneName: 'short'
				}) ?? '-'}
				.
			</p>
		</div>
	)
}
