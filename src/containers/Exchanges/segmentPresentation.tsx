import { QuestionHelper } from '~/ui/QuestionHelper'
import { exchangeDefinitions, type ExchangeDefinition } from './definitions'
import { EXCHANGE_SEGMENT_LABELS, type ExchangeSegment } from './models'

export const SEGMENT_DEFINITIONS: Record<ExchangeSegment, ExchangeDefinition> = {
	spot: exchangeDefinitions.segments.spot,
	linear_perp: exchangeDefinitions.segments.linearPerps,
	inverse_perp: exchangeDefinitions.segments.inversePerps
}

/**
 * Exact segment toggle label — Spot | Linear Perps | Inverse Perps — with a (?)
 * definition tooltip on the perpetual classes.
 */
export function SegmentToggleLabel({ segment, suffix }: { segment: ExchangeSegment; suffix?: string }) {
	const label = `${EXCHANGE_SEGMENT_LABELS[segment]}${suffix ?? ''}`
	if (segment === 'spot') return <>{label}</>
	return (
		<span className="flex items-center gap-1">
			{label}
			<QuestionHelper text={SEGMENT_DEFINITIONS[segment].description} />
		</span>
	)
}
