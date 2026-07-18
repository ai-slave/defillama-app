import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ExchangeResearchReportModel, ExchangeResearchView } from './models'
import { getResearchView, getResearchViewQueryKey, type ExchangeResearchPart } from './queryState'
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
	loadReport: (part: ExchangeResearchPart) => Promise<ExchangeResearchReportModel>
}) {
	return (
		<div className="flex flex-1 flex-col gap-3">
			{RESEARCH_SECTIONS.map((section) => (
				<section key={section.title} className="flex flex-col gap-2">
					<div className="flex flex-col gap-0.5 px-1">
						<h2 className="heading-xs">{section.title}</h2>
						<p className="body-sm text-secondary">{section.description}</p>
					</div>
					<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
						{section.charts.map((part) => (
							<ResearchChartCard key={part} part={part} loadReport={loadReport} />
						))}
					</div>
				</section>
			))}
		</div>
	)
}

function ResearchChartCard({
	part,
	loadReport
}: {
	part: ExchangeResearchPart
	loadReport: (part: ExchangeResearchPart) => Promise<ExchangeResearchReportModel>
}) {
	const router = useRouter()
	const { ref, visible } = useLazyVisible<HTMLDivElement>()
	const query = useQuery({
		queryKey: ['exchange-research-chart', part],
		queryFn: () => loadReport(part),
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
				size="sm"
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
