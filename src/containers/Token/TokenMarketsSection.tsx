import { useQuery } from '@tanstack/react-query'
import {
	type ColumnDef,
	type SortingState,
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable
} from '@tanstack/react-table'
import dayjs from 'dayjs'
import { type KeyboardEvent, useEffect, useMemo, useReducer, useRef } from 'react'
import { CSVDownloadButton } from '~/components/ButtonStyled/CsvButton'
import { Icon } from '~/components/Icon'
import { LocalLoader } from '~/components/Loaders'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import type {
	MarketCategoryTotals,
	MarketPair,
	MarketVenue,
	TokenMarketsResponse
} from '~/containers/Markets/api.types'
import { ChangeCell, FundingCell, MetricStat } from '~/containers/Markets/marketMetrics'
import type { Segment } from '~/containers/Markets/segments'
import { pctChange } from '~/containers/Markets/utils'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { TabLink } from '~/ui/Tab'
import { TableToolbar } from '~/ui/Toolbar'
import { formattedNum } from '~/utils'
import { fetchTokenMarkets } from './api'
import { DEFAULT_TABLE_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS } from './tableUtils'

const DEFAULT_SORTING: SortingState = [{ id: 'volume_24h', desc: true }]

const TOKEN_MARKETS_SECTION_ID = 'token-markets'

type VenueTabId = 'all' | 'cex' | 'dex'

const VENUE_TABS: ReadonlyArray<{ id: VenueTabId; label: string }> = [
	{ id: 'all', label: 'All' },
	{ id: 'cex', label: 'CEX' },
	{ id: 'dex', label: 'DEX' }
]

const CATEGORY_TABS: ReadonlyArray<{ id: Segment; label: string }> = [
	{ id: 'spot', label: 'Spot' },
	{ id: 'linear_perp', label: 'Linear Perp' },
	{ id: 'inverse_perp', label: 'Inverse Perp' }
]

const EMPTY_TOTALS: MarketCategoryTotals = { pair_count: 0, total_volume_24h: 0, total_oi_usd: null }

const columnHelper = createColumnHelper<MarketPair>()

function renderNullableNum(value: number | null | undefined, isUsd = false): string {
	if (value == null) return '–'
	return formattedNum(value, isUsd)
}

function sumPairMetrics(rows: MarketPair[]) {
	let volume = 0
	let volumePrev = 0
	let hasVolumePrev = false
	let oi = 0
	let oiPrev = 0
	let hasOi = false
	let hasOiPrev = false

	for (const row of rows) {
		if (row.volume_24h != null) volume += row.volume_24h
		if (row.volume_prev_24h != null) {
			volumePrev += row.volume_prev_24h
			hasVolumePrev = true
		}
		if (row.oi_usd != null) {
			oi += row.oi_usd
			hasOi = true
		}
		if (row.oi_prev_usd != null) {
			oiPrev += row.oi_prev_usd
			hasOiPrev = true
		}
	}

	return {
		volume,
		volumePrev: hasVolumePrev ? volumePrev : null,
		oi: hasOi ? oi : null,
		oiPrev: hasOiPrev ? oiPrev : null
	}
}

function renderFeeRate(value: number | null | undefined): string {
	if (value == null) return '–'
	return `${(value * 100).toFixed(3)}%`
}

function renderLeverage(value: number | null | undefined): string {
	if (value == null) return '–'
	return `${value}x`
}

