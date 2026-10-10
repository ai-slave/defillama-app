// Shared display policies for the /yields/pool detail page. Callers use the
// canonical formatters directly so the unit and input semantics stay visible.
import type { Status } from '~/ui/StatusBadge'
import { formatNumber } from '~/utils/numberFormat'

export const YIELD_PERCENT_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: false,
	smallValueDisplay: 'threshold'
} as const

// A steady supply APY is good for the depositor; a volatile one is the risk.
const STABILITY_STATUS: Record<string, Status> = {
	stable: 'good',
	mixed: 'neutral',
	volatile: 'bad'
}

/** The 30d stability rating as a badge status; a rating outside stable, mixed and volatile reads as neutral. */
export function stabilityStatus(rating: string): Status {
	return STABILITY_STATUS[rating] ?? 'neutral'
}

export function scoreValue(s: number | null | undefined): string {
	if (s == null) return '—'
	return formatNumber(s * 100, { maximumFractionDigits: 1 })
}

export function protocolInitial(name: string | undefined | null): string {
	if (!name) return '?'
	return name.charAt(0).toUpperCase()
}

export type CategoryLike = string | { slug?: string | null; name?: string | null } | null | undefined

// Optional acronym map is keyed by lowercased part to force casing like "btc" → "BTC".
export function humanizeSlug(value: string, acronyms?: Map<string, string>): string {
	return value
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => {
			const lower = part.toLowerCase()
			return acronyms?.get(lower) || lower.charAt(0).toUpperCase() + lower.slice(1)
		})
		.join(' ')
}

const CATEGORY_ACRONYMS = new Map([
	['cdp', 'CDP'],
	['cex', 'CEX'],
	['dex', 'DEX'],
	['dexs', 'DEXs'],
	['nft', 'NFT'],
	['rwa', 'RWA']
])

function humanizeCategorySlug(value: string): string {
	const trimmed = value.trim()
	if (!trimmed) return ''
	// A bare single-token slug keeps its original form (only acronyms are upcased).
	if (!/[-_]/.test(trimmed)) return CATEGORY_ACRONYMS.get(trimmed.toLowerCase()) || trimmed
	return humanizeSlug(trimmed, CATEGORY_ACRONYMS)
}

export function categoryLabel(category: CategoryLike): string {
	if (!category) return ''
	if (typeof category === 'string') return humanizeCategorySlug(category)
	return category.name || humanizeCategorySlug(category.slug || '')
}
