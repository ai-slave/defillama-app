import { SegmentedControl } from '~/ui/SegmentedControl'
import { EXCHANGE_SEGMENT_LABELS, EXCHANGE_SEGMENTS, type ExchangeProfileModel, type ExchangeSegment } from './models'
import { SegmentToggleLabel } from './segmentPresentation'

export function ProfileSegmentTabs({
	profile,
	value,
	onValueChange
}: {
	profile: ExchangeProfileModel
	value: ExchangeSegment
	onValueChange: (segment: ExchangeSegment) => void
}) {
	const options = EXCHANGE_SEGMENTS.flatMap((segmentId) => {
		const segment = profile.segments[segmentId]
		return segment
			? [
					{
						value: segment.segment,
						label: <SegmentToggleLabel segment={segment.segment} suffix={` · ${segment.marketCount}`} />,
						ariaLabel: `${EXCHANGE_SEGMENT_LABELS[segment.segment]} · ${segment.marketCount}`
					}
				]
			: []
	})
	if (options.length === 0) return null
	return (
		<SegmentedControl
			value={value}
			onValueChange={onValueChange}
			options={options}
			label="Market segment"
			variant="responsive"
			size="md"
		/>
	)
}