const venueColumn = columnHelper.accessor('exchange', {
	id: 'exchange',
	header: 'Venue',
	enableSorting: false,
	cell: ({ getValue, row }) => {
		const exchange = getValue()
		const url = row.original.pair_url
		const label = (
			<span className="flex items-center gap-2">
				<TokenLogo name={exchange} kind="token" alt={`Logo of ${exchange}`} size={20} />
				<span className="body-sm capitalize">{exchange}</span>
			</span>
		)
		return url ? (
			<a href={url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
				{label}
			</a>
		) : (
			label
		)
	},
	meta: {
		headerClassName: 'w-[min(180px,40vw)]'
	}
})

const pairColumn = columnHelper.accessor('symbol', {
	id: 'symbol',
	header: 'Pair',
	enableSorting: false,
	cell: ({ getValue }) => <span className="body-sm uppercase">{getValue()}</span>,
	meta: {
		headerClassName: 'w-[140px]'
	}
})

const priceColumn = columnHelper.accessor((row) => row.price ?? undefined, {
	id: 'price',
	header: 'Price',
	cell: ({ getValue }) => renderNullableNum(getValue() ?? null, true),
	meta: {
		headerClassName: 'w-[110px]',
		align: 'end'
	}
})

const priceChangeColumn = columnHelper.accessor((row) => row.price_change_24h ?? undefined, {
	id: 'price_change_24h',
	header: '24h',
	cell: ({ row }) => <ChangeCell fraction={row.original.price_change_24h} />,
	meta: {
		headerClassName: 'w-[100px]',
		align: 'end'
	}
})

const volumeColumn = columnHelper.accessor((row) => row.volume_24h ?? undefined, {
	id: 'volume_24h',
	header: '24h Volume',
	cell: ({ getValue }) => renderNullableNum(getValue() ?? null, true),
	meta: {
		headerClassName: 'w-[120px]',
		align: 'end'
	}
})

const volumeChangeColumn = columnHelper.accessor((row) => pctChange(row.volume_24h, row.volume_prev_24h) ?? undefined, {
	id: 'volume_change_24h',
	header: 'Vol Δ',
	cell: ({ row }) => <ChangeCell fraction={pctChange(row.original.volume_24h, row.original.volume_prev_24h)} />,
	meta: {
		headerClassName: 'w-[100px]',
		align: 'end'
	}
})

const oiColumn = columnHelper.accessor((row) => row.oi_usd ?? undefined, {
	id: 'oi_usd',
	header: 'Open Interest',
	cell: ({ getValue }) => renderNullableNum(getValue() ?? null, true),
	meta: {
		headerClassName: 'w-[140px]',
		align: 'end'
	}
})

const oiChangeColumn = columnHelper.accessor((row) => pctChange(row.oi_usd, row.oi_prev_usd) ?? undefined, {
	id: 'oi_change_24h',
	header: 'OI Δ',
	cell: ({ row }) => <ChangeCell fraction={pctChange(row.original.oi_usd, row.original.oi_prev_usd)} />,
	meta: {
		headerClassName: 'w-[100px]',
		align: 'end'
	}
})

const fundingColumn = columnHelper.accessor((row) => row.funding_rate_8h ?? undefined, {
	id: 'funding_rate_8h',
	header: 'Funding (8h)',
	cell: ({ row }) => <FundingCell rate={row.original.funding_rate_8h} />,
	meta: {
		headerClassName: 'w-[130px]',
		align: 'end'
	}
})

const maxLeverageColumn = columnHelper.accessor((row) => row.max_leverage ?? undefined, {
	id: 'max_leverage',
	header: 'Max Leverage',
	cell: ({ row }) => renderLeverage(row.original.max_leverage),
	meta: {
		headerClassName: 'w-[130px]',
		align: 'end'
	}
})

const makerFeeColumn = columnHelper.accessor((row) => row.maker_fee ?? undefined, {
	id: 'maker_fee',
	header: 'Maker Fee',
	cell: ({ row }) => renderFeeRate(row.original.maker_fee),
	meta: {
		headerClassName: 'w-[110px]',
		align: 'end'
	}
})

const takerFeeColumn = columnHelper.accessor((row) => row.taker_fee ?? undefined, {
	id: 'taker_fee',
	header: 'Taker Fee',
	cell: ({ row }) => renderFeeRate(row.original.taker_fee),
	meta: {
		headerClassName: 'w-[110px]',
		align: 'end'
	}
})

const SPOT_COLUMNS: ColumnDef<MarketPair, any>[] = [
	venueColumn,
	pairColumn,
	priceColumn,
	priceChangeColumn,
	volumeColumn,
	volumeChangeColumn,
	makerFeeColumn,
	takerFeeColumn
]
const PERP_COLUMNS: ColumnDef<MarketPair, any>[] = [
	venueColumn,
	pairColumn,
	priceColumn,
	priceChangeColumn,
	volumeColumn,
	volumeChangeColumn,
	oiColumn,
	oiChangeColumn,
	fundingColumn,
	maxLeverageColumn,
	makerFeeColumn,
	takerFeeColumn
]

const byVolumeDesc = (a: MarketPair, b: MarketPair) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0)

