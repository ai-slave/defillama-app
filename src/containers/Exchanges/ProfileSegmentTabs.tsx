import { SegmentedControl } from '~/ui/SegmentedControl'
import { EXCHANGE_SEGMENT_LABELS, EXCHANGE_SEGMENTS, type ExchangeProfileModel } from './models'
import type { ProfileSegmentSelection } from './queryState'
import { SegmentToggleLabel } from './segmentPresentation'

export function ProfileSegmentTabs({
	profile,
	value,
	onValueChange
}: {
	profile: ExchangeProfileModel
	value: ProfileSegmentSelection
	onValueChange: (segment: ProfileSegmentSelection) => void
}) {
	const segmentOptions = EXCHANGE_SEGMENTS.flatMap((segmentId) => {
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
	if (segmentOptions.length === 0) return null
	// `All` leads: it is the per-token rollup, and the exact segment tables sit behind
	// it unchanged for anyone who wants one book at a time.
	const options = [{ value: 'all' as const, label: 'All', ariaLabel: 'All markets by token' }, ...segmentOptions]
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
