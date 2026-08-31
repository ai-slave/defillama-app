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
import { ChartPanelBody, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { depthCurveAriaLabel, depthCurveDataset, type DepthCurveEntry } from './depthCurve'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const categoryOptions = createCategoryChartOptions('$')

const CHART_HEIGHT = '360px'

/** Distinct hues so overlapping curves stay separable. */
export const DEPTH_COLORS = [
	'#5c9cf5',
	'#9b7cf7',
	'#33b38f',
	'#e48b52',
	'#d76184',
	'#c9a227',
	'#4bc0c0',
	'#a06cd5',
	'#6b8f3a',
	'#c2582f',
	'#3f7fd1',
	'#7a5bc4',
	'#2a8f72',
	'#b06a3c',
	'#a84a68',
	'#8c8c8c'
]

export function DepthCurveBody({ entries }: { entries: DepthCurveEntry[] }) {
	const dataset = React.useMemo(() => depthCurveDataset(entries), [entries])
	const ariaLabel = React.useMemo(() => depthCurveAriaLabel(entries), [entries])
	const charts = React.useMemo(
		() =>
			(dataset?.series ?? []).map((name, index) => ({
				type: 'line' as const,
				name,
				color: DEPTH_COLORS[index % DEPTH_COLORS.length],
				encode: { x: 0, y: dataset!.dimensions.indexOf(name) },
				// Light fill only: with several curves overlapping, a solid area would bury
				// whatever sits behind it.
				areaStyle: { opacity: 0.1 },
				smooth: true,
				showSymbol: false,
				connectNulls: false
			})),
		[dataset]
	)

	if (!dataset) {
		return (
			<ChartPanelBodyFallback role="status" className="body-sm text-tertiary">
				No fully measured order-book depth to chart yet.
			</ChartPanelBodyFallback>
		)
	}

	return (
		<ChartPanelBody role="img" aria-label={ariaLabel}>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={{ source: dataset.source, dimensions: dataset.dimensions }}
					charts={charts}
					valueSymbol="$"
					height={CHART_HEIGHT}
					hideDataZoom
					hideDefaultLegend={false}
					exportButtons="hidden"
					// Category options bring a tooltip formatter built for a labelled axis;
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
