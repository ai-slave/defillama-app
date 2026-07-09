import * as React from 'react'
import { LocalLoader } from '~/components/Loaders'
import { Panel } from '~/ui/Panel'
import { type PivotedSeries, toLineSeries } from './utils'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const FALLBACK = (
	<div role="status" aria-live="polite" className="flex min-h-[300px] items-center justify-center">
		<LocalLoader />
		<span className="sr-only">Loading chart data</span>
	</div>
)

// Scrollable top-centred legend so many lines don't wrap over the plot.
const CHART_OPTIONS = {
	legend: { type: 'scroll', left: 'center', right: 'auto' },
	grid: { top: 28 }
}

/** A 30d non-stacked multi-line chart card (e.g. markets-tracked health). */
export function MarketsLineChart({
	title,
	series,
	valueSymbol = ''
}: {
	title: string
	series: PivotedSeries
	valueSymbol?: string
}) {
	const lineSeries = React.useMemo(() => toLineSeries(series), [series])
	const hasData = lineSeries.length > 0 && series.chartData.length > 0
	return (
		<Panel padding="none" className="min-h-[360px]">
			<div className="flex flex-col px-2 pt-2 pb-0">
				<span className="label-sm text-secondary uppercase">30 days · tracking health</span>
				<span className="label-md">{title}</span>
			</div>
			{hasData ? (
				<React.Suspense fallback={FALLBACK}>
					<MultiSeriesChart series={lineSeries} valueSymbol={valueSymbol} chartOptions={CHART_OPTIONS} height="280px" />
				</React.Suspense>
			) : (
				<div role="status" aria-live="polite" className="flex flex-1 items-center justify-center body-sm text-tertiary">
					no data
				</div>
			)}
		</Panel>
	)
}
