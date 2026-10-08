/**
 * The charts-page order book: one segment at a time, summed across venues or split by
 * venue, bids and asks on one axis.
 */
import * as React from 'react'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { aggregateEntries, depthCurveVenues, venueEntries, type DepthCurveRow } from './depthCurve'
import { DepthCurveBody } from './DepthCurveBody'
import { EXCHANGE_SEGMENT_LABELS, type ExchangeSegment } from './models'

/** Depth exists for spot and USD perps; COIN perps carry too few venues to compare. */
const DEPTH_SEGMENTS = ['spot', 'linear_perp'] as const satisfies ReadonlyArray<ExchangeSegment>
type DepthSegment = (typeof DEPTH_SEGMENTS)[number]

type DepthView = 'aggregate' | 'breakdown'

export function DepthCurveChart({ rows }: { rows: Array<DepthCurveRow> }) {
	const [segment, setSegment] = React.useState<DepthSegment>('spot')
	const [view, setView] = React.useState<DepthView>('aggregate')

	const available = React.useMemo(
		() => DEPTH_SEGMENTS.filter((candidate) => depthCurveVenues(rows, candidate, 1).length > 0),
		[rows]
	)
	const activeSegment = available.includes(segment) ? segment : (available[0] ?? 'spot')
	const venues = React.useMemo(() => depthCurveVenues(rows, activeSegment), [rows, activeSegment])
	const entries = React.useMemo(
		// Both views read every venue: the split view groups its tail rather than
		// truncating it, so the two always account for the same book.
		() => (view === 'breakdown' ? venueEntries(venues, CHART_SERIES_LIMIT) : aggregateEntries(venues)),
		[venues, view]
	)

	return (
		<>
			<ChartPanelToolbar>
				<SegmentedControl<DepthSegment>
					value={activeSegment}
					onValueChange={setSegment}
					options={(available.length > 0 ? available : DEPTH_SEGMENTS).map((option) => ({
						value: option,
						label: EXCHANGE_SEGMENT_LABELS[option]
					}))}
					label="Depth segment"
					variant="default"
					size="md"
					className="mr-auto"
				/>
				<SegmentedControl<DepthView>
					value={view}
					onValueChange={setView}
					options={[
						{ value: 'aggregate', label: 'All exchanges' },
						{ value: 'breakdown', label: 'By exchange' }
					]}
					label="Depth breakdown"
					variant="default"
					size="md"
				/>
			</ChartPanelToolbar>
			<DepthCurveBody entries={entries} />
			<p className="px-2 pb-2 body-sm text-tertiary">
				{`Cumulative USD resting within each distance of mid across ${venues.length} books, unstacked. Only books measured that far out are counted, so a curve can step down where a shallower book drops out. A venue trading on another's book counts once, under that book.`}
			</p>
		</>
	)
}
