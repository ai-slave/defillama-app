// A venue or category change resets the markets table through a key on DeferredTokenMarketsTable. The category
// filter sits outside that key, so it stays mounted and keeps focus.
import { useQuery } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { Suspense, useMemo, useReducer } from 'react'
import { fetchExchangeExecutionSlippage } from '~/containers/Exchanges/master.api'
import { mapExchangePair } from '~/containers/Exchanges/master.mappers'
import type { PairTableRow } from '~/containers/Exchanges/PairTable'
import { TokenDepthChart, type VenueSlippage } from '~/containers/Exchanges/TokenDepthChart'
import type {
	MarketCategoryTotals,
	MarketPair,
	MarketVenue,
	TokenMarketsResponse
} from '~/containers/Markets/api.types'
import { MaterialChangeCell, MetricStat, MetricStatStrip } from '~/containers/Markets/marketMetrics'
import type { Segment } from '~/containers/Markets/segments'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { RelativeTime } from '~/ui/RelativeTime'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { fetchTokenMarkets } from './api'
import { DeferredTokenMarketsTable } from './deferred/DeferredTokenMarketsTable'

const DEFAULT_SORTING: SortingState = [{ id: 'volume24h', desc: true }]
const NO_SORTING: SortingState = []

const TOKEN_MARKETS_SECTION_ID = 'token-markets'

type VenueTabId = 'all' | 'cex' | 'dex'

const VENUE_TABS: ReadonlyArray<{ value: VenueTabId; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'cex', label: 'CEX' },
	{ value: 'dex', label: 'DEX' }
]

const CATEGORY_TABS: ReadonlyArray<{ value: Segment; label: string }> = [
	{ value: 'spot', label: 'Spot' },
	{ value: 'linear_perp', label: 'USD Perp' },
	{ value: 'inverse_perp', label: 'COIN Perp' }
]

const EMPTY_TOTALS: MarketCategoryTotals = { pair_count: 0, total_volume_24h: 0, total_oi_usd: null }

// The token is implied by the page, so omit the redundant exchange-profile token column.
const TOKEN_PAGE_OMITTED_COLUMNS = ['token'] as const

// Depth first, then volume and its derivatives, then the perp-only metrics — the same
// reading order as the exchanges directory.
const TOKEN_PAGE_COLUMN_ORDER = [
	'venue',
	'pair',
	'price',
	'priceChange24h',
	'depth2Usd',
	'volume24h',
	'volumeChange24h',
	'normalizedVolume',
	'openInterestUsd',
	'openInterestChange24h',
	'fundingRate8h',
	'makerFee',
	'takerFee'
] as const

// OI and funding are perp-only; spot gets everything else.
const SPOT_HIDDEN_COLUMNS = new Set<string>(['openInterestUsd', 'openInterestChange24h', 'fundingRate8h'])

const TOKEN_PAGE_VISIBLE_COLUMNS: Record<Segment, ReadonlyArray<string>> = {
	spot: TOKEN_PAGE_COLUMN_ORDER.filter((id) => !SPOT_HIDDEN_COLUMNS.has(id)),
	linear_perp: TOKEN_PAGE_COLUMN_ORDER,
	// Normalized volume has no inverse-perp equivalent, so it would only render N/A.
	inverse_perp: TOKEN_PAGE_COLUMN_ORDER.filter((id) => id !== 'normalizedVolume')
}

export function toPairTableRow(row: MarketPair, depthBands: Array<number>, segment: Segment): PairTableRow {
	return {
		...mapExchangePair(row, depthBands, segment),
		venue: row.display_name,
		venueSlug: row.slug,
		venueUrl: `/exchange/${row.slug}`
	}
}

function sumPairMetrics(rows: Array<MarketPair>) {
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

const byVolumeDesc = (a: MarketPair, b: MarketPair) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0)

/** CEX/All tabs' natural (unsorted) row order: bybit's single highest-volume pair goes first,
 *  everything else (including bybit's other pairs, if any) sorted by volume behind it. `rows`
 *  is always pre-scoped to one category (spot/linear_perp/inverse_perp) by the caller, so a
 *  token's spot pairs never compete with its perp pairs for the top spot.
 *  Only applies while no column sort is active; clicking a header sorts all rows evenly.
 *  Exported for testing. */
export function rankRowsBybitFirst(rows: Array<MarketPair>): Array<MarketPair> {
	const topBybit = rows.filter((row) => row.slug === 'bybit').sort(byVolumeDesc)[0]
	if (!topBybit) return [...rows].sort(byVolumeDesc)
	const rest = rows.filter((row) => row !== topBybit)
	return [topBybit, ...rest.sort(byVolumeDesc)]
}

