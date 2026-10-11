import { createColumnHelper, tableFeatures, useTable, type ColumnVisibilityState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { ActiveFilterPills } from '~/components/FilterBuilderDialog'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { UrlSearchInput } from '~/components/Table/search/UrlSearchInput'
import { TokenLogo } from '~/components/TokenLogo'
import { ViewTabs, type ViewTab } from '~/components/ViewTabs'
import { TokenRightsPieHovercard } from '~/containers/TokenRights/TokenRightsPopover'
import type { TokenRightsPreview } from '~/containers/TokenRights/types'
import { tokenTableFeatures, type TokenTableFeatures } from '~/containers/Tokens/tableFeatures'
import { Button } from '~/ui/Button'
import { Change } from '~/ui/Change'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { InlineStatStrip, type InlineStatStripItem } from '~/ui/SummaryStats'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { pushShallowQuery } from '~/utils/routerQuery'
import { getTokensChartQueryValue, parseTokensChartState, type TokensPageView } from './chartState'
import {
	NAME_COLUMN_WIDTH,
	TOKENS_HIDEABLE_COLUMN_SPECS,
	TOKENS_HIDEABLE_COLUMNS_WIDTH,
	type TokensColumnSpec
} from './columnSpecs'
import { useTokensColumnVisibility } from './columnVisibility'
import { prepareTokensCsv } from './csv'
import {
	buildTokensFiltersQueryUpdate,
	formatTokensActiveFilter,
	getTokensFiltersDefaultSorting,
	parseTokensFiltersFromQuery,
	shouldApplyTokensFilterSorting,
	type TokensActiveFilter
} from './filters'
import { TokensSourceAvailability } from './SourceAvailability'
import { TokensChartsSection } from './TokensChartsSection'
import { TokensFiltersDialog } from './TokensFiltersDialog'
import type {
	TokensFilterOption,
	TokensPageProps,
	TokensPageStats,
	TokensPageStatsDisplay,
	TokensTableRow
} from './types'
import { useTokensServerTable } from './useTokensServerTable'
import { buildTokensChartQueryString, getTokenFilterSelection, getTokensChainQueryUpdates } from './utils'

const tableFeaturesConfig: TokenTableFeatures = tableFeatures({
	...tokenTableFeatures
})

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const
export const TOKENS_TABLE_WIDTH_EXCLUDING_RANK = NAME_COLUMN_WIDTH + TOKENS_HIDEABLE_COLUMNS_WIDTH
// Width of the optional "Markets" expander column (added only in the expandable/watchlist variant).
export const TOKENS_MARKETS_EXPANDER_COLUMN_WIDTH = 104
const columnHelper = createColumnHelper<typeof tableFeaturesConfig, TokensTableRow>()

type TokensTableStyle = React.CSSProperties & {
	'--tokens-rank-column-width': string
	'--tokens-table-min-width': string
}

export function getRankColumnWidth(rows: Array<TokensTableRow>): number {
	let maxDigits = 1
	for (const row of rows) {
		const digits = String(row.rowNumber).length
		if (digits > maxDigits) maxDigits = digits
	}
	return Math.max(40, 20 + maxDigits * 7)
}

function Dash() {
	return <span className="text-tertiary">-</span>
}

function CurrencyValue({ value }: { value: string | null }) {
	return value === null ? <Dash /> : <span className="whitespace-nowrap">{value}</span>
}

function ProgressPercentValue({ value, width }: { value: string | null; width: string | null }) {
	if (value === null || width === null) return <Dash />

	return (
		<span className="flex min-w-[92px] flex-col items-end gap-1">
			<span>{value}</span>
			<span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-elevated-2">
				<span className="block h-full rounded-full bg-brand" style={{ width }} />
			</span>
		</span>
	)
}

function TokenCell({ row }: { row: { original: TokensTableRow } }) {
	const { name, symbol, logo, href, id } = row.original
	const label = (
		<span className="min-w-0">
			<span className="block truncate label-md">{name}</span>
			<span className="block label-sm text-secondary">{symbol}</span>
		</span>
	)

	return (
		<span className="relative flex min-w-0 items-center gap-2 pl-5">
			<Bookmark
				size="sm"
				watchlistType="tokens"
				itemKey={id}
				readableName={symbol}
				className="absolute -left-1.5 hidden lg:flex"
			/>
			<TokenLogo src={logo} size={24} alt={`Logo of ${name}`} />
			{href ? (
				<BasicLink href={href} className="min-w-0 text-link hover:underline">
					{label}
				</BasicLink>
			) : (
				label
			)}
		</span>
	)
}

function RightsPie({
	name,
	rights,
	fullRightsHref
}: {
	name: string
	rights: TokenRightsPreview | null
	fullRightsHref: string | null
}) {
	if (!rights) return <Dash />
	return <TokenRightsPieHovercard name={name} rights={rights} fullRightsHref={fullRightsHref} utr={null} />
}

const SPEC_HEADERS = new Map(TOKENS_HIDEABLE_COLUMN_SPECS.map((spec) => [spec.id, spec.header]))

// The column picker and CSV read headers from the specs, so the table header comes from the same place.
function specColumn(id: TokensColumnSpec['id']) {
	return { id, header: SPEC_HEADERS.get(id)! }
}

export const TOKENS_COLUMNS = columnHelper.columns([
	columnHelper.accessor((row) => row.rank ?? undefined, {
		id: 'rank',
		header: '#',
		cell: ({ row }) => <span className="text-secondary">{row.original.rowNumber}</span>,
		enableHiding: false,
		meta: {
			headerClassName:
				'sticky left-0 z-20 w-(--tokens-rank-column-width) min-w-(--tokens-rank-column-width) bg-surface px-1!',
			cellClassName: 'sticky left-0 z-10 bg-surface px-1!',
			align: 'center',
			headerHelperText: 'Row number in the current sorted and filtered results'
		}
	}),
	columnHelper.accessor((row) => row.name, {
		id: 'name',
		header: 'Coin',
		cell: ({ row }) => <TokenCell row={row} />,
		enableHiding: false,
		meta: {
			headerClassName: 'sticky left-(--tokens-rank-column-width) z-20 w-[184px] min-w-[184px] bg-surface pl-1!',
			cellClassName: 'sticky left-(--tokens-rank-column-width) z-10 bg-surface pl-1!',
			headerHelperText: 'Token name, symbol, and token page link when available'
		}
	}),
	columnHelper.accessor((row) => row.price ?? undefined, {
		...specColumn('price'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.price} />,
		meta: {
			headerClassName: 'w-[140px] min-w-[140px]',
			align: 'end',
			headerHelperText: 'Current token price in USD'
		}
	}),
	columnHelper.accessor((row) => row.priceChange24h ?? undefined, {
		...specColumn('priceChange24h'),
		cell: ({ row }) =>
			row.original.priceChange24h == null ? <Dash /> : <Change value={row.original.priceChange24h} />,
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'end',
			headerHelperText: 'Token price change over the last 24 hours'
		}
	}),
	columnHelper.accessor((row) => row.priceChange7d ?? undefined, {
		...specColumn('priceChange7d'),
		cell: ({ row }) => (row.original.priceChange7d == null ? <Dash /> : <Change value={row.original.priceChange7d} />),
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'end',
			headerHelperText: 'Token price change over the last 7 days'
		}
	}),
	columnHelper.accessor((row) => row.priceChange30d ?? undefined, {
		...specColumn('priceChange30d'),
		cell: ({ row }) =>
			row.original.priceChange30d == null ? <Dash /> : <Change value={row.original.priceChange30d} />,
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'end',
			headerHelperText: 'Token price change over the last 30 days'
		}
	}),
	columnHelper.accessor((row) => row.marketCap ?? undefined, {
		...specColumn('marketCap'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.marketCap} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Market capitalization from token price and circulating supply'
		}
	}),
	columnHelper.accessor((row) => row.fdv ?? undefined, {
		...specColumn('fdv'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.fdv} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Fully diluted valuation from token price and max supply'
		}
	}),
	columnHelper.accessor((row) => row.outstandingFdv ?? undefined, {
		...specColumn('outstandingFdv'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.outstandingFdv} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Outstanding FDV using adjusted unlocked/outstanding supply when available'
		}
	}),
	columnHelper.accessor((row) => row.unlockedPercent ?? undefined, {
		...specColumn('unlockedPercent'),
		cell: ({ row }) => (
			<ProgressPercentValue
				value={row.original.display.unlockedPercent}
				width={row.original.display.unlockedPercentWidth}
			/>
		),
		meta: {
			headerClassName: 'w-[130px] min-w-[130px]',
			align: 'end',
			headerHelperText: 'Estimated share of max supply currently unlocked or outstanding'
		}
	}),
	columnHelper.accessor((row) => row.spotVolume24h ?? undefined, {
		...specColumn('spotVolume24h'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.spotVolume24h} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: '24h spot trading volume across tracked markets'
		}
	}),
	columnHelper.accessor((row) => row.perpsVolume24h ?? undefined, {
		...specColumn('perpsVolume24h'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.perpsVolume24h} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: '24h perpetual futures trading volume across tracked markets'
		}
	}),
	columnHelper.accessor((row) => row.openInterest24h ?? undefined, {
		...specColumn('openInterest24h'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.openInterest24h} />,
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Open interest across tracked perpetual markets'
		}
	}),
	columnHelper.accessor((row) => row.fees24h ?? undefined, {
		...specColumn('fees24h'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.fees24h} />,
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Protocol fees over the last 24 hours when a protocol match exists'
		}
	}),
	columnHelper.accessor((row) => row.revenue24h ?? undefined, {
		...specColumn('revenue24h'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.revenue24h} />,
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Protocol revenue over the last 24 hours when a protocol match exists'
		}
	}),
	columnHelper.accessor((row) => row.holdersRevenue24h ?? undefined, {
		...specColumn('holdersRevenue24h'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.holdersRevenue24h} />,
		meta: {
			headerClassName: 'w-[150px] min-w-[150px]',
			align: 'end',
			headerHelperText: '24h revenue directed to token holders when tracked'
		}
	}),
	columnHelper.accessor((row) => row.trsPercent ?? undefined, {
		...specColumn('trsPercent'),
		cell: ({ row }) => (
			<ProgressPercentValue value={row.original.display.trsPercent} width={row.original.display.trsPercentWidth} />
		),
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Token holder revenue as a percentage of protocol revenue'
		}
	}),
	columnHelper.accessor((row) => row.rights ?? undefined, {
		...specColumn('rights'),
		cell: ({ getValue, row }) => (
			<RightsPie name={row.original.name} rights={getValue() ?? null} fullRightsHref={row.original.tokenRightsHref} />
		),
		enableSorting: false,
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'center',
			headerHelperText: 'Compact summary of governance, treasury, revenue, buyback, dividend, and burn rights'
		}
	}),
	columnHelper.accessor((row) => row.unlock30dUsd ?? undefined, {
		...specColumn('unlock30dUsd'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.unlock30dUsd} />,
		meta: {
			headerClassName: 'w-[160px] min-w-[160px]',
			align: 'end',
			headerHelperText:
				'Estimated value of cliff and linear releases during the previous 30 days, valued at current token prices'
		}
	}),
	columnHelper.accessor((row) => row.upcomingUnlockUsd ?? undefined, {
		...specColumn('upcomingUnlockUsd'),
		cell: ({ row }) => <CurrencyValue value={row.original.display.upcomingUnlockUsd} />,
		meta: {
			headerClassName: 'w-[160px] min-w-[160px]',
			align: 'end',
			headerHelperText:
				'Estimated value of scheduled cliff and linear releases during the next 30 days, valued at current token prices'
		}
	})
])

