import { toInternalSlug } from '~/utils/chainNormalizer'
import type { UnifiedRowHeaderType, UnifiedTableConfig } from './types'

export function getUnifiedTableQueryIdentity(config: UnifiedTableConfig, rowHeaders: UnifiedRowHeaderType[]) {
	const chains = new Set<string>()
	for (const chain of config.params?.chains ?? []) {
		const trimmed = chain.trim()
		if (!trimmed || trimmed.toLowerCase() === 'all') continue
		chains.add(toInternalSlug(trimmed))
	}

	const paramsKey = JSON.stringify({
		chains: Array.from(chains).sort(),
		category: config.params?.category?.trim() || null
	})
	const headersKey = rowHeaders.join('|')

	return {
		paramsKey,
		headersKey,
		queryKey: ['pro-dashboard', 'unified-table', paramsKey, headersKey] as const
	}
}
