import type { IRWAList } from '~/utils/metadata/types'
import { rwaSlug } from './rwaSlug'

export type RWAPlatformRoute = { name: string; slug: string }

export function getRWAPlatformRoutes(rwaList: IRWAList): RWAPlatformRoute[] {
	if (rwaList.platformRoutes) return rwaList.platformRoutes
	// Older generated metadata artifacts only contain display names.
	return rwaList.platforms.map((name) => ({ name, slug: rwaSlug(name) }))
}
