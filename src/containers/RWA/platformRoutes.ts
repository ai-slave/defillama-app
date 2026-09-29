import type { IRWAList } from '~/utils/metadata/types'
import { rwaSlug } from './rwaSlug'

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