const expanderColumn = columnHelper.display({
	id: 'expander',
	header: 'Markets',
	enableSorting: false,
	cell: ({ row }) => {
		const isExpanded = row.getIsExpanded()
		return (
			<Button type="button" size="sm" onClick={row.getToggleExpandedHandler()} aria-expanded={isExpanded}>
				Markets
				<Icon
					name="chevron-down"
					className={`size-3 text-tertiary transition-transform duration-100 ${isExpanded ? 'rotate-180' : ''}`}
				/>
			</Button>
		)
	},
	meta: {
		headerClassName: 'w-[104px] min-w-[104px]',
		headerHelperText: 'Show the exchanges and trading pairs this token is available on'
	}
})

const nameColumnIndex = TOKENS_COLUMNS.findIndex((column) => column.id === 'name')
const expanderInsertIndex = nameColumnIndex >= 0 ? nameColumnIndex + 1 : TOKENS_COLUMNS.length
export const EXPANDABLE_TOKENS_COLUMNS = [
	...TOKENS_COLUMNS.slice(0, expanderInsertIndex),
	expanderColumn,
	...TOKENS_COLUMNS.slice(expanderInsertIndex)
]

function TokensStats({ stats, display }: { stats: TokensPageStats; display: TokensPageStatsDisplay }) {
	const items: Array<InlineStatStripItem> = [
		{
			label: 'MCap',
			tooltip:
				'Total market capitalization excluding wrapped, staked and other receipt assets identified by CoinGecko. The 24-hour change estimates price-driven movement using current circulating supplies.',
			value: display.totalMarketCap,
			change:
				stats.marketCapWeightedChange24h == null
					? undefined
					: { value: stats.marketCapWeightedChange24h, comparison: 'over 24h' }
		},
		{
			label: '24H Spot Vol',
			value: display.spotVolume24h ?? '—',
			tooltip: 'Spot trading volume over the last 24 hours across tracked markets.'
		},
		{
			label: '24H Perps Vol',
			value: display.perpsVolume24h ?? '—',
			tooltip: 'Perpetual futures trading volume over the last 24 hours across tracked markets.'
		},
		{
			label: 'OI',
			value: display.openInterest24h ?? '—',
			tooltip: 'Current USD value of outstanding perpetual futures positions across tracked markets.'
		},
		{
			label: 'Past 30D Unlocks',
			value: display.unlock30dUsd ?? '—',
			tooltip:
				'Estimated value of cliff and linear releases during the previous 30 days, valued at current token prices.'
		},
		{
			label: 'Next 30D Unlocks',
			value: display.upcomingUnlockUsd ?? '—',
			tooltip:
				'Estimated value of scheduled cliff and linear releases during the next 30 days, valued at current token prices.'
		}
	]

	return <InlineStatStrip items={items} />
}

