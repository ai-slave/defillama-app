import { createColumnHelper, type PaginationState, type SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useDeferredValue, useMemo, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { BasicLink } from '~/components/Link'
import { readSelectionFromQuery } from '~/components/Select/query'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { paginatedTableFeatures, usePaginatedTable } from '~/components/Table/features/pagination'
import { PaginatedTable, usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInputStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { preIpoIconUrl } from '~/utils/icons'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import type { PreIpoCompanyListItem } from './api.types'
import { PRE_IPO_USD_OPTIONS } from './constants'
import { preIpoDefinitions } from './definitions'
import { filterPreIpoCompanies, getPreIpoSectors } from './overviewData'
import type { PreIpoOverviewPageProps } from './types'

const tableFeaturesConfig = paginatedTableFeatures

const PERCENT_OPTIONS = {
	input: 'percent',
	signDisplay: 'exceptZero',
	maximumFractionDigits: 2
} as const

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 50 }
const DEFAULT_SORTING: SortingState = [{ id: 'latestEstimatedValuation', desc: true }]

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

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, PreIpoCompanyListItem>()
const columns = columnHelper.columns([
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
		cell: ({ getValue }) => formatUsd(getValue(), PRE_IPO_USD_OPTIONS) ?? '-',
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
					{formatPercent(value, PERCENT_OPTIONS) ?? '-'}
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
		cell: ({ getValue }) => formatUsd(getValue(), PRE_IPO_USD_OPTIONS) ?? '-',
		meta: {
			headerClassName: 'w-[132px] min-w-[132px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.latestRaise.description
		}
	}),
	columnHelper.accessor((row) => row.latestFundingValuation ?? undefined, {
		id: 'latestFundingValuation',
		header: preIpoDefinitions.company.latestFundingValuation.label,
		cell: ({ getValue }) => formatUsd(getValue(), PRE_IPO_USD_OPTIONS) ?? '-',
		meta: {
			headerClassName: 'w-[200px] min-w-[200px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.latestFundingValuation.description
		}
	}),
	columnHelper.accessor((row) => row.totalRaised ?? undefined, {
		id: 'totalRaised',
		header: preIpoDefinitions.company.totalRaised.label,
		cell: ({ getValue }) => formatUsd(getValue(), PRE_IPO_USD_OPTIONS) ?? '-',
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
					{formatPercent(value, PERCENT_OPTIONS) ?? '-'}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[172px] min-w-[172px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.premiumVsFunding.description
		}
	}),
	columnHelper.accessor((row) => row.latestFundingDate ?? undefined, {
		id: 'latestFundingDate',
		header: preIpoDefinitions.company.latestFundingDate.label,
		cell: ({ getValue }) => formatDate(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[164px] min-w-[164px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.latestFundingDate.description
		}
	}),
	columnHelper.accessor((row) => row.lastValuationDate ?? undefined, {
		id: 'lastValuationDate',
		header: preIpoDefinitions.company.valuationAsOf.label,
		cell: ({ getValue }) => formatDate(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[148px] min-w-[148px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.company.valuationAsOf.description
		}
	})
])

export function PreIpoOverview({ companies, updatedAt }: PreIpoOverviewPageProps) {
	const router = useRouter()
	const [searchValue, setSearchValue] = useState('')
	const deferredSearchValue = useDeferredValue(searchValue)
	const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
	const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION)
	const sectors = useMemo(() => getPreIpoSectors(companies), [companies])
	const selectedSectors = useMemo(
		() => readSelectionFromQuery(router.query, 'sector', 'excludeSector', sectors),
		[router.query, sectors]
	)
	const sectorFilter = useMemo(
		() => (selectedSectors.length === sectors.length ? null : new Set(selectedSectors)),
		[selectedSectors, sectors.length]
	)
	const filteredCompanies = useMemo(
		() => filterPreIpoCompanies(companies, deferredSearchValue, sectorFilter),
		[companies, deferredSearchValue, sectorFilter]
	)

	const table = usePaginatedTable({
		data: filteredCompanies,
		columns,
		state: { sorting, pagination },
		initialState: { columnVisibility: { companyId: false } },
		defaultColumn: { sortUndefined: 'last' },
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onPaginationChange: (updater) => startTransition(() => setPagination(updater))
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
							includeQueryKey="sector"
							excludeQueryKey="excludeSector"
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