export function getCategoryRows(data: TokenMarketsResponse, venue: VenueTabId, category: Segment): Array<MarketPair> {
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

function getAvailableCategories(data: TokenMarketsResponse, venue: VenueTabId): Array<Segment> {
	const categories: Array<Segment> = []
	for (const tab of CATEGORY_TABS) {
		if (getCategoryRows(data, venue, tab.value).length > 0) categories.push(tab.value)
	}
	return categories
}

type AvailableCategoriesByVenue = Record<VenueTabId, Array<Segment>>

export function getAvailableCategoriesByVenue(data: TokenMarketsResponse | undefined): AvailableCategoriesByVenue {
	if (!data) return { dex: [], cex: [], all: [] }
	return {
		dex: getAvailableCategories(data, 'dex'),
		cex: getAvailableCategories(data, 'cex'),
		all: getAvailableCategories(data, 'all')
	}
}

/** The requested venue and category stay as preferences: while a refresh leaves one without rows,
 *  the first available tab shows instead, and the preference returns once it has rows again. */
export function resolveTokenMarketsSelection(
	availableCategoriesByVenue: AvailableCategoriesByVenue,
	venueTab: VenueTabId,
	categoryTab: Segment
) {
	const visibleVenueTabs = VENUE_TABS.filter((tab) => availableCategoriesByVenue[tab.value].length > 0)
	const selectedVenueTab = visibleVenueTabs.some((tab) => tab.value === venueTab)
		? venueTab
		: (visibleVenueTabs[0]?.value ?? venueTab)
	const available = new Set(availableCategoriesByVenue[selectedVenueTab])
	const visibleCategoryTabs = CATEGORY_TABS.filter((tab) => available.has(tab.value))
	const selectedCategoryTab: Segment = visibleCategoryTabs.some((tab) => tab.value === categoryTab)
		? categoryTab
		: (visibleCategoryTabs[0]?.value ?? categoryTab)
	return {
		visibleVenueTabs,
		selectedVenueTab,
		visibleCategoryTabs,
		selectedCategoryTab,
		// All/CEX keep their pre-ranked rows; DEX starts sorted by volume.
		sorting: selectedVenueTab === 'dex' ? DEFAULT_SORTING : NO_SORTING
	}
}

function HeaderStrip({
	rows,
	totals,
	showOi
}: {
	rows: Array<MarketPair>
	totals: MarketCategoryTotals
	showOi: boolean
}) {
	const metrics = sumPairMetrics(rows)

	return (
		<MetricStatStrip>
			<MetricStat
				label="Pairs"
				value={formatCompactNumber(totals.pair_count, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			/>
			<MetricStat
				label="24h Volume"
				value={
					totals.total_volume_24h == null
						? '–'
						: formatUsd(totals.total_volume_24h, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})
				}
				sub={<MaterialChangeCell current={metrics.volume} previous={metrics.volumePrev} />}
			/>
			{showOi ? (
				<MetricStat
					label="Open Interest"
					value={
						totals.total_oi_usd == null
							? '–'
							: formatUsd(totals.total_oi_usd, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})
					}
					sub={<MaterialChangeCell current={metrics.oi} previous={metrics.oiPrev} />}
				/>
			) : null}
		</MetricStatStrip>
	)
}

interface TokenMarketsSectionProps {
	geckoId: string
	tokenSymbol: string
	/** 'section' (default) renders the full page card with an anchored heading. 'embedded' renders just the
	 *  filters + table for use inside another surface (e.g. an expandable table row). */
	variant?: 'section' | 'embedded'
}

export function TokenMarketsSection({ geckoId, tokenSymbol, variant = 'section' }: TokenMarketsSectionProps) {
	const embedded = variant === 'embedded'
	const [venueTab, setVenueTab] = useReducer((_: VenueTabId, next: VenueTabId) => next, 'all')
	const [categoryTab, setCategoryTab] = useReducer((_: Segment, next: Segment) => next, 'spot')

	const marketsQuery = useQuery({
		queryKey: ['token-markets', geckoId],
		queryFn: () => fetchTokenMarkets(geckoId),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: Boolean(geckoId)
	})
	const { data } = marketsQuery

	// Measured fills decide which venues the order-book chart may show, so a failure
	// here means no chart rather than an unverified one. Fetched separately: it is a
	// small shared payload and the table does not need it.
	const { data: slippageFeed } = useQuery({
		queryKey: ['exchange-execution-slippage'],
		queryFn: fetchExchangeExecutionSlippage,
		staleTime: 6 * 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false
	})

	const availableCategoriesByVenue = useMemo(() => getAvailableCategoriesByVenue(data), [data])
	const { visibleVenueTabs, selectedVenueTab, visibleCategoryTabs, selectedCategoryTab, sorting } = useMemo(
		() => resolveTokenMarketsSelection(availableCategoriesByVenue, venueTab, categoryTab),
		[availableCategoriesByVenue, venueTab, categoryTab]
	)

	const rows = useMemo(
		() => (data ? getCategoryRows(data, selectedVenueTab, selectedCategoryTab) : []),
		[data, selectedVenueTab, selectedCategoryTab]
	)
	const totals = useMemo(
		() => (data ? getCategoryTotals(data, selectedVenueTab, selectedCategoryTab) : EMPTY_TOTALS),
		[data, selectedVenueTab, selectedCategoryTab]
	)
	// Rows arrive pre-ranked from getCategoryRows (bybit's top pair first on CEX/All via
	// rankRowsBybitFirst); the mapping below preserves that order 1:1.
	const tableRows = useMemo(
		() => (data ? rows.map((row) => toPairTableRow(row, data.depth_bands, selectedCategoryTab)) : []),
		[data, rows, selectedCategoryTab]
	)

	const perpDepthPairs = useMemo(() => {
		if (!data) return []
		const rowsForDepth = [...(data.cex.linear_perp ?? []), ...(data.dex.linear_perp ?? [])]
		return rowsForDepth.map((row) => toPairTableRow(row, data.depth_bands, 'linear_perp'))
	}, [data])

	// This token's measured slippage, keyed by venue slug. Only the execution basket
	// (BTC, ETH, SOL, HYPE, BNB today) has fills, so most tokens resolve to an empty
	// map and show no order-book chart at all.
	const tokenSlippage = useMemo<VenueSlippage>(() => {
		const asset = tokenSymbol.toUpperCase()
		const map: VenueSlippage = {}
		for (const [slug, byAsset] of Object.entries(slippageFeed?.venues ?? {})) {
			const measured = byAsset[asset]
			if (measured) map[slug] = measured
		}
		return map
	}, [slippageFeed, tokenSymbol])

	const isPerpCategory = selectedCategoryTab !== 'spot'

	const sectionHeader = (
		<PanelHeader>
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
			{data?.last_updated ? (
				<RelativeTime className="label-sm text-secondary" value={data.last_updated} prefix="Updated" />
			) : null}
		</PanelHeader>
	)

	if (queryReadFailed(marketsQuery)) {
		const status = (
			<InlineStatus variant="error" retry={marketsQuery}>
				Couldn't load {tokenSymbol} markets.
			</InlineStatus>
		)
		// Each keeps its loading state's height, so the error does not move the page.
		if (embedded) return <div className="flex min-h-[200px] items-center justify-center p-3">{status}</div>
		return (
			<Panel className="flex-1">
				{sectionHeader}
				<div className="flex min-h-[360px] flex-1 items-center justify-center p-2">{status}</div>
			</Panel>
		)
	}

	if (marketsQuery.isLoading) {
		if (embedded) {
			return <SurfaceBodyLoadingStatus label={`Loading ${tokenSymbol} markets`} className="min-h-[200px] p-3" />
		}
		return (
			<Panel className="flex-1">
				{sectionHeader}
				<SurfaceBodyLoadingStatus label={`Loading ${tokenSymbol} markets`} className="p-2" />
			</Panel>
		)
	}

	const isEmpty = !data || visibleVenueTabs.length === 0 || rows.length === 0
	if (isEmpty) {
		if (embedded) {
			return (
				<SurfaceBodyStatus variant="empty" className="min-h-[120px]">
					No market data available for this token.
				</SurfaceBodyStatus>
			)
		}
		return null
	}

	const content = (
		<>
			{/* Above the filters and independent of them: this is the venue comparison for the
			    token, not a picture of whichever rows the table is filtered to. */}
			<TokenDepthChart pairs={perpDepthPairs} slippage={tokenSlippage} symbol={tokenSymbol.toUpperCase()} />

			<SegmentedControl
				options={visibleVenueTabs}
				value={selectedVenueTab}
				onValueChange={setVenueTab}
				label="Market venue"
				variant="default"
				size="md"
			/>

			<HeaderStrip rows={rows} totals={totals} showOi={isPerpCategory} />
			<div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]">
				<div className="col-start-1 row-start-1 min-w-0 p-2 pb-0 sm:pb-2">
					<SegmentedControl
						options={visibleCategoryTabs}
						value={selectedCategoryTab}
						onValueChange={setCategoryTab}
						label="Market category"
						variant="default"
						size="md"
					/>
				</div>
				{/* Reset table state per venue/category without replacing the focused filter. */}
				<Suspense
					fallback={<SurfaceBodyLoadingStatus label={`Loading ${tokenSymbol} markets`} className="col-span-full" />}
				>
					<DeferredTokenMarketsTable
						key={`${selectedVenueTab}-${selectedCategoryTab}`}
						pairs={tableRows}
						segment={selectedCategoryTab}
						capabilities={{ openInterest: isPerpCategory, funding: isPerpCategory, depth: true }}
						csvFileName={`token-markets-${tokenSymbol}-${selectedVenueTab}-${selectedCategoryTab}`}
						showVenue
						omitColumns={TOKEN_PAGE_OMITTED_COLUMNS}
						columnOrder={TOKEN_PAGE_COLUMN_ORDER}
						initialVisibleColumns={TOKEN_PAGE_VISIBLE_COLUMNS[selectedCategoryTab]}
						sorting={sorting}
					/>
				</Suspense>
			</div>
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
