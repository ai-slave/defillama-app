import * as React from 'react'
import { LocalLoader } from '~/ui/Loaders'
import { Panel } from '~/ui/Panel'
import { type PivotedSeries, toStackedAreaSeries } from './utils'

const AreaChart = React.lazy(() => import('~/components/ECharts/AreaChart'))

const FALLBACK = (
	<div role="status" aria-live="polite" className="flex min-h-[400px] items-center justify-center">
		<LocalLoader />
		<span className="sr-only">Loading chart data</span>
	</div>
)

/** A 30d stacked-area chart card (volume or OI) built from pre-pivoted series. */
export function MarketsAreaChart({ title, series }: { title: string; series: PivotedSeries }) {
	const ordered = React.useMemo(() => toStackedAreaSeries(series), [series])
	// Stack smallest-first (`ordered`) so the largest series sits on top and the tooltip surfaces it,
	// but list the legend largest-first (`series.stacks` keeps the pivot's descending rank). A single
	// scrollable legend row keeps many series from wrapping over the plot, leaving room for the zoom slider.
	const chartOptions = React.useMemo(
		() => ({ legend: { type: 'scroll', left: 'center', right: 'auto', data: series.stacks } }),
		[series.stacks]
	)
	const hasData = ordered.chartData.length > 0 && ordered.stacks.length > 0
	return (
		<Panel padding="none" className="min-h-[400px]">
			{hasData ? (
				<React.Suspense fallback={FALLBACK}>
					<AreaChart
						title={title}
						headingAs="h3"
						chartData={ordered.chartData}
						stacks={ordered.stacks}
						valueSymbol="$"
						isStackedChart
						hideDefaultLegend={false}
						chartOptions={chartOptions}
						height="360px"
					/>
				</React.Suspense>
			) : (
				<>
					<h3 className="px-2 pt-2 pb-0 heading-xs">{title}</h3>
					<div
						role="status"
						aria-live="polite"
						className="flex flex-1 items-center justify-center body-sm text-tertiary"
					>
						no data
					</div>
				</>
			)}
		</Panel>
	)
}