/** CEX/All tabs' natural (unsorted) row order: bybit's single highest-volume pair goes first,
 *  everything else (including bybit's other pairs, if any) sorted by volume behind it. `rows`
 *  is always pre-scoped to one category (spot/linear_perp/inverse_perp) by the caller, so a
 *  token's spot pairs never compete with its perp pairs for the top spot.
 *  Only applies while no column sort is active; clicking a header sorts all rows evenly.
 *  Exported for testing. */
export function rankRowsBybitFirst(rows: MarketPair[]): MarketPair[] {
	const topBybit = rows.filter((row) => row.exchange === 'bybit').sort(byVolumeDesc)[0]
	if (!topBybit) return [...rows].sort(byVolumeDesc)
	const rest = rows.filter((row) => row !== topBybit)
	return [topBybit, ...rest.sort(byVolumeDesc)]
}

function getCategoryRows(data: TokenMarketsResponse, venue: VenueTabId, category: Segment): MarketPair[] {
	if (venue === 'dex') return data.dex[category] ?? []
	if (venue === 'cex') return rankRowsBybitFirst(data.cex[category] ?? [])
	const dexRows = data.dex[category] ?? []
	const cexRows = data.cex[category] ?? []
	return rankRowsBybitFirst([...dexRows, ...cexRows])
}

function getCategoryTotals(data: TokenMarketsResponse, venue: VenueTabId, category: Segment): MarketCategoryTotals {
	if (venue === 'all') {
		const dex = data.totals.dex?.[category] ?? EMPTY_TOTALS
		const cex = data.totals.cex?.[category] ?? EMPTY_TOTALS
		return {
			pair_count: dex.pair_count + cex.pair_count,
			total_volume_24h: (dex.total_volume_24h ?? 0) + (cex.total_volume_24h ?? 0),
			total_oi_usd:
				dex.total_oi_usd == null && cex.total_oi_usd == null ? null : (dex.total_oi_usd ?? 0) + (cex.total_oi_usd ?? 0)
		}
	}
	return data.totals[venue as MarketVenue]?.[category] ?? EMPTY_TOTALS
}

function getAvailableCategories(data: TokenMarketsResponse, venue: VenueTabId): Segment[] {
	const categories: Segment[] = []
	for (const tab of CATEGORY_TABS) {
		if (getCategoryRows(data, venue, tab.id).length > 0) categories.push(tab.id)
	}
	return categories
}

function HeaderStrip({ rows, totals, showOi }: { rows: MarketPair[]; totals: MarketCategoryTotals; showOi: boolean }) {
	const metrics = sumPairMetrics(rows)

	return (
		<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
			<MetricStat label="Pairs" value={formattedNum(totals.pair_count)} />
			<MetricStat
				label="24h Volume"
				value={totals.total_volume_24h == null ? '–' : formattedNum(totals.total_volume_24h, true)}
				sub={<ChangeCell fraction={pctChange(metrics.volume, metrics.volumePrev)} />}
			/>
			{showOi ? (
				<MetricStat
					label="Open Interest"
					value={totals.total_oi_usd == null ? '–' : formattedNum(totals.total_oi_usd, true)}
					sub={<ChangeCell fraction={pctChange(metrics.oi, metrics.oiPrev)} />}
				/>
			) : null}
		</div>
	)
}

