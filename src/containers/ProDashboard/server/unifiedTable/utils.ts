import type { UnifiedTableConfig } from '~/containers/ProDashboard/unifiedTable/config/current'
import { toInternalSlug } from '~/utils/chainNormalizer'

export const toPercent = (value: number | null | undefined): number | null => {
	if (value == null) return null
	return value * 100
}

export const derivePreviousValue = (current: number | null | undefined, change: number | null | undefined) => {
	if (current == null) return null
	if (change == null) return null
	const denominator = 1 + change
	if (!Number.isFinite(denominator) || denominator === 0) return null
	return current / denominator
}

export const computeShare = (part: number | null | undefined, total: number | null | undefined): number | null => {
	if (part == null) return null
	if (total == null || total <= 0) return null
	return (part / total) * 100
}

const normalizeChainList = (chains: Array<string>): Array<string> => {
	const normalized = new Set<string>()
	for (const chain of chains) {
		const trimmed = chain.trim()
		if (trimmed && trimmed.toLowerCase() !== 'all') normalized.add(toInternalSlug(trimmed))
	}
	return Array.from(normalized)
}

export const extractChainFilters = (config: UnifiedTableConfig): Array<string> =>
	normalizeChainList(config.params?.chains ?? [])

export const formatDisplayName = (value?: string | null) => {
	if (!value) return ''

	return value
		.split(/[\s-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}
