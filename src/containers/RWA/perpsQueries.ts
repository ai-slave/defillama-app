/* The loader of the Perps tree pages: /rwa/perps, one asset group, one underlying. The Assets loader is queries.tsx;
   the pieces both share (the venue split cards, the platform logos) live there. */
import type { RWAOverviewDisplayRow, RWAOverviewFrame } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { foldRwaSeriesTotal } from './cards/cardData'
import { RWA_CARD_VOLUME_DAYS, RWA_CARD_VOLUME_WINDOW, type RwaPerpsCards } from './cards/perpsCardData'
import { getDefaultRWAOverviewInclusion } from './constants'
import { getRwaPageLayout } from './layout/pageLayout'
import { getRwaPerpsPageNav } from './layout/pageNav'
import { fetchRWAPerpsCurrent, fetchRWAPerpsOverviewBreakdownChartData } from './Perps/api'
import { toRWAPerpsBreakdownChartDataset } from './Perps/breakdownDataset'
import { buildRWAPerpsContractOverlayRows } from './perpsOverlay'
import { packRwaPerpsMarkets, type RWAPackedPerpsMarkets } from './perpsPayload'
import type { RWAPlatformsIndex } from './PlatformPage/api.types'
import { collectRwaPlatformLogos, fetchRwaPerpsVenueSplitCards } from './queries'
import { rwaSlug } from './rwaSlug'

/** What a Perps tree page covers: every market, one asset group or one underlying. */
type RWAPerpsPageScope = { kind: 'all' } | { kind: 'assetGroup'; assetGroup: string } | { kind: 'asset'; asset: string }

const PERPS_PAGE_KIND = { all: 'perpsOverview', assetGroup: 'perpsAssetGroup', asset: 'perpsAsset' } as const

/** The overview frame without its rows or any spot-only field; the markets travel packed beside it. */
type RWAPerpsOverviewFrame = Omit<RWAOverviewFrame, 'assets'>

export type RWAPerpsPageProps = {
	overview: RWAPerpsOverviewFrame
	/** Column-packed and rounded (perpsPayload.ts). */
	markets: RWAPackedPerpsMarkets
	/** The Perps overview's cards; null on the scoped pages. */
	cards: RwaPerpsCards | null
}

function matchesRwaPerpsScope(row: RWAOverviewDisplayRow, scope: RWAPerpsPageScope): boolean {
	switch (scope.kind) {
		case 'all':
			return true
		case 'assetGroup':
			return rwaSlug(normalizeRwaAssetGroup(row.assetGroup)) === rwaSlug(scope.assetGroup)
		case 'asset':
			return rwaSlug(row.assetName) === rwaSlug(scope.asset)
	}
}

/** The cards' build-time part: the venue split behind Change by Venue and the daily volume behind the Volume card. */
async function fetchRwaPerpsCards(): Promise<RwaPerpsCards> {
	const [venueChange, withCex, dexOnly] = await Promise.all([
		fetchRwaPerpsVenueSplitCards(),
		fetchRwaPerpsDailyVolume(true),
		fetchRwaPerpsDailyVolume(false)
	])
	return { venueChange, volume: { withCex, dexOnly } }
}

/** Every market's volume per day, summed, for the Volume card's 7 day average over its 90 days. */
async function fetchRwaPerpsDailyVolume(includeCex: boolean): Promise<Array<[number, number]>> {
	const split = await fetchRWAPerpsOverviewBreakdownChartData({
		breakdown: 'venue',
		key: 'volume24h',
		target: { kind: 'all' },
		includeCex
	})
	return foldRwaSeriesTotal(toRWAPerpsBreakdownChartDataset(split).source).slice(
		-(RWA_CARD_VOLUME_DAYS + RWA_CARD_VOLUME_WINDOW - 1)
	)
}

/**
 * The props of a Perps tree page: only its markets, packed, and the frame the overview container reads. No spot
 * rows, no spot chart datasets: the perps chart is fetched by the browser from the public split routes. Null when
 * the scope has no market.
 */
export async function getRWAPerpsPageProps({
	scope,
	perpsAssetGroups,
	rwaPlatformsIndex
}: {
	scope: RWAPerpsPageScope
	/** The asset groups of the perps metadata, for the nav row. */
	perpsAssetGroups: Array<string>
	rwaPlatformsIndex?: RWAPlatformsIndex
}): Promise<RWAPerpsPageProps | null> {
	const [markets, cards] = await Promise.all([
		fetchRWAPerpsCurrent(),
		// Change by Venue while no filter is set; the other two Perps cards fold the page's markets.
		scope.kind === 'all' ? fetchRwaPerpsCards() : Promise.resolve(null)
	])
	const rows = buildRWAPerpsContractOverlayRows({ markets })
		.filter((row) => matchesRwaPerpsScope(row, scope))
		.sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))
	if (rows.length === 0) return null

	const assetGroupName = scope.kind === 'assetGroup' ? normalizeRwaAssetGroup(rows[0].assetGroup) : null
	const nav = getRwaPerpsPageNav(
		perpsAssetGroups,
		scope.kind === 'all' ? null : normalizeRwaAssetGroup(rows[0].assetGroup)
	)

	return {
		overview: {
			nav,
			selectedAssetGroup: assetGroupName ?? 'All',
			defaultInclusion: getDefaultRWAOverviewInclusion({ mode: getRwaPageLayout(PERPS_PAGE_KIND[scope.kind]).mode }),
			platformLogos: collectRwaPlatformLogos(rows, rwaPlatformsIndex),
			assetGroupSlug: assetGroupName ? rwaSlug(assetGroupName) : null
		},
		markets: packRwaPerpsMarkets(rows),
		cards
	}
}
