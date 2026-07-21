// Formatting helpers for the /yields/pool detail page.
import { formattedNum } from '~/utils'

// Splits the short-scale unit (k/m/b/t) out from the rounded value so the suffix can
// be styled separately. The value carries no symbol — callers prepend "$".
function fmtUsdShort(n: number | null | undefined): { value: string; suffix: string } | null {
	if (n == null) return null
	const formatted = formattedNum(n, false)
	const match = /^(-?[\d.,]+)([kmbt])$/.exec(formatted)
	if (match) return { value: match[1], suffix: match[2] }
	return { value: formatted, suffix: '' }
}

export function fmtUsd(n: number | null | undefined): string {
	const f = fmtUsdShort(n)
	return f ? `$${f.value}${f.suffix}` : '—'
}

// Loan-to-value ratio (0–1) as a percent, matching the borrow markets table.
export function fmtLtv(n: number | null | undefined): string {
	if (n == null) return '—'
	return `${formattedNum(n * 100)}%`
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
	if (n == null) return '—'
	const sign = n < 0 ? '-' : ''
	const abs = Math.abs(n)
	const tinyThreshold = 1 / 10 ** digits

	if (abs > 0 && abs < tinyThreshold) {
		return `${sign}<${tinyThreshold.toFixed(digits)}`
	}

	return n.toFixed(digits)
}

export function fmtCount(n: number | null | undefined): string {
	if (n == null) return '—'
	if (n >= 1e9) return (n / 1e9).toFixed(1) + 'b'
	if (n >= 1e6) return (n / 1e6).toFixed(1) + 'm'
	if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
	return n.toString()
}

export function scoreValue(s: number | null | undefined): string {
	if (s == null) return '—'
	return (s * 100).toFixed(1)
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