const VIEW_TABS: ReadonlyArray<ViewTab<TokensPageView>> = [
	{ id: 'table', label: 'Table' },
	{ id: 'map', label: 'Market Map' },
	{ id: 'movers', label: 'Movers' }
]
const VIEW_TABS_ID_PREFIX = 'tokens-view'

/** Filters that apply to every view: search, chains, categories and the numeric filters dialog. */
function TokensSharedControls({
	search,
	updateSearch,
	filters,
	hasChainFilter,
	nativeOnly,
	chainOptions,
	categoryOptions,
	onFiltersChange,
	onChainQueryChange,
	onNativeOnlyChange
}: {
	search: string
	updateSearch: (search: string) => void
	filters: Array<TokensActiveFilter>
	hasChainFilter: boolean
	nativeOnly: boolean
	chainOptions: Array<TokensFilterOption>
	categoryOptions: Array<TokensFilterOption>
	onFiltersChange: (filters: Array<TokensActiveFilter>) => void
	onChainQueryChange: (updates: Record<string, string | Array<string> | undefined>) => void
	onNativeOnlyChange: (nativeOnly: boolean) => void
}) {
	const chainSelectOptions = React.useMemo(
		() => chainOptions.map((option) => ({ key: option.id, name: option.label })),
		[chainOptions]
	)
	const categorySelectOptions = React.useMemo(
		() =>
			categoryOptions.map((option) => ({
				key: option.id,
				name: option.label,
				...(option.description ? { help: option.description } : {})
			})),
		[categoryOptions]
	)

	return (
		<>
			<UrlSearchInput search={search} updateSearch={updateSearch} label="Search tokens" placeholder="Search tokens…" />
			<SelectWithCombobox
				allValues={chainSelectOptions}
				includeQueryKey="chains"
				excludeQueryKey="excludeChains"
				resetPageOnQueryChange
				label="Chains"
				labelType="smol"
				variant="filter"
				size="md"
				searchPlaceholder="Search chains…"
				pushQueryUpdates={onChainQueryChange}
			/>
			{hasChainFilter ? (
				<Checkbox variant="filter" checked={nativeOnly} onChange={(event) => onNativeOnlyChange(event.target.checked)}>
					<span className="flex items-center gap-1">
						Primary chain only
						<QuestionHelper text="Only show tokens whose primary chain matches the selected chain filter." />
					</span>
				</Checkbox>
			) : null}
			<SelectWithCombobox
				allValues={categorySelectOptions}
				includeQueryKey="categories"
				excludeQueryKey="excludeCategories"
				resetPageOnQueryChange
				label="Categories"
				labelType="smol"
				variant="filter"
				size="md"
				visibleOptionLimit={null}
				searchPlaceholder="Search categories…"
			/>
			<TokensFiltersDialog filters={filters} onFiltersChange={onFiltersChange} />
		</>
	)
}

