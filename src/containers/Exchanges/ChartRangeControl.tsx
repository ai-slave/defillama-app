import { useRouter } from 'next/router'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import { DEFAULT_RESEARCH_RANGE, EXCHANGES_QUERY_KEYS, RESEARCH_RANGES, type ExchangeResearchRange } from './queryState'

/**
 * The chart window control. One query key drives every Exchanges chart, so the listing
 * overview, a venue's history and the research page all read the same window — and the
 * default drops out of the URL rather than being pinned in it.
 */
export function ChartRangeControl({ range }: { range: ExchangeResearchRange }) {
	const router = useRouter()
	return (
		<SegmentedControl<ExchangeResearchRange>
			value={range}
			onValueChange={(nextRange) => {
				void pushShallowQuery(router, {
					[EXCHANGES_QUERY_KEYS.researchRange]: nextRange === DEFAULT_RESEARCH_RANGE ? undefined : nextRange
				})
			}}
			options={RESEARCH_RANGES.map((value) => ({ value, label: value }))}
			label="Chart range"
			variant="default"
			size="md"
		/>
	)
}
