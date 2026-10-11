/**
 * The order-book chart body: bids left of mid, asks right, one superimposed curve per
 * entry.
 *
 * Superimposed rather than stacked because the question is which venue is deeper, not
 * what they sum to. One series per entry rather than one per side, so the legend lists
 * exchanges rather than exchange-and-side pairs.
 */
import * as React from 'react'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { CHART_FILL, ChartPanelBody } from '~/ui/ChartPanel'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { depthCurveAriaLabel, depthCurveDataset, type DepthCurveEntry } from './depthCurve'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const categoryOptions = createCategoryChartOptions('$')

export function DepthCurveBody({ entries }: { entries: Array<DepthCurveEntry> }) {
	const dataset = React.useMemo(() => depthCurveDataset(entries), [entries])
	const ariaLabel = React.useMemo(() => depthCurveAriaLabel(entries), [entries])
	const charts = React.useMemo(
		() =>
			(dataset?.series ?? []).map((name, index) => ({
				type: 'line' as const,
				name,
				color: entries[index].color,
				encode: { x: 0, y: dataset!.dimensions.indexOf(name) },
				// Light fill only: with several curves overlapping, a solid area would bury
				// whatever sits behind it.
				areaStyle: { opacity: 0.1 },
				smooth: true,
				showSymbol: false,
				connectNulls: false
			})),
		[dataset, entries]
	)

	if (!dataset) {
		return <SurfaceBodyStatus variant="empty">No fully measured order-book depth to chart yet.</SurfaceBodyStatus>
	}

	return (
		<ChartPanelBody role="img" aria-label={ariaLabel}>
			<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
				<MultiSeriesChart
					dataset={{ source: dataset.source, dimensions: dataset.dimensions }}
					charts={charts}
					valueSymbol="$"
					containerClassName={CHART_FILL}
					hideDataZoom
					showLegend
					exportButtons="hidden"
					// Category options bring a tooltip formatter built for a labeled axis;
					// without them the chart falls back to its time-series defaults and prints
					// a date for every band.
					chartOptions={{
						...categoryOptions,
						xAxis: { type: 'category', boundaryGap: false, axisLabel: { interval: 0, rotate: 45 } }
					}}
				/>
			</React.Suspense>
		</ChartPanelBody>
	)
}