const COLUMN_PICKER_OPTIONS = TOKENS_HIDEABLE_COLUMN_SPECS.map((column) => ({ key: column.id, name: column.header }))

export default function TokensPage({ initialData }: TokensPageProps) {
	const router = useRouter()
	const { view } = parseTokensChartState(router.query)
	const serverTable = useTokensServerTable(initialData, view === 'table')
	const filters = React.useMemo(() => parseTokensFiltersFromQuery(router.query), [router.query])
	const chainOptionIds = React.useMemo(
		() => serverTable.data.chainOptions.map((option) => option.id),
		[serverTable.data.chainOptions]
	)
	const hasChainFilter =
		getTokenFilterSelection(serverTable.pageQuery.chains, serverTable.pageQuery.excludeChains, chainOptionIds) !== null
	const pendingFiltersRef = React.useRef<{ query: typeof router.query; filters: Array<TokensActiveFilter> } | null>(
		null
	)
	const currentSorting = serverTable.sorting[0]
	const applyFilters = React.useCallback(
		(nextFilters: Array<TokensActiveFilter>) => {
			const previousFilters =
				pendingFiltersRef.current?.query === router.query ? pendingFiltersRef.current.filters : filters
			const update = buildTokensFiltersQueryUpdate(nextFilters)
			if (shouldApplyTokensFilterSorting(currentSorting, previousFilters)) {
				const nextSorting = getTokensFiltersDefaultSorting(nextFilters)
				update.sortBy =
					nextSorting && !(nextSorting.id === 'marketCap' && nextSorting.desc) ? nextSorting.id : undefined
				update.sortDesc = nextSorting && !nextSorting.desc ? 'false' : undefined
			}
			pendingFiltersRef.current = { query: router.query, filters: nextFilters }
			void pushShallowQuery(router, update)
		},
		[currentSorting, filters, router]
	)
	const removeFilter = React.useCallback(
		(id: TokensActiveFilter['id']) => {
			const baseFilters =
				pendingFiltersRef.current?.query === router.query ? pendingFiltersRef.current.filters : filters
			applyFilters(baseFilters.filter((filter) => filter.id !== id))
		},
		[applyFilters, filters, router.query]
	)
	const updateNativeOnly = React.useCallback(
		(nativeOnly: boolean) => {
			void pushShallowQuery(router, { nativeOnly: nativeOnly ? 'true' : undefined, page: undefined })
		},
		[router]
	)
	const updateChainQuery = React.useCallback(
		(updates: Record<string, string | Array<string> | undefined>) => {
			void pushShallowQuery(router, getTokensChainQueryUpdates(updates, hasChainFilter))
		},
		[hasChainFilter, router]
	)
	const rankColumnWidth = getRankColumnWidth(serverTable.rows)
	const [columnVisibility, handleColumnVisibilityChange] = useTokensColumnVisibility()
	const effectiveColumnVisibility = React.useMemo(() => {
		const next = { ...columnVisibility }
		for (const filter of filters) {
			if (filter.id !== 'rank') next[filter.id] = true
		}
		return next
	}, [columnVisibility, filters])
	let visibleColumnsWidth = rankColumnWidth + NAME_COLUMN_WIDTH
	for (const column of TOKENS_HIDEABLE_COLUMN_SPECS) {
		if (effectiveColumnVisibility[column.id] !== false) visibleColumnsWidth += column.width
	}
	const tableStyle: TokensTableStyle = {
		'--tokens-rank-column-width': `${rankColumnWidth}px`,
		'--tokens-table-min-width': `${visibleColumnsWidth}px`
	}
	const table = useTable({
		features: tableFeaturesConfig,
		data: serverTable.rows,
		columns: TOKENS_COLUMNS,
		state: {
			pagination: serverTable.pagination,
			sorting: serverTable.sorting,
			columnVisibility: effectiveColumnVisibility
		},
		enableSortingRemoval: false,
		manualPagination: true,
		manualSorting: true,
		rowCount: serverTable.total,
		onPaginationChange: serverTable.onPaginationChange,
		onSortingChange: serverTable.onSortingChange,
		onColumnVisibilityChange: handleColumnVisibilityChange
	})
	const selectedColumns = TOKENS_HIDEABLE_COLUMN_SPECS.filter((column) => columnVisibility[column.id] !== false).map(
		(column) => column.id
	)
	const setSelectedColumns = React.useCallback(
		(updater: Array<string> | ((old: Array<string>) => Array<string>)) => {
			handleColumnVisibilityChange((old) => {
				const current = TOKENS_HIDEABLE_COLUMN_SPECS.filter((column) => old[column.id] !== false).map(
					(column) => column.id
				)
				const next = typeof updater === 'function' ? updater(current) : updater
				const visibility: ColumnVisibilityState = { ...old }
				for (const column of TOKENS_HIDEABLE_COLUMN_SPECS) {
					visibility[column.id] = next.includes(column.id)
				}
				return visibility
			})
		},
		[handleColumnVisibilityChange]
	)
	const prepareCsv = React.useCallback(
		() =>
			prepareTokensCsv({
				query: serverTable.query,
				sorting: serverTable.sorting,
				hiddenColumnIds: new Set(
					TOKENS_HIDEABLE_COLUMN_SPECS.filter((c) => effectiveColumnVisibility[c.id] === false).map((c) => c.id)
				)
			}),
		[effectiveColumnVisibility, serverTable.query, serverTable.sorting]
	)

	const setView = React.useCallback(
		(next: TokensPageView) => {
			void pushShallowQuery(router, { view: getTokensChartQueryValue('view', next) })
		},
		[router]
	)
	const sharedControls = (
		<TokensSharedControls
			search={serverTable.pageQuery.search}
			updateSearch={serverTable.updateSearch}
			filters={filters}
			hasChainFilter={hasChainFilter}
			nativeOnly={serverTable.pageQuery.nativeOnly}
			chainOptions={serverTable.data.chainOptions}
			categoryOptions={serverTable.data.categoryOptions}
			onFiltersChange={applyFilters}
			onChainQueryChange={updateChainQuery}
			onNativeOnlyChange={updateNativeOnly}
		/>
	)
	const filterPills =
		filters.length > 0 ? (
			<div className="px-2 pb-2">
				<ActiveFilterPills
					pills={filters.map((filter) => ({
						id: filter.id,
						label: formatTokensActiveFilter(filter),
						onRemove: () => removeFilter(filter.id)
					}))}
				/>
			</div>
		) : null

	return (
		<div className="flex flex-col gap-2">
			<TokensStats stats={serverTable.data.stats} display={serverTable.data.statsDisplay} />
			{view === 'table' ? <TokensSourceAvailability sources={serverTable.data.unavailableSources} /> : null}
			<Panel padding="none">
				<Tabs value={view} onValueChange={setView} values={VIEW_TABS.map((tab) => tab.id)} id={VIEW_TABS_ID_PREFIX}>
					<ViewTabs tabs={VIEW_TABS} label="Tokens view" />
					<TabPanel value={view}>
						{view === 'table' ? (
							<>
								<TableToolbar>
									{sharedControls}
									<TableToolbarControlGroup>
										<SelectWithCombobox
											allValues={COLUMN_PICKER_OPTIONS}
											selectedValues={selectedColumns}
											setSelectedValues={setSelectedColumns}
											nestedMenu={false}
											label="Columns"
											labelType="smol"
											variant="filter"
											size="md"
										/>
										<CSVDownloadButton prepareCsv={prepareCsv} smol size="md" />
									</TableToolbarControlGroup>
								</TableToolbar>
								{filterPills}
								<PaginatedTable
									table={table}
									pageSizeOptions={PAGE_SIZE_OPTIONS}
									style={tableStyle}
									tableClassName="min-w-(--tokens-table-min-width)"
									stickyHeader
									interactionDisabled={serverTable.rowsQuery.isFetching}
								/>
							</>
						) : (
							<TokensChartsSection
								view={view}
								filterQueryString={buildTokensChartQueryString(serverTable.query)}
								sharedControls={sharedControls}
								filterPills={filterPills}
							/>
						)}
					</TabPanel>
				</Tabs>
			</Panel>
		</div>
	)
}
