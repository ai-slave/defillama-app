import type { IIcon } from '~/ui/Icon'
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
	return KIND_META[kind] ?? { label: titleCase(String(kind)), icon: 'alert-triangle' }
}

// Oracle type → the depeg story. `unknown` is a valid long-tail value, NOT an error.
interface OracleBadge {
	label: string
	tone: Tone
	story: string
}

const ORACLE_BADGE = {
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
} satisfies Record<OracleType, OracleBadge>

export function oracleBadge(type: OracleType): OracleBadge {
	return ORACLE_BADGE[type]
}

// Tone → Tailwind class bundle, using the app's semantic CSS-var tokens.
export interface ToneClasses {
	text: string
	chip: string // bg + text + border for a small badge/pill
	bar: string // solid fill for magnitude/utilization bars
}

const TONE_CLASSES: Record<Tone, ToneClasses> = {
	danger: {
		text: 'text-(--yield-negative-text)',
		chip: 'border border-error-muted bg-error-tint text-primary',
		bar: 'bg-error'
	},
	warning: {
		text: 'text-(--yield-warning-text)',
		chip: 'border border-warning-muted bg-warning-tint text-primary',
		bar: 'bg-warning'
	},
	good: {
		text: 'text-(--yield-positive-text)',
		chip: 'border border-success-muted bg-success-tint text-primary',
		bar: 'bg-success'
	},
	neutral: {
		text: 'text-primary',
		chip: 'bg-surface text-primary border border-medium',
		bar: 'bg-status-dot'
	},
	muted: {
		text: 'text-secondary',
		chip: 'bg-surface text-secondary border border-medium',
		bar: 'bg-status-dot-muted'
	}
}

export function toneClasses(tone: Tone): ToneClasses {
	return TONE_CLASSES[tone]
}

export function titleCase(s: string): string {
	return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
