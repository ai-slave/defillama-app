import { Hovercard } from '~/ui/Hovercard'
import { type Status, StatusBadge } from '~/ui/StatusBadge'
import { formatPercent } from '~/utils/numberFormat'

export interface MakerTakerFee {
	maker: number | null
	taker: number | null
}

export type FeeKind = 'spot' | 'perp'
type FeeTone = 'low' | 'medium' | 'high'

const SPOT_FEE_TIER_LIMITS = { low: 0.001, medium: 0.004 }
// ponytail: heuristic perp tiers (~10x tighter than spot); tune if fee data says otherwise
const PERP_FEE_TIER_LIMITS = { low: 0.0003, medium: 0.0006 }

const FEE_TONE: Record<FeeTone, { label: string; status: Status }> = {
	low: { label: 'Low fee', status: 'good' },
	medium: { label: 'Medium fee', status: 'caution' },
	high: { label: 'High fee', status: 'bad' }
}

/** A value cell whose breakdown opens in a Hovercard, drawn as a status badge: a fee or compliance state takes its
 *  status, any other value (route counts, a fee with no tier) neutral. Every Exchanges table cell with details uses it. */
export function ValueBadge({
	status,
	ariaLabel,
	contentClassName,
	content,
	children
}: {
	status: Status
	ariaLabel: string
	contentClassName: string
	content: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<Hovercard
			placement="left-start"
			render={<StatusBadge status={status} render={<button type="button" aria-label={ariaLabel} />} />}
			contentClassName={contentClassName}
			content={content}
		>
			{children}
		</Hovercard>
	)
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

/** Maker / taker fee cell with a low/medium/high status badge (spot and perp use their own tiers). */
export function FeeValue({ fee, kind }: { fee: MakerTakerFee | null | undefined; kind: FeeKind }) {
	if (!fee) return <span className="text-tertiary">–</span>
	const label = feeLabel(fee)
	if (label === '–') return <span className="text-tertiary">–</span>
	const tone = feeTone(fee, kind === 'spot' ? SPOT_FEE_TIER_LIMITS : PERP_FEE_TIER_LIMITS)
	return (
		<span aria-label={tone ? `${label}. ${FEE_TONE[tone].label}; lower fees are better.` : label}>
			<StatusBadge status={tone ? FEE_TONE[tone].status : 'neutral'}>{label}</StatusBadge>
		</span>
	)
}
