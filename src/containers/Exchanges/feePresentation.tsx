export interface MakerTakerFee {
	maker: number | null
	taker: number | null
}

export type FeeKind = 'spot' | 'perp'
export type FeeTone = 'low' | 'medium' | 'high'

const SPOT_FEE_TIER_LIMITS = { low: 0.001, medium: 0.004 }
// ponytail: heuristic perp tiers (~10x tighter than spot); tune if fee data says otherwise
const PERP_FEE_TIER_LIMITS = { low: 0.0003, medium: 0.0006 }

export const FEE_TONE_CLASS: Record<FeeTone, string> = {
	low: 'border-data-up bg-data-up/10 text-data-up',
	medium: 'border-warning bg-warning/10 text-warning',
	high: 'border-data-down bg-surface text-data-down'
}

const FEE_TONE_LABEL: Record<FeeTone, string> = {
	low: 'Low fee',
	medium: 'Medium fee',
	high: 'High fee'
}

export function formatFee(fee: number | null): string | null {
	// Fees carry up to 2 significant decimals as a percent (0.0015 → "0.15%"); don't over-round.
	return fee == null ? null : `${(fee * 100).toLocaleString(undefined, { maximumFractionDigits: 3 })}%`
}

export function feeLabel(fee: MakerTakerFee | null): string {
	if (!fee) return '–'
	const maker = formatFee(fee.maker)
	const taker = formatFee(fee.taker)
	return maker && taker ? `${maker} / ${taker}` : (maker ?? taker ?? '–')
}

function feeTone(fee: MakerTakerFee, limits: { low: number; medium: number }): FeeTone | null {
	const value = fee.taker ?? fee.maker
	if (value == null) return null
	if (value <= limits.low) return 'low'
	if (value <= limits.medium) return 'medium'
	return 'high'
}

/** Maker / taker fee cell with a low/medium/high tone badge (spot and perp use their own tiers). */
export function FeeValue({ fee, kind }: { fee: MakerTakerFee | null | undefined; kind: FeeKind }) {
	if (!fee) return <span className="text-tertiary">–</span>
	const label = feeLabel(fee)
	if (label === '–') return <span className="text-tertiary">–</span>
	const tone = feeTone(fee, kind === 'spot' ? SPOT_FEE_TIER_LIMITS : PERP_FEE_TIER_LIMITS)
	return (
		<span
			className={`inline-flex rounded-md border px-2 py-0.5 label-sm whitespace-nowrap ${tone ? FEE_TONE_CLASS[tone] : 'border-subtle text-primary'}`}
			aria-label={tone ? `${label}. ${FEE_TONE_LABEL[tone]}; lower fees are better.` : label}
		>
			{label}
		</span>
	)
}
