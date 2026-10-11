import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { exchangeDefinitions, type ExchangeDefinition } from './definitions'
import { EXCHANGE_SEGMENT_LABELS, type ExchangeSegment } from './models'

export const SEGMENT_DEFINITIONS: Record<ExchangeSegment, ExchangeDefinition> = {
	spot: exchangeDefinitions.segments.spot,
	linear_perp: exchangeDefinitions.segments.linearPerps,
	inverse_perp: exchangeDefinitions.segments.inversePerps
}

/** A segment toggle option's content (Spot | USD Perps | COIN Perps), spread into a SegmentedControl option. The
    perpetual classes carry their definition as the option's `tooltip`, so the whole toggle anchors it; the "?" in the
    label only marks it, because a focusable QuestionHelper inside the toggle would nest in the control. */
export function segmentToggle(
	segment: ExchangeSegment,
	text = EXCHANGE_SEGMENT_LABELS[segment]
): { label: ReactNode; tooltip?: string } {
	if (segment === 'spot') return { label: text }
	return {
		label: (
			<>
				{text}
				<Icon name="help-circle" className="size-4 text-tertiary" aria-hidden />
			</>
		),
		tooltip: SEGMENT_DEFINITIONS[segment].description
	}
}
