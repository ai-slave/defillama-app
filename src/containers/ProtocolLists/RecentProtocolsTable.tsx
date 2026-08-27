import {
	type ColumnFiltersState,
	createColumnHelper,
	type ExpandedState,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { TVLRange } from '~/components/Filters/TVLRange'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable } from '~/components/Table/Table'
import { prepareTableCsv, useTableSearch } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { removedCategoriesFromChainTvlSet } from '~/containers/ProtocolRankings/constants'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { RaisesTotal } from '~/containers/Raises/RaisesTotal'
import { Icon } from '~/ui/Icon'
import { searchFieldWrapperStyles, searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { PercentChange } from '~/ui/PercentChange'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { RelativeTime } from '~/ui/RelativeTime'
import { Switch } from '~/ui/Switch'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { IRecentProtocol } from './types'

/** Row type after applyExtraTvl adds change/mcaptvl fields. */
type RecentProtocolTableRow = IRecentProtocol & {
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	mcaptvl: number | null
}
const columnHelper = createColumnHelper<RecentProtocolTableRow>()

function normaliseCategoryFilterValues(values: unknown): string[] {
	if (Array.isArray(values)) {
		return values.filter((value): value is string => typeof value === 'string')
	}

	if (typeof values === 'string') {
		return [values]
	}

	return []
}

function areCategoryFiltersEqual(current: unknown, next: string[] | undefined): boolean {
	const currentValues = normaliseCategoryFilterValues(current).map((value) => value.toLowerCase())
	const nextValues = (next ?? []).map((value) => value.toLowerCase())

	if (currentValues.length !== nextValues.length) return false

	const currentSet = new Set(currentValues)
	for (const value of nextValues) {
		if (!currentSet.has(value)) return false
	}

	return true
}

export function RecentlyListedProtocolsTable({
	data,
	selectedChains,
	selectedCategories,
	chainList,
	categories,
	forkedList
}: {
	data: RecentProtocolTableRow[]
	selectedChains: Array<string>
	selectedCategories: Array<string>
	chainList: Array<string>
	categories: Array<string>
	forkedList?: Record<string, boolean>
}) {
	const [sorting, setSorting] = React.useState<SortingState>([{ desc: true, id: 'listedAt' }])
	const [expanded, setExpanded] = React.useState<ExpandedState>({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

	const router = useRouter()
	const csvFileName = router.pathname === '/airdrops' ? 'airdrops' : 'protocols'

	const columns = router.pathname === '/airdrops' ? airdropsColumns : recentlyListedProtocolsColumns

	const instance = useReactTable({
		data,
		columns,
		state: {
			sorting,
			expanded,
			columnFilters
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onExpandedChange: (updater) => React.startTransition(() => setExpanded(updater)),
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		getFilteredRowModel: getFilteredRowModel(),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel()
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	React.useEffect(() => {
		const categoryColumn = instance.getColumn('category')
		if (!categoryColumn || categories.length === 0) return

		const categoryFilterValues = selectedCategories.filter((selectedCategory) => {
			const lowerCategory = selectedCategory.toLowerCase()
			return lowerCategory !== 'all' && lowerCategory !== 'none'
		})
		const nextFilterValue = categoryFilterValues.length === categories.length ? undefined : categoryFilterValues

		if (areCategoryFiltersEqual(categoryColumn.getFilterValue(), nextFilterValue)) return

		React.startTransition(() => {
			categoryColumn.setFilterValue(nextFilterValue)
		})
	}, [instance, categories, selectedCategories])

	return (
		<Panel padding="none">
			<TableToolbar className="justify-end">
				<label className={searchFieldWrapperStyles}>
					<span className="sr-only">Search protocols</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search protocols..."
						className={searchFieldInputStyles}
					/>
				</label>

				<div className="flex items-start gap-1.5 max-sm:w-full max-sm:flex-col sm:items-center">
					{forkedList ? <HideForkedProtocols /> : null}

					<div className="flex w-full items-center gap-1.5 sm:w-auto">
						<SelectWithCombobox
							label="Chains"
							allValues={chainList}
							selectedValues={selectedChains}
							includeQueryKey="chain"
							excludeQueryKey="excludeChain"
							labelType="smol"
							variant="filter-responsive"
							size="md"
						/>
						{categories.length > 0 ? (
							<SelectWithCombobox
								label="Category"
								allValues={categories}
								selectedValues={selectedCategories}
								includeQueryKey="category"
								excludeQueryKey="excludeCategory"
								labelType="smol"
								variant="filter-responsive"
								size="md"
							/>
						) : null}
						<TVLRange size="md" />
					</div>

					<CSVDownloadButton prepareCsv={() => prepareTableCsv({ instance, filename: csvFileName })} smol size="md" />
				</div>
			</TableToolbar>
			<VirtualTable instance={instance} />
		</Panel>
	)
}

const whiteLabeledVaultProviders = new Set(['Veda'])

const protocolsColumns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span
					className="relative flex items-center gap-2"
					style={{ paddingLeft: row.depth ? row.depth * 48 : row.depth === 0 ? 24 : 0 }}
				>
					{row.subRows?.length > 0 ? (
						<button
							className="absolute -left-0.5"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							)}
						</button>
					) : (
						<Bookmark readableName={value} data-lgonly data-bookmark />
					)}

					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${value}`} />

					<span className="-my-2 flex flex-col">
						{row.original?.deprecated ? (
							<BasicLink
								href={`/protocol/${slug(value)}`}
								className="flex items-center gap-1 truncate text-sm font-medium text-link hover:underline"
							>
								<span className="truncate hover:underline">{value}</span>
								<DeprecatedProtocolMarker />
							</BasicLink>
						) : (
							<BasicLink
								href={`/protocol/${slug(value)}`}
								className="truncate text-sm font-medium text-link hover:underline"
							>
								{`${value}`}
							</BasicLink>
						)}

						<ProtocolChainsHovercard chains={row.original.chains} />
					</span>
					{value === 'SyncDEX Finance' ? (
						<Tooltip content={'Many users have reported issues with this protocol'}>
							<Icon name="alert-triangle" height={14} width={14} />
						</Tooltip>
					) : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[180px] lg:w-[240px] xl:w-[200px]'
		}
	}),
	columnHelper.accessor('category', {
		header: 'Category',
		filterFn: (row, columnId, filterValue) => {
			const selectedCategories = normaliseCategoryFilterValues(filterValue)
			if (selectedCategories.length === 0) return false

			const rowCategory = `${row.getValue(columnId) ?? ''}`.toLowerCase()
			for (const selectedCategory of selectedCategories) {
				if (rowCategory === selectedCategory.toLowerCase()) return true
			}

			return false
		},
		cell: ({ getValue }) => {
			const value = getValue()
			return value ? (
				<BasicLink href={getCategoryRoute(slug(value))} className="text-sm font-medium whitespace-nowrap text-link">
					{value}
				</BasicLink>
			) : (
				''
			)
		},
		meta: {
			headerClassName: 'w-[140px]'
		}
	}),
	columnHelper.accessor('tvl', {
		header: 'TVL',
		cell: ({ getValue, row }) => <ProtocolTvlCell value={getValue()} rowValues={row.original} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Sum of value of all coins held in smart contracts of the protocol'
		}
	}),
	columnHelper.accessor('change_1d', {
		header: '1d TVL Change',
		cell: ({ getValue }) => <PercentChange percent={getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 24 hours'
		}
	}),
	columnHelper.accessor('change_7d', {
		header: '7d TVL Change',
		cell: ({ getValue }) => <PercentChange percent={getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 7 days'
		}
	}),
	columnHelper.accessor('change_1m', {
		header: '1m TVL Change',
		cell: ({ getValue }) => <PercentChange percent={getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 30 days'
		}
	}),
	columnHelper.accessor('mcaptvl', {
		header: 'Mcap/TVL',
		cell: (info) => <>{formatRatio(info.getValue())}</>,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end',
			headerHelperText: 'Market cap / TVL ratio'
		}
	})
]
type ProtocolTvlRow = RecentProtocolTableRow & {
	strikeTvl?: boolean
	parentExcluded?: boolean
	isParentProtocol?: boolean
}

function ProtocolTvlCell({ value, rowValues }: { value: unknown; rowValues: ProtocolTvlRow }) {
	const tvlValue = typeof value === 'number' ? value : null

	let text: string | null = null

	if (rowValues.strikeTvl) {
		text = 'This protocol is excluded from chain TVL to avoid double counting'

		if (whiteLabeledVaultProviders.has(rowValues.name)) {
			text =
				'This protocol issues white-labeled vaults which may result in TVL being counted by another protocol (e.g., double counted).'
		}

		if (rowValues.category && removedCategoriesFromChainTvlSet.has(rowValues.category)) {
			text = `${rowValues.category} protocols are not counted into Chain TVL`
		}

		if (text && rowValues.isParentProtocol) {
			text = 'Some sub-protocols are excluded from chain tvl'
		}
	}

	if (!text && !rowValues.parentExcluded) {
		return (
			<>
				{tvlValue != null
					? formatUsd(tvlValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null}
			</>
		)
	}

	return (
		<span className="flex items-center justify-end gap-1">
			{text ? <QuestionHelper text={text} /> : null}
			{rowValues.parentExcluded ? (
				<QuestionHelper
					text={"There's some internal doublecounting that is excluded from parent TVL, so sum won't match"}
				/>
			) : null}
			<span
				style={{
					color: rowValues.strikeTvl ? 'var(--color-tertiary)' : 'inherit'
				}}
			>
				{tvlValue != null
					? formatUsd(tvlValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null}
			</span>
		</span>
	)
}

const listedAtColumn = columnHelper.accessor('listedAt', {
	header: 'Listed At',
	cell: ({ getValue }) => {
		const listedAt = getValue()
		return listedAt != null ? <RelativeTime value={listedAt} input="seconds" /> : null
	},
	meta: {
		headerClassName: 'w-[120px]',
		align: 'end'
	}
})

const recentlyListedProtocolsColumns = [
	...protocolsColumns.slice(0, 3),
	listedAtColumn,
	...protocolsColumns.slice(3, -1)
]

export const airdropsColumns = [
	...protocolsColumns.slice(0, 3),
	columnHelper.accessor((row) => row.raiseSummary?.totalUsd ?? undefined, {
		id: 'totalRaised',
		header: 'Total Money Raised',
		cell: ({ row }) => (row.original.raiseSummary ? <RaisesTotal {...row.original.raiseSummary} /> : null),
		meta: {
			csvHeader: 'Disclosed Money Raised',
			headerClassName: 'w-[168px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.raiseSummary?.undisclosedCount ?? undefined, {
		id: 'undisclosedRounds',
		header: 'Undisclosed Funding Rounds',
		meta: { hidden: true, csvOnly: true }
	}),
	listedAtColumn,
	...protocolsColumns.slice(3, -1)
]

function HideForkedProtocols() {
	const router = useRouter()

	const { hideForks } = router.query

	const toHide = !(hideForks && typeof hideForks === 'string' && hideForks === 'true')

	const hide = () => {
		void pushShallowQuery(router, { hideForks: toHide })
	}
	return <Switch label="Hide Forked Protocols" value="hideForks" checked={!toHide} onChange={hide} />
}
