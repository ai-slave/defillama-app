import { lazy, Suspense, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel, type SparseCartesianSeries } from '~/components/ECharts/MultiSeriesChart/model'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE } from '~/components/ECharts/shared/chartSpacing'
import type { IAdapterBreakdownChartData } from '~/containers/AdapterMetrics/api.types'
import { getGroupedTimestampSec } from '~/containers/ProDashboard/utils'
import { CHART_FILL, ChartPanel, ChartPanelBodyError, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import type { QueryRetry } from '~/utils/query'
import {
	BUCKET_DAYS,
	type Bucket,
	carryForwardCumulative,
	detectCadence,
	parseDateToUnix,
	type Chart,
	type TrendSeries
} from './transform'
import { CardTitle, createStackTooltipFormatter, seriesColor, useTooltipMaxItems } from './ui'

const MultiSeriesChart: React.FC<IMultiSeriesChartProps> = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type View = 'day' | 'week' | 'month' | 'quarter' | 'cumulative'
type Pts = Array<[number, number]>

const VIEWS: Array<{ value: View; label: string }> = [
	{ value: 'day', label: 'Daily' },
	{ value: 'week', label: 'Weekly' },
	{ value: 'month', label: 'Monthly' },
	{ value: 'quarter', label: 'Quarterly' },
	{ value: 'cumulative', label: 'Cumulative' }
]

// Every bucket the data can honestly be shown at, coarsest-first from its own cadence.
export function viewOptionsFor(cadence: Bucket, valueSymbol: string): typeof VIEWS {
	return VIEWS.filter((v) =>
		// A running total of percentages is not a quantity, so those series get no cumulative view.
		v.value === 'cumulative' ? valueSymbol !== '%' : BUCKET_DAYS[v.value] >= BUCKET_DAYS[cadence]
	)
}

// Scrolling top legend + cleared grid top, so many-series legends never overlap the y-axis.
const CHART_OPTIONS = {
	legend: { type: 'scroll', top: CHART_INSET },
	grid: { top: CHART_LEGEND_RESERVE }
} satisfies NonNullable<IMultiSeriesChartProps['chartOptions']>

const seriesTotal = (s: TrendSeries) => s.data.reduce((sum, [, value]) => sum + (value || 0), 0)

// Legend order: lifetime size desc, catch-all "Others" bucket last.
export function orderTrendSeries(series: Array<TrendSeries>): Array<TrendSeries> {
	return [...series].sort((a, b) => {
		const aOthers = a.name.startsWith('Others')
		const bOthers = b.name.startsWith('Others')
		if (aOthers !== bOthers) return aOthers ? 1 : -1
		return seriesTotal(b) - seriesTotal(a)
	})
}

// DefiLlama breakdown rows ([timestamp, {name: value}]) to one series per name, on the
// union of names across all rows (a name absent from a row reads as 0), ordered for the legend.
export function breakdownToSeries(rows: IAdapterBreakdownChartData): Array<TrendSeries> {
	const names = new Set<string>()
	for (const [, values] of rows) {
		for (const name of Object.keys(values)) names.add(name)
	}
	return orderTrendSeries(
		[...names].map((name) => ({
			name,
			data: rows.map(([timestamp, values]): [number, number] => [timestamp, values[name] ?? 0])
		}))
	)
}

// An ir-server Chart (parallel dates + series values) as point series for SeriesTrendChart.
export function chartToTrendSeries(chart: Chart): Array<TrendSeries> {
	return chart.series.map((series) => ({
		name: series.name,
		data: chart.dates.map((date, index): [number, number] => [parseDateToUnix(date), series.data[index] ?? 0])
	}))
}

// Drop the all-zero head shared by every series, so a metric that started recently
// (e.g. the fee switch) doesn't render years of empty space.
export function trimLeadingZeros(series: Array<TrendSeries>): Array<TrendSeries> {
	let start = Infinity
	for (const s of series) {
		const first = s.data.find(([, value]) => value > 0)
		if (first && first[0] < start) start = first[0]
	}
	if (!Number.isFinite(start)) return series
	return series.map((s) => ({ ...s, data: s.data.filter(([timestamp]) => timestamp >= start) }))
}

// Chain breakdowns keep this many chains before folding the rest into Others (matches the
// desktop tooltip's 20 rows).
export const TOP_CHAINS = 20

// Keep the n largest series by lifetime total (all-zero series dropped), summing the
// rest into an Others bucket. For raw DefiLlama breakdowns that list every chain.
export function groupTopN(series: Array<TrendSeries>, n: number): Array<TrendSeries> {
	const withTotals = series
		.map((s) => ({ s, total: s.data.reduce((sum, [, value]) => sum + (value || 0), 0) }))
		.filter(({ total }) => total > 0)
		.sort((a, b) => b.total - a.total)
	const top = withTotals.slice(0, n).map(({ s }) => s)
	const rest = withTotals.slice(n)
	if (rest.length === 0) return top
	const others = new Map<number, number>()
	for (const { s } of rest) {
		for (const [timestamp, value] of s.data) others.set(timestamp, (others.get(timestamp) ?? 0) + (value || 0))
	}
	return [...top, { name: 'Others', data: [...others].sort((a, b) => a[0] - b[0]) }]
}

export function aggregate(series: Array<TrendSeries>, view: View, stacked: boolean): Array<SparseCartesianSeries> {
	if (series.length === 0) return []
	const grouping = view === 'cumulative' ? 'day' : view
	const isCumulative = view === 'cumulative'
	const agg = series.map((s, i) => {
		const points: Pts = []
		let cumulativeTotal = 0
		for (const [ts, val] of s.data) {
			const key = grouping === 'day' ? ts : getGroupedTimestampSec(ts, grouping)
			const previous = points[points.length - 1]
			if (isCumulative) {
				cumulativeTotal += val
				if (previous?.[0] === key) previous[1] = cumulativeTotal
				else points.push([key, cumulativeTotal])
			} else if (previous?.[0] === key) {
				previous[1] += val
			} else {
				points.push([key, val])
			}
		}
		return { name: s.name, color: seriesColor(s.name, i), points }
	})
	const useArea = stacked || agg.length === 1
	return (isCumulative ? carryForwardCumulative(agg) : agg).map((s) => ({
		name: s.name,
		data: s.points,
		color: s.color,
		type: view === 'cumulative' ? 'line' : 'bar',
		...(view === 'cumulative' ? { connectNulls: true } : {}),
		...(stacked ? { stack: 'total' } : {}),
		...(view === 'cumulative' && useArea ? { areaStyle: {} } : {})
	}))
}

// A time series with a granularity toggle derived from the data itself: the buckets offered start at
// the series' own cadence (weekly data offers Weekly upward, monthly data Monthly upward), and the
// view opens on that cadence unless the caller wants a coarser default. `stacked` keeps the series
// stacked in the bar views (e.g. volume by chain or by version).
export function SeriesTrendChart({
	title,
	subtitle,
	series,
	isLoading,
	failedRead,
	valueSymbol = '$',
	defaultView,
	minBucket,
	stacked = true,
	extraControl
}: {
	title: string
	subtitle?: string
	series?: Array<TrendSeries> | undefined
	isLoading?: boolean
	/** The read that failed, or null: its Try again reruns it, and the error stays on screen while it does. */
	failedRead?: QueryRetry | null
	valueSymbol?: string
	/** Opening view; ignored when the data is coarser than it. Defaults to the data's own cadence. */
	defaultView?: View
	/** Finest bucket to offer, when the data's own cadence is too noisy to be worth reading. */
	minBucket?: Bucket
	stacked?: boolean
	/** Additional header-right control (e.g. a Total / By Chain toggle). */
	extraControl?: React.ReactNode
}) {
	const [picked, setPicked] = useState<View | null>(null)
	const cadence = useMemo(() => detectCadence(series ?? [], minBucket), [series, minBucket])
	const viewOptions = useMemo(() => viewOptionsFor(cadence, valueSymbol), [cadence, valueSymbol])
	// Both the caller's default and a pick made while the data was still loading can name a view the
	// data doesn't support; fall back to its cadence (the first option) rather than mislabeling it.
	const wanted = picked ?? defaultView ?? cadence
	const view = viewOptions.some((v) => v.value === wanted) ? wanted : (viewOptions[0]?.value ?? cadence)
	const chartSeries = useMemo(() => aggregate(series ?? [], view, stacked), [series, view, stacked])
	const groupBy = view === 'week' ? 'weekly' : view === 'month' ? 'monthly' : view === 'quarter' ? 'quarterly' : 'daily'
	const model = useMemo(() => buildSparseCartesianChartModel(chartSeries), [chartSeries])
	const maxItems = useTooltipMaxItems()
	const chartOptions = useMemo(
		() => ({
			...CHART_OPTIONS,
			tooltip: {
				formatter: createStackTooltipFormatter({
					groupBy,
					valueSymbol,
					maxItems,
					// A Total only reads as one for stacked parts of a whole, never for overlaid lines or shares.
					showTotal: stacked && valueSymbol !== '%'
				})
			}
		}),
		[groupBy, valueSymbol, maxItems, stacked]
	)
	return (
		<ChartPanel>
			<ChartPanelToolbar leading={<CardTitle title={title} subtitle={subtitle} />}>
				{extraControl}
				<SegmentedControl<View>
					variant="default"
					size="md"
					label={`${title} period`}
					options={viewOptions}
					value={view}
					onValueChange={setPicked}
				/>
			</ChartPanelToolbar>
			{failedRead ? (
				<ChartPanelBodyError retry={failedRead}>Failed to load data</ChartPanelBodyError>
			) : isLoading ? (
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator />
				</ChartPanelBodyFallback>
			) : chartSeries.length === 0 ? (
				<ChartPanelBodyFallback>
					<p className="body-sm text-tertiary">No data</p>
				</ChartPanelBodyFallback>
			) : (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={model.dataset}
						charts={model.charts}
						valueSymbol={valueSymbol}
						groupBy={groupBy}
						containerClassName={CHART_FILL}
						chartOptions={chartOptions}
						showLegend
						exportButtons="hidden"
					/>
				</Suspense>
			)}
		</ChartPanel>
	)
}
