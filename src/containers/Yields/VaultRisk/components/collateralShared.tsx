import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent } from '~/utils/numberFormat'

// Backend placeholders where no third-party feed is proven ('unverified', 'none', '') —
// these add no signal and must never render as a vendor name.
const ORACLE_GAP_VENDORS = new Set(['', 'none', 'unverified'])
export const isProvenVendor = (p: string | null | undefined): p is string =>
	!!p && !ORACLE_GAP_VENDORS.has(p.toLowerCase())

// Stress is per asset, always. Each collateral starts at this drop and any row can dial its
// own — there is no vault-wide mode to switch into, because "what if THIS asset breaks" is the
// question worth asking and a uniform crash is just every asset sharing one value.
export const DEFAULT_STRESS_DROP = 30

export const SLIDER_THUMB =
	'[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-none [&::-webkit-slider-thumb]:bg-brand ' +
	'[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-brand'

export function dropLabel(drop: number): string {
	return drop === 0 ? '0%' : `−${formatPercent(drop, { input: 'percent' })}`
}

// A vault-share percentage that stays honest in aggregate: 99.7% never rounds up to "100%",
// and sub-1% shows a real value so a column of shares reads as summing to ~100.
export function vaultSharePct(fraction: number): string {
	const pct = fraction * 100
	if (pct <= 0) return '0%'
	if (pct < 0.05) return '<0.1%'
	if (pct < 1)
		return `${formatPercent(pct, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
	if (pct >= 99.95) return '100%'
	if (pct >= 99)
		return `${formatPercent(pct, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
	return formatPercent(pct, { input: 'percent', maximumFractionDigits: 0 })
}

// Pendle PT pricing model → label + depositor-facing consequence. Neutral classification,
// not a severity; unknown values fall back to a title-cased raw value.
const PT_PRICING_META: Record<string, { label: string; note: string }> = {
	linear_discount: {
		label: 'Linear discount',
		note: 'Priced on a fixed linear rate to maturity, not the live secondary market — so it carries no PT market-deviation exposure.'
	},
	market_rate: {
		label: 'Market rate',
		note: "Priced off the PT's live secondary-market rate — exposed to PT market deviation on top of the underlying asset."
	},
	managed: {
		label: 'Managed',
		note: 'Priced by an operator-managed oracle with deviation/timelock bounds, not a raw market feed.'
	},
	custom: {
		label: 'Custom',
		note: 'Priced by a custom oracle path — see the mechanism above for specifics.'
	}
}

function ptPricingMeta(pt: string): { label: string; note?: string } {
	return PT_PRICING_META[pt] ?? { label: pt.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()) }
}

export function PtPricingChip({ pricing }: { pricing: string }) {
	const { label, note } = ptPricingMeta(pricing)
	const chip = (
		<Tag className="shrink-0">
			<span className="text-tertiary">PT</span>
			{label}
		</Tag>
	)
	return note ? (
		<Tooltip content={note} className="shrink-0">
			{chip}
		</Tooltip>
	) : (
		chip
	)
}
