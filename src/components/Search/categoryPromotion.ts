// Query-time category promotion: when a user has typed most of a category name
// ("launchp"), the category page should appear above the many entities that
// merely contain the word ("DyorSwap Launchpad", "Fixes Launchpad", ...).
//
// This must live in the frontend merge: Meilisearch's static ranking can only
// boost categories globally, which regresses mid-word matches (a server-side
// rank boost made "algor" return the "Partially Algorithmic Stablecoin"
// category above the Algorand chain). Start-anchored prefix checks are only
// expressible at query time.

export interface CategoryPromotionHit {
	name: string
	route: string
	type?: string
	/** page-importance rank from the search index; navigation pages have r = 4 */
	r?: number
}

/** Minimum typed length before a category can be promoted. */
export const CATEGORY_PROMOTION_MIN_QUERY_LENGTH = 5
/** The query must cover at least this share of the category name. */
export const CATEGORY_PROMOTION_MIN_COVERAGE = 0.7

const NAV_PAGE_RANK = 4
// Fallback for hits indexed before `r` was added to displayedAttributes:
// these are exactly the types assigned the navigation-page rank.
const NAV_PAGE_TYPES = new Set(['Metric', 'Tool', 'Others'])

function normalize(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isNavPage(hit: CategoryPromotionHit): boolean {
	if (hit.r !== undefined) return hit.r === NAV_PAGE_RANK
	return hit.type !== undefined && NAV_PAGE_TYPES.has(hit.type)
}

/**
 * Returns the category hit to pin at the top of the results, or null.
 *
 * A category is promoted only when:
 * - the query is at least CATEGORY_PROMOTION_MIN_QUERY_LENGTH characters,
 * - it is a start-anchored, proper prefix of the category name covering at
 *   least CATEGORY_PROMOTION_MIN_COVERAGE of it (a complete category name
 *   already wins server-side via the `exactness` ranking rule),
 * - the current first result is not a navigation page ("bridg" keeps
 *   Bridges by Volume first) and is not itself an exact match of the query
 *   ("stab" keeps STAB Protocol first).
 */
export function findCategoryToPromote<T extends CategoryPromotionHit>(
	hits: Array<T>,
	categoryHits: Array<T>,
	query: string
): T | null {
	const normalizedQuery = normalize(query)
	if (normalizedQuery.length < CATEGORY_PROMOTION_MIN_QUERY_LENGTH) return null

	const first = hits[0]
	if (first) {
		// Protect a leading navigation page only when the user is plainly typing
		// its name ("bridg" -> Bridges by Volume). Nav pages that lead via
		// keyword matches ("lendi" -> Yields: Loop) shouldn't block a category
		// the user is spelling out.
		if (isNavPage(first) && normalize(first.name).startsWith(normalizedQuery)) return null
		if (normalize(first.name) === normalizedQuery) return null
	}

	for (const category of categoryHits) {
		if (category.type !== 'Category') continue
		const normalizedName = normalize(category.name)
		if (!normalizedName.startsWith(normalizedQuery)) continue
		if (normalizedName === normalizedQuery) continue
		if (normalizedQuery.length / normalizedName.length < CATEGORY_PROMOTION_MIN_COVERAGE) continue
		return category
	}

	return null
}

/**
 * Moves the promoted category to the front of the page, keeping the page
 * length unchanged so infinite-scroll pagination still detects the last page.
 */
export function mergePromotedCategory<T extends CategoryPromotionHit>(hits: Array<T>, promoted: T | null): Array<T> {
	if (!promoted) return hits
	if (hits[0]?.route === promoted.route) return hits
	const rest = hits.filter((hit) => hit.route !== promoted.route)
	const merged = [promoted, ...rest]
	return merged.length > hits.length ? merged.slice(0, hits.length) : merged
}
