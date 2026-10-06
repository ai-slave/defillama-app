// Which rows the earn APY cell's hovercard shows. Out of the cell because the rules are
// conditional enough to be worth testing on their own.

import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { hasPart } from '../domain/apyPresentation'
import { YIELD_PERCENT_OPTIONS } from '../poolDetail/format'
import type { MeasuredRow } from './Measured'

// pp, not %, so it can't be read as a rate. One decimal: the comparison is a bearing, not a
// measurement. exceptZero signs after rounding, so a sub-0.05 delta prints "0.0 pp".
export function signedPp(value: number): string {
	return `${formatNumber(value, {
		signDisplay: 'exceptZero',
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
		useGrouping: false
	})} pp`
}

export interface ApyCardRowsInput {
	/** The headline figure, already resolved for this reader (measured, or reported when locked). */
	total: number
	base: number | null
	reward: number | null
	intrinsic: number | null
	/** Reward token symbols, joined into the Reward row's qualifier. */
	symbols: Array<string>
	intrinsicSourceSymbol: string | null
	/** The measured base standing in the headline; null when unmeasured or locked. */
	measured: number | null
	/** Fresh measured base deliberately kept out of an unsplit, reward-bearing headline. */
	unsubstitutedMeasured?: number | null
	/** The window's last reading when it was too old to be the headline — shown as history. */
	lastVerified?: number | null
	/** The source pool's measured base standing as the intrinsic leg. */
	measuredIntrinsic?: number | null
	/** Measured, but this reader has no subscription: the offer replaces the measurement. */
	locked: boolean
	median: { label: string; apy: number } | undefined
}

export const pct = (value: number) => formatPercent(value, YIELD_PERCENT_OPTIONS)

export function buildApyCardRows(input: ApyCardRowsInput): Array<MeasuredRow> {
	const { total, base, reward, intrinsic, measured, locked, median } = input
	const unsubstitutedMeasured = input.unsubstitutedMeasured ?? null
	const lastVerified = measured == null ? (input.lastVerified ?? null) : null
	const hasComposition = hasPart(reward) || hasPart(intrinsic)
	const rows: Array<MeasuredRow> = []
	if (unsubstitutedMeasured != null) {
		rows.push({ label: 'Base', provenance: 'verified', value: pct(unsubstitutedMeasured) })
	}

	// A bare Base row only repeats the headline; it needs a composition, the verified name,
	// or the offer's redacted row to sit over. Locked, the base is named "reported" so it reads
	// against the offer's "Base · verified" beneath it.
	if (base != null && (hasComposition || measured != null || locked || lastVerified != null)) {
		rows.push({
			label: 'Base',
			provenance: measured != null ? 'verified' : locked || lastVerified != null ? 'reported' : null,
			value: pct(base)
		})
	}
	// A stale reading is history under the reported base, a tier down and named as old.
	if (lastVerified != null) {
		rows.push({ label: 'Base', provenance: 'last verified', value: pct(lastVerified), muted: true })
	}
	// Wherever one row states its provenance, every row does: rewards are never simulated, and an
	// intrinsic leg is only verified when its source pool is.
	const provenance =
		measured != null ||
		locked ||
		lastVerified != null ||
		unsubstitutedMeasured != null ||
		input.measuredIntrinsic != null
	if (hasPart(reward)) {
		rows.push({
			label: 'Reward',
			qualifier: input.symbols.join(', ') || null,
			provenance: provenance ? 'reported' : null,
			value: pct(reward)
		})
	}
	if (hasPart(intrinsic)) {
		const measuredIntrinsic = input.measuredIntrinsic ?? null
		rows.push({
			label: 'Intrinsic',
			qualifier: input.intrinsicSourceSymbol,
			provenance: provenance ? (measuredIntrinsic != null ? 'verified' : 'reported') : null,
			value: pct(intrinsic)
		})
	}
	// A Total over a single leg would only repeat the headline, so it waits for a second one.
	if (hasComposition) rows.push({ label: 'Total', value: pct(total), ruled: true, strong: true })
	if (median != null) {
		// When comparison is the only extra fact, keep the headline value in the card as its anchor.
		if (rows.length === 0) rows.push({ label: 'Total', value: pct(total), strong: true })
		rows.push({ label: `vs ${median.label} median`, value: signedPp(total - median.apy) })
	}

	return rows
}
