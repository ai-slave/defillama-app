import type { IIcon } from '~/components/Icon'
import type { OracleType, RiskKind } from './types'

// Small tone enum so the colour language stays consistent across the section.
export type Tone = 'danger' | 'warning' | 'neutral' | 'muted' | 'good'

interface KindMeta {
	label: string
	icon: IIcon['name']
	flipY?: boolean // mirror vertically (no trending-down in the sprite — a crash points down)
}

const KIND_META: Record<string, KindMeta> = {
	governance: { label: 'Governance', icon: 'landmark' },
	multisig: { label: 'Multisig', icon: 'key' },
	'oracle-hack': { label: 'Oracle hack', icon: 'alert-triangle' },
	'oracle-malfunction': { label: 'Oracle malfunction', icon: 'activity' },
	'smart-contract': { label: 'Smart-contract bug', icon: 'code' },
	bridge: { label: 'Bridge / wrapping', icon: 'link' },
	liquidity: { label: 'Liquidity', icon: 'banknote' },
	macro: { label: 'Market-wide', icon: 'trending-up', flipY: true }
}

export function kindMeta(kind: RiskKind): KindMeta {
	return KIND_META[kind] ?? { label: titleCase(String(kind)), icon: 'alert-warning' }
}

// Oracle type → the depeg story. `unknown` is a valid long-tail value, NOT an error.
interface OracleBadge {
	label: string
	tone: Tone
	story: string
}

const ORACLE_BADGE: Record<string, OracleBadge> = {
	market: {
		label: 'Market',
		tone: 'neutral',
		story: 'Priced off live market data — a depeg moves the price and can liquidate positions.'
	},
	aum: {
		label: 'AUM / rate',
		tone: 'warning',
		story: 'Priced off an exchange rate / AUM — insulated from spot depegs, but exposed to rate-provider corruption.'
	},
	hardcoded: {
		label: 'Hardcoded',
		tone: 'danger',
		story: "Price is fixed and won't move on a real depeg — divergence accrues as bad debt."
	},
	hybrid: {
		label: 'Hybrid',
		tone: 'warning',
		story: 'Mixes market and exchange-rate inputs — partial depeg insulation, partial market exposure.'
	},
	unknown: {
		label: 'Unclassified',
		tone: 'muted',
		story: 'Oracle design not classified (long-tail market).'
	}
}

export function oracleBadge(type: OracleType): OracleBadge {
	return ORACLE_BADGE[type] ?? ORACLE_BADGE.unknown
}

// Tone → Tailwind class bundle, using the app's semantic CSS-var tokens.
export interface ToneClasses {
	text: string
	chip: string // bg + text + border for a small badge/pill
	bar: string // solid fill for magnitude/utilization bars
}

const TONE_CLASSES: Record<Tone, ToneClasses> = {
	danger: {
		text: 'text-(--error)',
		chip: 'bg-red-500/10 text-(--error) border border-red-500/30',
		bar: 'bg-(--error)'
	},
	warning: {
		text: 'text-(--warning)',
		chip: 'bg-amber-500/10 text-(--warning) border border-amber-500/30',
		bar: 'bg-(--warning)'
	},
	good: {
		text: 'text-(--success)',
		chip: 'bg-emerald-500/10 text-(--success) border border-emerald-500/30',
		bar: 'bg-(--success)'
	},
	neutral: {
		text: 'text-(--legacy-text-primary)',
		chip: 'bg-(--legacy-bg-main) text-(--legacy-text-primary) border border-(--legacy-cards-border)',
		bar: 'bg-(--legacy-text-secondary)'
	},
	muted: {
		text: 'text-(--legacy-text-secondary)',
		chip: 'bg-(--legacy-bg-main) text-(--legacy-text-secondary) border border-(--legacy-cards-border)',
		bar: 'bg-(--legacy-text-tertiary)'
	}
}

export function toneClasses(tone: Tone): ToneClasses {
	return TONE_CLASSES[tone]
}

export function titleCase(s: string): string {
	return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