function Tabs<T extends string>({
	tabs,
	activeTab,
	onChange,
	ariaLabel
}: {
	tabs: ReadonlyArray<{ id: T; label: string }>
	activeTab: T
	onChange: (id: T) => void
	ariaLabel: string
}) {
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
	const focusTab = (index: number) => {
		const tab = tabs[index]
		if (!tab) return
		onChange(tab.id)
		buttonRefs.current[index]?.focus()
	}
	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		if (event.key === 'ArrowLeft') {
			event.preventDefault()
			focusTab((index - 1 + tabs.length) % tabs.length)
		} else if (event.key === 'ArrowRight') {
			event.preventDefault()
			focusTab((index + 1) % tabs.length)
		} else if (event.key === 'Home') {
			event.preventDefault()
			focusTab(0)
		} else if (event.key === 'End') {
			event.preventDefault()
			focusTab(tabs.length - 1)
		}
	}

	return (
		<div className="flex items-center overflow-x-auto" role="tablist" aria-label={ariaLabel}>
			{tabs.map((tab, index) => (
				<TabLink
					as="button"
					key={tab.id}
					ref={(node) => {
						buttonRefs.current[index] = node
					}}
					type="button"
					role="tab"
					aria-selected={activeTab === tab.id}
					tabIndex={activeTab === tab.id ? 0 : -1}
					data-active={activeTab === tab.id}
					onClick={() => onChange(tab.id)}
					onKeyDown={(event) => handleKeyDown(event, index)}
				>
					{tab.label}
				</TabLink>
			))}
		</div>
	)
}

interface TokenMarketsSectionProps {
	tokenSymbol: string
	/** 'section' (default) renders the full page card with an anchored heading. 'embedded' renders just the
	 *  tabs + table for use inside another surface (e.g. an expandable table row). */
	variant?: 'section' | 'embedded'
}

