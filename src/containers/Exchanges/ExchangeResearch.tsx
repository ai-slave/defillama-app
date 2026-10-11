import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useInViewOnce } from '~/hooks/useInViewOnce'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { queryReadFailed } from '~/utils/query'
import { pushShallowQuery } from '~/utils/routerQuery'
import { BtcExecutionTable } from './BtcExecutionTable'
import { ChartRangeControl } from './ChartRangeControl'
import type { DepthCurveRow } from './depthCurve'
import { DepthCurveChart } from './DepthCurveChart'
import type { BtcExecutionRowModel, ExchangeResearchReportModel, ExchangeResearchView } from './models'
import {
	getResearchRange,
	getResearchView,
	getResearchViewQueryKey,
	type ExchangeResearchPart,
	type ExchangeResearchRange
} from './queryState'
import { ResearchChart, ResearchChartStatus } from './ResearchChart'
import { getResearchPresentation, RESEARCH_VIEWS, resolveResearchView } from './researchPresentation'
import { SEGMENT_DEFINITIONS } from './segmentPresentation'

const STALE_TIME = 6 * 60 * 60 * 1000

// Order within a section, and the sections themselves further down, follows what
// people actually reach for first: open interest between exchanges (who's carrying
// the risk right now) before volume/market-share trends over time.
const RESEARCH_SECTIONS: Array<{ title: string; description: string; charts: Array<ExchangeResearchPart> }> = [
	{ title: 'Activity', description: 'Traded volume and open positions across venues.', charts: ['oi', 'volume'] },
	{
		title: 'Liquidity',
		description: 'Order-book depth and how much reported volume is backed by real liquidity.',
		charts: ['depth', 'nvol']
	}
]

const EMPTY_DEPTH_ROWS: Array<DepthCurveRow> = []
const EMPTY_BTC_EXECUTION_ROWS: Array<BtcExecutionRowModel> = []

export function ExchangeResearch({
	loadReport,
	depthRows = EMPTY_DEPTH_ROWS,
	btcExecutionRows = EMPTY_BTC_EXECUTION_ROWS
}: {
	loadReport: (part: ExchangeResearchPart, range: ExchangeResearchRange) => Promise<ExchangeResearchReportModel>
	/** Venue rows carrying only what the depth curve reads. Empty means no snapshots. */
	depthRows?: Array<DepthCurveRow>
	/** One row per venue with a measured BTC pair. Empty means execution data is unavailable. */
	btcExecutionRows?: Array<BtcExecutionRowModel>
}) {
	const router = useRouter()
	const range = getResearchRange(router.query)
	return (
		<div className="flex flex-1 flex-col gap-3">
			{RESEARCH_SECTIONS.map((section, sectionIndex) => (
				<section key={section.title} className="flex flex-col gap-2">
					<div className="flex flex-wrap items-start justify-between gap-2 px-1">
						<div className="flex flex-col gap-0.5">
							<h2 className="heading-xs">{section.title}</h2>
							<p className="body-sm text-secondary">{section.description}</p>
						</div>
						{/* The range drives every chart on the page, so it rides the first section's
						    heading instead of owning a near-empty row above it. */}
						{sectionIndex === 0 ? (
							<div className="ml-auto shrink-0">
								<ChartRangeControl range={range} />
							</div>
						) : null}
					</div>
					<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
						{section.charts.map((part) => (
							<ResearchChartCard key={part} part={part} range={range} loadReport={loadReport} />
						))}
					</div>
				</section>
			))}
			{depthRows.length > 0 ? (
				<section className="flex flex-col gap-2">
					<div className="flex flex-col gap-0.5 px-1">
						<h2 className="heading-xs">Order book</h2>
						<p className="body-sm text-secondary">
							The current book by distance from mid, per segment and per exchange. A snapshot, so the range control
							above does not apply to it.
						</p>
					</div>
					<Panel>
						<DepthCurveChart rows={depthRows} />
					</Panel>
				</section>
			) : null}
			{btcExecutionRows.length > 0 ? (
				<section className="flex flex-col gap-2">
					<div className="flex flex-col gap-0.5 px-1">
						<h2 className="heading-xs">BTC execution</h2>
						<p className="body-sm text-secondary">
							Measured, not advertised: tick-level fill quality and fees on the BTC market at every exchange we have
							data for. Rank is the same quality tier shown on the exchange directory.
						</p>
					</div>
					<Panel>
						<BtcExecutionTable rows={btcExecutionRows} />
					</Panel>
				</section>
			) : null}
		</div>
	)
}

function ResearchChartCard({
	part,
	range,
	loadReport
}: {
	part: ExchangeResearchPart
	range: ExchangeResearchRange
	loadReport: (part: ExchangeResearchPart, range: ExchangeResearchRange) => Promise<ExchangeResearchReportModel>
}) {
	const router = useRouter()
	const { ref, seen } = useInViewOnce({ rootMargin: '400px' })
	const query = useQuery({
		queryKey: ['exchange-research-chart', part, range],
		queryFn: () => loadReport(part, range),
		enabled: seen,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
	const requestedView = getResearchView(router.query, part)
	const selectedView = query.data?.views.find((item) => item.id === requestedView) ?? query.data?.views[0]
	const resolvedView = selectedView?.id ?? resolveResearchView(part, requestedView)
	const viewOptions = query.data?.views ?? RESEARCH_VIEWS[part]
	const toolbar =
		viewOptions.length > 1 ? (
			<SegmentedControl<ExchangeResearchView>
				value={resolvedView}
				onValueChange={(nextView) => {
					const viewQueryKey = getResearchViewQueryKey(part)
					void pushShallowQuery(router, {
						[viewQueryKey]: nextView === viewOptions[0]?.id ? undefined : nextView
					})
				}}
				options={viewOptions.map(({ id, label }) => {
					// (?) definition on toggle labels that name a perpetual class.
					const segment = getResearchPresentation(part, id).segment
					if (segment !== 'linear_perp' && segment !== 'inverse_perp') return { value: id, label }
					return {
						value: id,
						ariaLabel: label,
						label: (
							<span className="flex items-center gap-1">
								{label}
								<QuestionHelper text={SEGMENT_DEFINITIONS[segment].description} />
							</span>
						)
					}
				})}
				label="Chart view"
				variant="default"
				size="md"
			/>
		) : null

	return (
		<div ref={ref} className="flex flex-col">
			{!selectedView ? (
				<ResearchChartStatus
					presentation={getResearchPresentation(part, resolvedView)}
					toolbar={toolbar}
					failedRead={queryReadFailed(query) ? query : null}
				/>
			) : (
				<ResearchChart chart={selectedView.chart} toolbar={toolbar} />
			)}
		</div>
	)
}
