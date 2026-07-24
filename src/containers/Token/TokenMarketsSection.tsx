import { useQuery } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { type KeyboardEvent, Suspense, useMemo, useReducer, useRef } from 'react'
import { mapExchangePair } from '~/containers/Exchanges/master.mappers'
import type { PairTableRow } from '~/containers/Exchanges/PairTable'
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
import { LoadingIndicator, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TabLink } from '~/ui/Tab'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { fetchTokenMarkets } from './api'
import { DeferredPairTable } from './deferred/DeferredPairTable'

const DEFAULT_SORTING: SortingState = [{ id: 'volume24h', desc: true }]
const NO_SORTING: SortingState = []

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

// The token is implied by the page, so omit the redundant exchange-profile token column.
const TOKEN_PAGE_OMITTED_COLUMNS = ['token'] as const

export const TOKEN_PAGE_COLUMN_ORDER = [
	'venue',
	'pair',
	'price',
	'priceChange24h',
	'depth2Usd',
	'openInterestUsd',
	'openInterestChange24h',
	'volume24h',
	'volumeChange24h',
	'normalizedVolume'
] as const

export const TOKEN_PAGE_VISIBLE_COLUMNS: Record<Segment, readonly string[]> = {
	spot: ['venue', 'pair', 'price', 'priceChange24h', 'depth2Usd', 'volume24h', 'volumeChange24h', 'normalizedVolume'],
	linear_perp: TOKEN_PAGE_COLUMN_ORDER,
	inverse_perp: [
		'venue',
		'pair',
		'price',
		'priceChange24h',
		'depth2Usd',
		'openInterestUsd',
		'openInterestChange24h',
		'volume24h',
		'volumeChange24h'
	]
}

export function toPairTableRow(row: MarketPair, depthBands: number[], segment: Segment): PairTableRow {
	return {
		...mapExchangePair(row, depthBands, segment),
		venue: row.display_name,
		venueSlug: row.slug,
		venueUrl: `/exchange/${row.slug}`
	}
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

const byVolumeDesc = (a: MarketPair, b: MarketPair) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0)

/** CEX/All tabs' natural (unsorted) row order: bybit's single highest-volume pair goes first,
 *  everything else (including bybit's other pairs, if any) sorted by volume behind it. `rows`
 *  is always pre-scoped to one category (spot/linear_perp/inverse_perp) by the caller, so a
 *  token's spot pairs never compete with its perp pairs for the top spot.
 *  Only applies while no column sort is active; clicking a header sorts all rows evenly.
 *  Exported for testing. */
export function rankRowsBybitFirst(rows: MarketPair[]): MarketPair[] {
	const topBybit = rows.filter((row) => row.slug === 'bybit').sort(byVolumeDesc)[0]
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
	geckoId: string
	tokenSymbol: string
	/** 'section' (default) renders the full page card with an anchored heading. 'embedded' renders just the
	 *  tabs + table for use inside another surface (e.g. an expandable table row). */
	variant?: 'section' | 'embedded'
}

export function TokenMarketsSection({ geckoId, tokenSymbol, variant = 'section' }: TokenMarketsSectionProps) {
	const embedded = variant === 'embedded'
	const [venueTab, setVenueTab] = useReducer((_: VenueTabId, next: VenueTabId) => next, 'all')
	const [categoryTab, setCategoryTab] = useReducer((_: Segment, next: Segment) => next, 'spot')

	const { data, error, isLoading } = useQuery({
		queryKey: ['token-markets', geckoId],
		queryFn: () => fetchTokenMarkets(geckoId),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: Boolean(geckoId)
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

	const selectedCategoryTab: Segment = visibleCategoryTabs.some((tab) => tab.id === categoryTab)
		? categoryTab
		: (visibleCategoryTabs[0]?.id ?? categoryTab)

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

	const isPerpCategory = selectedCategoryTab !== 'spot'

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
			{data?.last_updated ? (
				<RelativeTime className="label-sm text-secondary" value={data.last_updated} prefix="Updated" />
			) : null}
		</PanelHeader>
	)

	if (isLoading) {
		if (embedded) {
			return (
				<div className="flex min-h-[200px] items-center justify-center p-3">
					<LoadingIndicator />
				</div>
			)
		}
		return (
			<Panel padding="none" className="flex-1">
				{sectionHeader}
				<SurfaceBodyLoadingStatus label={`Loading ${tokenSymbol} markets`} className="p-2" />
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

			{/* Remount per venue/category tab so sorting and search reset, matching the prior behavior.
			    CEX and All start with no active sort — rows already come pre-ranked (bybit's top pair
			    first, then volume) from rankRowsBybitFirst — so no header shows a sort indicator until
			    the user picks a column. DEX keeps the plain volume-desc default sort. */}
			<Suspense fallback={<div className="min-h-[360px]" />}>
				<DeferredPairTable
					key={`${selectedVenueTab}-${selectedCategoryTab}`}
					pairs={tableRows}
					segment={selectedCategoryTab}
					capabilities={{ openInterest: isPerpCategory, funding: isPerpCategory, depth: true }}
					csvFileName={`token-markets-${tokenSymbol}-${selectedVenueTab}-${selectedCategoryTab}`}
					showVenue
					omitColumns={TOKEN_PAGE_OMITTED_COLUMNS}
					columnOrder={TOKEN_PAGE_COLUMN_ORDER}
					initialVisibleColumns={TOKEN_PAGE_VISIBLE_COLUMNS[selectedCategoryTab]}
					sorting={selectedVenueTab === 'dex' ? DEFAULT_SORTING : NO_SORTING}
					columnToSearch="venue"
					placeholder="Search exchanges..."
					header={null}
					embedded
					leadingControls={
						<Tabs
							tabs={visibleCategoryTabs}
							activeTab={selectedCategoryTab}
							onChange={(id) => setCategoryTab(id)}
							ariaLabel="Market category"
						/>
					}
				/>
			</Suspense>
		</>
	)

	if (embedded) {
		return <div className="flex flex-col gap-2 p-2">{content}</div>
	}

	return (
		<Panel padding="none">
			{sectionHeader}
			<div className="flex flex-col gap-2 p-2">{content}</div>
		</Panel>
	)
}