export function TokenMarketsSection({ tokenSymbol, variant = 'section' }: TokenMarketsSectionProps) {
	const embedded = variant === 'embedded'
	const [venueTab, setVenueTab] = useReducer((_: VenueTabId, next: VenueTabId) => next, 'all')
	const [categoryTab, setCategoryTab] = useReducer((_: Segment, next: Segment) => next, 'spot')

	const { data, error, isLoading } = useQuery({
		queryKey: ['token-markets', tokenSymbol],
		queryFn: () => fetchTokenMarkets(tokenSymbol),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: Boolean(tokenSymbol)
	})

	const availableCategoriesByVenue = useMemo(() => {
		if (!data) {
			return { dex: [], cex: [], all: [] } as Record<VenueTabId, Segment[]>
		}
		return {
			dex: getAvailableCategories(data, 'dex'),
			cex: getAvailableCategories(data, 'cex'),
			all: getAvailableCategories(data, 'all')
		} as Record<VenueTabId, Segment[]>
	}, [data])

	const visibleVenueTabs = useMemo(
		() => VENUE_TABS.filter((tab) => availableCategoriesByVenue[tab.id].length > 0),
		[availableCategoriesByVenue]
	)

	const selectedVenueTab = visibleVenueTabs.some((tab) => tab.id === venueTab)
		? venueTab
		: (visibleVenueTabs[0]?.id ?? venueTab)

	const visibleCategoryTabs = useMemo(() => {
		const available = new Set(availableCategoriesByVenue[selectedVenueTab])
		return CATEGORY_TABS.filter((tab) => available.has(tab.id))
	}, [availableCategoriesByVenue, selectedVenueTab])

	const selectedCategoryTab = useMemo<Segment>(() => {
		if (visibleCategoryTabs.some((tab) => tab.id === categoryTab)) return categoryTab
		return visibleCategoryTabs[0]?.id ?? categoryTab
	}, [visibleCategoryTabs, categoryTab])

	const rows = useMemo(
		() => (data ? getCategoryRows(data, selectedVenueTab, selectedCategoryTab) : []),
		[data, selectedVenueTab, selectedCategoryTab]
	)
	const totals = useMemo(
		() => (data ? getCategoryTotals(data, selectedVenueTab, selectedCategoryTab) : EMPTY_TOTALS),
		[data, selectedVenueTab, selectedCategoryTab]
	)

	const isPerpCategory = selectedCategoryTab !== 'spot'
	const columns = isPerpCategory ? PERP_COLUMNS : SPOT_COLUMNS

	const table = useReactTable({
		data: rows,
		columns,
		initialState: {
			sorting: DEFAULT_SORTING,
			pagination: { pageIndex: 0, pageSize: DEFAULT_TABLE_PAGE_SIZE }
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	// Reset sort + search whenever the user switches venue or category, matching the prior
	// remount-on-key behavior. Pagination auto-resets when the `data` reference changes via
	// TanStack's default autoResetPageIndex.
	// CEX and All start with no active sort — rows already come pre-ranked (bybit's top pair
	// first, then volume) from rankRowsBybitFirst — so no header shows a sort indicator until
	// the user picks a column. DEX keeps the plain volume-desc default sort.
	useEffect(() => {
		table.setSorting(selectedVenueTab === 'dex' ? DEFAULT_SORTING : [])
		table.resetColumnFilters()
	}, [selectedVenueTab, selectedCategoryTab, table])

	const lastUpdated = useMemo(() => {
		if (!data?.last_updated) return null
		const parsed = dayjs(data.last_updated)
		if (!parsed.isValid()) return null
		return { absolute: parsed.format('MMM D, YYYY HH:mm UTC'), relative: parsed.fromNow() }
	}, [data])

	const sectionHeader = (
		<PanelHeader className="justify-between">
			<PanelTitle as="h2" className="group relative flex scroll-mt-24 items-center gap-1" id={TOKEN_MARKETS_SECTION_ID}>
				Markets
				<a
					aria-hidden="true"
					tabIndex={-1}
					href={`#${TOKEN_MARKETS_SECTION_ID}`}
					className="absolute top-0 right-0 z-10 flex size-full items-center"
				/>
				<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
			</PanelTitle>
			{lastUpdated ? (
				<span className="label-sm text-secondary" title={lastUpdated.absolute}>
					Updated {lastUpdated.relative}
				</span>
			) : null}
		</PanelHeader>
	)

	if (isLoading) {
		const loader = (
			<div className="flex min-h-[200px] items-center justify-center p-3">
				<LocalLoader />
			</div>
		)
		if (embedded) return loader
		return (
			<Panel>
				{sectionHeader}
				{loader}
			</Panel>
		)
	}

	const isEmpty = Boolean(error) || !data || visibleVenueTabs.length === 0 || rows.length === 0
	if (isEmpty) {
		if (embedded) {
			return (
				<div className="flex min-h-[120px] items-center justify-center p-4 body-sm text-secondary">
					No market data available for this token.
				</div>
			)
		}
		return null
	}

	const content = (
		<>
			<Tabs
				tabs={visibleVenueTabs}
				activeTab={selectedVenueTab}
				onChange={(id) => setVenueTab(id)}
				ariaLabel="Market venue"
			/>

			<HeaderStrip rows={rows} totals={totals} showOi={isPerpCategory} />

			<TableToolbar>
				<div className="mr-auto flex items-center overflow-x-auto">
					<Tabs
						tabs={visibleCategoryTabs}
						activeTab={selectedCategoryTab}
						onChange={(id) => setCategoryTab(id)}
						ariaLabel="Market category"
					/>
				</div>
				<label className={searchFieldInlineWrapperStyles}>
					<span className="sr-only">Search exchanges</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						value={(table.getColumn('exchange')?.getFilterValue() as string | undefined) ?? ''}
						onChange={(event) => table.getColumn('exchange')?.setFilterValue(event.currentTarget.value || undefined)}
						placeholder="Search exchanges..."
						className={searchFieldInputStyles}
					/>
				</label>
				<CSVDownloadButton
					prepareCsv={() =>
						prepareTableCsv({
							instance: table,
							filename: `token-markets-${tokenSymbol}-${selectedVenueTab}-${selectedCategoryTab}`
						})
					}
					smol
					size="md"
				/>
			</TableToolbar>
			<PaginatedTable table={table} pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS} shell="none" />
		</>
	)

	if (embedded) {
		return <div className="flex flex-col gap-2 p-2">{content}</div>
	}

	return (
		<Panel>
			{sectionHeader}
			<div className="flex flex-col gap-2 p-2">{content}</div>
		</Panel>
	)
}
