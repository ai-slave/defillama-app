import { normalizeCacheList } from '~/server/api/cacheKey'
import { toDisplayName } from '~/utils/chainNormalizer'

export function normalizeLegacyChartBuilderChains(rawChains: readonly string[]): string[] {
	const chains = normalizeCacheList(rawChains)
	if (chains.some((chain) => chain.toLowerCase() === 'all')) return []

	// Saved dashboards can still contain historical Dimensions chain aliases.
	return normalizeCacheList(chains.map(toDisplayName))
}
