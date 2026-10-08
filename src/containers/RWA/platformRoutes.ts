import type { IRWAList, IRWAPerpsList } from '~/utils/metadata/types'
import type { RWAPlatformsIndex } from './PlatformPage/api.types'
import { findByRwaSlug, rwaSlug } from './rwaSlug'
import { getRwaPlatformHref } from './table/classificationHrefs'

export type RWAPlatformRoute = { name: string; slug: string }

export function getRWAPlatformRoutes(rwaList: IRWAList): Array<RWAPlatformRoute> {
	if (rwaList.platformRoutes) return rwaList.platformRoutes
	// Older generated metadata artifacts only contain display names.
	return rwaList.platforms.map((name) => ({ name, slug: rwaSlug(name) }))
}

/** The page a parent platform links to, or null when that platform has no page. */
export function getRWAPlatformHref(platform: string | null | undefined, rwaList: IRWAList): string | null {
	const slug = rwaSlug(platform ?? '')
	if (!slug) return null
	return getRWAPlatformRoutes(rwaList).some((route) => route.slug === slug) ? `/rwa/platform/${slug}` : null
}

type RWAPlatformPageOutcome =
	| { kind: 'page'; perpsVenueHref: string | null }
	| { kind: 'notFound' }
	| { kind: 'redirect'; destination: string }

/**
 * What /rwa/platform/:key serves. The platform page is spot only, so a platform with no spot rows and no indexed spot
 * AUM that runs a live perps venue goes to its venue page. Without a venue it 404s only when the index has a row that
 * confirms it is empty; a transient empty listing, or a platform the index does not know yet, keeps the page. A page
 * whose platform also runs a live venue links to it.
 */
export function getRwaPlatformPageOutcome({
	spotRows,
	meta,
	perpsVenue
}: {
	spotRows: number
	meta: { onchainAum: number; activeAum?: number | null } | null
	/** The venue's name when the platform runs a live perps venue. */
	perpsVenue: string | null
}): RWAPlatformPageOutcome {
	const venueHref = perpsVenue ? getRwaPlatformHref(perpsVenue, 'perps') : null
	const hasSpot = spotRows > 0 || (meta != null && (meta.onchainAum > 0 || (meta.activeAum ?? 0) > 0))
	if (hasSpot) return { kind: 'page', perpsVenueHref: venueHref }
	if (venueHref) return { kind: 'redirect', destination: venueHref }
	return meta ? { kind: 'notFound' } : { kind: 'page', perpsVenueHref: null }
}

/**
 * The platform routes that send their reader to the venue page, read from the index alone (the rule above with no
 * live rows): the sitemap and the platform nav row leave them out.
 */
export function getRwaPerpsOnlyPlatformSlugs({
	rwaList,
	rwaPlatformsIndex,
	rwaPerpsList
}: {
	rwaList: IRWAList
	rwaPlatformsIndex: RWAPlatformsIndex
	rwaPerpsList: Pick<IRWAPerpsList, 'venues'>
}): Set<string> {
	const slugs = new Set<string>()
	for (const { slug } of getRWAPlatformRoutes(rwaList)) {
		const outcome = getRwaPlatformPageOutcome({
			spotRows: 0,
			meta: rwaPlatformsIndex.platforms[slug] ?? null,
			perpsVenue: findByRwaSlug(slug, rwaPerpsList.venues)
		})
		if (outcome.kind === 'redirect') slugs.add(slug)
	}
	return slugs
}
