import type { RWAOverviewMode } from './constants'

/** A token that wraps another tracked asset and would count it twice. */
export const RWA_WRAPPER_TYPE = 'Wrapper'

/** Categories made of wrappers; hiding them there would empty the page. */
const WRAPPER_DEFAULT_CATEGORY_SLUGS = new Set(['other-rwas', 'rwa-wrappers', 'rwa-yield-wrapper'])

/** Off unless the page is about wrappers. */
export function areWrappersIncludedByDefault(mode: RWAOverviewMode, categorySlug?: string | null): boolean {
	if (mode === 'platform' || mode === 'assetGroup') return true
	return mode === 'category' && !!categorySlug && WRAPPER_DEFAULT_CATEGORY_SLUGS.has(categorySlug)
}
