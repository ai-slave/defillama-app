import type { IRWAList, IRWAPerpsList } from '~/utils/metadata/types'
import type { RWAPageNav, RWAPerpsContractOverlayRow } from '../api.types'
import { getRwaVenuePageNav } from '../layout/pageNav'
import { fetchRWAPerpsCurrent, fetchRWAPerpsMarketsByVenue } from '../Perps/api'
import { getRealRwaPlatforms, toRWAPerpsContractOverlayRow } from '../perpsOverlay'
import { packRwaPerpsMarkets, type RWAPackedPerpsMarkets } from '../perpsPayload'
import type { RWAPlatformMeta, RWAPlatformsIndex } from '../PlatformPage/api.types'
import { getRWAPlatformRoutes } from '../platformRoutes'
import { rwaSlug } from '../rwaSlug'
import {
	getRwaVenueSpotHref,
	getRwaVenueType,
	type RwaPerpsVenueType,
	sumRwaPerpsOpenInterestByVenueType
} from './venueData'

export type RWAVenuePageProps = {
	venue: string
	venueSlug: string
	/** The venue's row in the platforms index; null for a venue the index does not list yet. */
	meta: RWAPlatformMeta | null
	/** The platform page of the same entity, when it holds spot assets; the About links row carries it. */
	spotHref: string | null
	/** Column-packed like the Perps overview's (perpsPayload.ts); the page unpacks them. */
	markets: RWAPackedPerpsMarkets
	/** DEX or CEX, the tag by the venue's name. */
	venueType: RwaPerpsVenueType | null
	/** All open interest of the venue's type, every venue counted; the card's Share of DEX (or CEX) OI reads it. */
	typeOpenInterest: number | null
	nav: RWAPageNav
}

/** The index entry for the venue, else the one parent platform all its markets name. */
function findVenueMeta(
	venueSlug: string,
	markets: Array<RWAPerpsContractOverlayRow>,
	index: RWAPlatformsIndex
): RWAPlatformMeta | undefined {
	const own = index.platforms[venueSlug]
	if (own) return own
	const parents = new Set(markets.flatMap((market) => getRealRwaPlatforms(market.parentPlatform).map(rwaSlug)))
	const [parent] = parents
	return parents.size === 1 && parent ? index.platforms[parent] : undefined
}

/**
 * The venue page's data: its markets as packed perps rows, its profile from the platforms index and the venue nav
 * row. Null when the venue lists no market; a failed request, the venue's markets or every market, throws, so the
 * last good page stays.
 */
export async function getRWAVenuePageProps({
	venue,
	rwaPerpsList,
	rwaPlatformsIndex,
	rwaList
}: {
	venue: string
	rwaPerpsList: IRWAPerpsList
	rwaPlatformsIndex: RWAPlatformsIndex
	rwaList: IRWAList
}): Promise<RWAVenuePageProps | null> {
	const [response, allMarkets] = await Promise.all([fetchRWAPerpsMarketsByVenue(venue), fetchRWAPerpsCurrent()])
	if (response.length === 0) return null
	const markets = response
		.map((market) => toRWAPerpsContractOverlayRow(market))
		.sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))
	const venueSlug = rwaSlug(venue)
	const meta = findVenueMeta(venueSlug, markets, rwaPlatformsIndex) ?? null
	const venueType = getRwaVenueType(markets)
	const typeOpenInterest = venueType
		? sumRwaPerpsOpenInterestByVenueType(allMarkets.map((market) => toRWAPerpsContractOverlayRow(market)))[venueType]
		: null
	const hasPlatformRoute = meta != null && getRWAPlatformRoutes(rwaList).some((route) => route.slug === meta.slug)
	return {
		venue,
		venueSlug,
		meta,
		spotHref: hasPlatformRoute ? getRwaVenueSpotHref(meta) : null,
		markets: packRwaPerpsMarkets(markets),
		venueType,
		typeOpenInterest,
		nav: getRwaVenuePageNav(rwaPerpsList.venues, venue)
	}
}
