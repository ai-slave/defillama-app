import { Hovercard } from '~/ui/Hovercard'
import { formatPercent } from '~/utils/numberFormat'

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
	low: 'border-data-up bg-data-up-tint text-data-up',
	medium: 'border-warning bg-warning-tint text-warning',
	high: 'border-data-down bg-surface text-data-down'
}

/** Compliance statuses (EU availability, MiCA license) share the badge with fees. */
export type ValueTone = FeeTone | 'positive' | 'caution' | 'negative'

const VALUE_TONE_CLASS: Record<ValueTone, string> = {
	...FEE_TONE_CLASS,
	positive: 'border-data-up bg-data-up-tint text-data-up',
	caution: 'border-warning bg-warning-tint text-warning',
	negative: 'border-data-down bg-data-down-tint text-data-down'
}

/** The badge box every Exchanges value cell shares, so a row of fees, statuses and requirement chips lines up. */
export function valueBadgeClass(tone: ValueTone | 'info' | null) {
	return `inline-flex items-center gap-1 rounded-md border px-2 py-0.5 label-sm whitespace-nowrap ${tone === 'info' ? 'border-subtle text-link' : tone ? VALUE_TONE_CLASS[tone] : 'border-subtle text-primary'}`
}

/** A value cell whose breakdown opens in a Hovercard: a fee or status badge takes its tone, any other value (routes,
 *  authored fiat fees, a fee with no tone) the neutral link look. Every Exchanges table cell with details uses it. */
export function ValueBadge({
	tone,
	ariaLabel,
	contentClassName,
	content,
	children
}: {
	/** A fee's or status's tone; `info` for route counts, which carry no fee; null when the fee is unknown. */
	tone: ValueTone | 'info' | null
	ariaLabel: string
	contentClassName: string
	content: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<Hovercard
			placement="left-start"
			render={<button type="button" aria-label={ariaLabel} className={`hover-wash ${valueBadgeClass(tone)}`} />}
			contentClassName={contentClassName}
			content={content}
		>
			{children}
		</Hovercard>
	)
}

const FEE_TONE_LABEL: Record<FeeTone, string> = {
	low: 'Low fee',
	medium: 'Medium fee',
	high: 'High fee'
}

export function feeLabel(fee: MakerTakerFee | null): string {
	if (!fee) return '–'
	const maker = formatPercent(fee.maker, { input: 'fraction' })
	const taker = formatPercent(fee.taker, { input: 'fraction' })
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
			className={valueBadgeClass(tone)}
			aria-label={tone ? `${label}. ${FEE_TONE_LABEL[tone]}; lower fees are better.` : label}
		>
			{label}
		</span>
	)
}
