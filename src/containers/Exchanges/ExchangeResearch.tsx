import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ExchangeResearchReportModel, ExchangeResearchView } from './models'
import {
	DEFAULT_RESEARCH_RANGE,
	EXCHANGES_QUERY_KEYS,
	getResearchRange,
	getResearchView,
	getResearchViewQueryKey,
	type ExchangeResearchPart,
	type ExchangeResearchRange
} from './queryState'
import { ResearchChart, ResearchChartStatus } from './ResearchChart'
import { getResearchPresentation, RESEARCH_VIEWS, resolveResearchView } from './researchPresentation'
import { SEGMENT_DEFINITIONS } from './segmentPresentation'
import { useLazyVisible } from './useLazyVisible'

const STALE_TIME = 6 * 60 * 60 * 1000

const RESEARCH_SECTIONS: Array<{ title: string; description: string; charts: ExchangeResearchPart[] }> = [
	{ title: 'Activity', description: 'Traded volume and open positions across venues.', charts: ['volume', 'oi'] },
	{
		title: 'Liquidity',
		description: 'Order-book depth and how much reported volume is backed by real liquidity.',
		charts: ['depth', 'nvol']
	}
]

export function ExchangeResearch({
	loadReport
}: {
	loadReport: (part: ExchangeResearchPart, range: ExchangeResearchRange) => Promise<ExchangeResearchReportModel>
}) {
	const router = useRouter()
	const range = getResearchRange(router.query)
	return (
		<div className="flex flex-1 flex-col gap-3">
			<div className="flex justify-end">
				<SegmentedControl<ExchangeResearchRange>
					value={range}
					onValueChange={(nextRange) => {
						void pushShallowQuery(router, {
							[EXCHANGES_QUERY_KEYS.researchRange]: nextRange === DEFAULT_RESEARCH_RANGE ? undefined : nextRange
						})
					}}
					options={(['30d', '90d', '1y', '2y', 'all'] as const).map((value) => ({ value, label: value }))}
					label="Chart range"
					variant="default"
					size="md"
				/>
			</div>
			{RESEARCH_SECTIONS.map((section) => (
				<section key={section.title} className="flex flex-col gap-2">
					<div className="flex flex-col gap-0.5 px-1">
						<h2 className="heading-xs">{section.title}</h2>
						<p className="body-sm text-secondary">{section.description}</p>
					</div>
					<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
						{section.charts.map((part) => (
							<ResearchChartCard key={part} part={part} range={range} loadReport={loadReport} />
						))}
					</div>
				</section>
			))}
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
	const { ref, visible } = useLazyVisible<HTMLDivElement>()
	const query = useQuery({
		queryKey: ['exchange-research-chart', part, range],
		queryFn: () => loadReport(part, range),
		enabled: visible,
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
					void pushShallowQuery(router, {
						[getResearchViewQueryKey(part)]: nextView === viewOptions[0].id ? undefined : nextView
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
				variant="responsive"
				size="md"
			/>
		) : null

	return (
		<div ref={ref} className="flex flex-col">
			{query.isError ? (
				<ResearchChartStatus
					presentation={getResearchPresentation(part, resolvedView)}
					toolbar={toolbar}
					status="error"
				/>
			) : !query.data || !selectedView ? (
				<ResearchChartStatus
					presentation={getResearchPresentation(part, resolvedView)}
					toolbar={toolbar}
					status="loading"
				/>
			) : (
				<ResearchChart chart={selectedView.chart} toolbar={toolbar} />
			)}
		</div>
	)
}
