import { fetchChainsByCategory } from '~/containers/Chains/api'
import { mapWithConcurrency } from '~/utils/async'
import { toDimensionsSlug, toDisplayName } from '~/utils/chainNormalizer'

export const displayChainName = (slug: string): string => {
	// Adapter metric breakdowns use Dimensions slugs while chart labels use display names.
	const display = toDisplayName(slug)
	if (display !== slug) return display
	const normalized = slug.toLowerCase().replace(/_/g, '-')
	return normalized
		.split('-')
		.map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
		.join(' ')
}

export async function resolveAllowedChainNamesFromCategories(categories: Array<string>): Promise<Set<string>> {
	if (categories.length === 0) return new Set()
	const responses = await mapWithConcurrency(categories, 8, fetchChainsByCategory)
	const names = new Set<string>()
	for (const response of responses) {
		for (const chain of response.chainsUnique) names.add(chain)
	}
	return names
}

export async function resolveAllowedChainSlugsFromCategories(categories: Array<string>): Promise<Set<string>> {
	const names = await resolveAllowedChainNamesFromCategories(categories)
	const slugs = new Set<string>()
	for (const name of names) {
		slugs.add(toDimensionsSlug(name))
	}
	return slugs
}
