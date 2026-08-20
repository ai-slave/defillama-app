import { lazy, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel, type SparseCartesianSeries } from '~/components/ECharts/MultiSeriesChart/model'
import { createCappedRemainderTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE } from '~/components/ECharts/shared/chartSpacing'
import type { IAdapterBreakdownChartData } from '~/containers/AdapterMetrics/api.types'
import { getGroupedTimestampSec } from '~/containers/ProDashboard/utils'
import { carryForwardCumulative, parseDateToUnix, type Chart } from './transform'
import { ChartCard, SegToggle, seriesColor } from './ui'

const MultiSeriesChart: React.FC<IMultiSeriesChartProps> = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type View = 'day' | 'month' | 'quarter' | 'cumulative'
type Pts = Array<[number, number]>

export interface TrendSeries {
	name: string
	data: Pts
}

const VIEWS: { value: View; label: string }[] = [
	{ value: 'day', label: 'Daily' },
	{ value: 'month', label: 'Monthly' },
	{ value: 'quarter', label: 'Quarterly' },
	{ value: 'cumulative', label: 'Cumulative' }
]

// Scrolling top legend + cleared grid top, so many-series legends never overlap the y-axis.
const CHART_OPTIONS = {
	legend: { type: 'scroll', top: CHART_INSET },
	grid: { top: CHART_LEGEND_RESERVE }
} satisfies NonNullable<IMultiSeriesChartProps['chartOptions']>

// Legend order: lifetime size desc, catch-all "Others" bucket last.
export function orderTrendSeries(series: TrendSeries[]): TrendSeries[] {
	const total = (s: TrendSeries) => s.data.reduce((sum, [, value]) => sum + (value || 0), 0)
	return [...series].sort((a, b) => {
		const aOthers = a.name.startsWith('Others')
		const bOthers = b.name.startsWith('Others')
		if (aOthers !== bOthers) return aOthers ? 1 : -1
		return total(b) - total(a)
	})
}

// DefiLlama breakdown rows ([timestamp, {name: value}]) to one series per name, on the
// union of names across all rows (a name absent from a row reads as 0), ordered for the legend.
export function breakdownToSeries(rows: IAdapterBreakdownChartData): TrendSeries[] {
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
export function chartToTrendSeries(chart: Chart): TrendSeries[] {
	return chart.series.map((series) => ({
		name: series.name,
		data: chart.dates.map((date, index): [number, number] => [parseDateToUnix(date), series.data[index] ?? 0])
	}))
}

// Drop the all-zero head shared by every series, so a metric that started recently
// (e.g. the fee switch) doesn't render years of empty space.
export function trimLeadingZeros(series: TrendSeries[]): TrendSeries[] {
	let start = Infinity
	for (const s of series) {
		const first = s.data.find(([, value]) => value > 0)
		if (first && first[0] < start) start = first[0]
	}
	if (!Number.isFinite(start)) return series
	return series.map((s) => ({ ...s, data: s.data.filter(([timestamp]) => timestamp >= start) }))
}

// Keep the n largest series by lifetime total (all-zero series dropped), summing the
// rest into an Others bucket. For raw DefiLlama breakdowns that list every chain.
export function groupTopN(series: TrendSeries[], n: number): TrendSeries[] {
	const withTotals = series
		.map((s) => ({ s, total: s.data.reduce((sum, [, value]) => sum + (value || 0), 0) }))
		.filter(({ total }) => total > 0)
		.sort((a, b) => b.total - a.total)
	const top = withTotals.slice(0, n).map(({ s }) => s)
	const rest = withTotals.slice(n)
	if (!rest.length) return top
	const others = new Map<number, number>()
	for (const { s } of rest) {
		for (const [timestamp, value] of s.data) others.set(timestamp, (others.get(timestamp) ?? 0) + (value || 0))
	}
	return [...top, { name: 'Others', data: [...others].sort((a, b) => a[0] - b[0]) }]
}

function aggregate(series: TrendSeries[], view: View, stacked: boolean): SparseCartesianSeries[] {
	if (!series.length) return []
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

// A time series rendered with a Daily / Monthly / Quarterly / Cumulative toggle. `stacked`
// keeps the series stacked in the daily/monthly/quarterly bar views (e.g. volume by chain
// or by version).
export function SeriesTrendChart({
	title,
	subtitle,
	series,
	isLoading,
	isError,
	valueSymbol = '$',
	defaultView = 'month',
	views,
	stacked = true,
	extraControl
}: {
	title: string
	subtitle?: string
	series?: TrendSeries[] | undefined
	isLoading?: boolean
	isError?: boolean
	valueSymbol?: string
	defaultView?: View
	/** Restrict the view toggle, for series that only exist at one granularity (monthly payloads). */
	views?: View[]
	stacked?: boolean
	/** Additional header-right control (e.g. a Total / By Chain toggle). */
	extraControl?: React.ReactNode
}) {
	const [view, setView] = useState<View>(defaultView)
	const viewOptions = views ? VIEWS.filter((v) => views.includes(v.value)) : VIEWS
	const chartSeries = useMemo(() => aggregate(series ?? [], view, stacked), [series, view, stacked])
	const groupBy = view === 'month' ? 'monthly' : view === 'quarter' ? 'quarterly' : 'daily'
	const model = useMemo(() => buildSparseCartesianChartModel(chartSeries), [chartSeries])
	const chartOptions = useMemo(
		() => ({
			...CHART_OPTIONS,
			tooltip: { formatter: createCappedRemainderTooltipFormatter({ groupBy, valueSymbol }) }
		}),
		[groupBy, valueSymbol]
	)
	return (
		<ChartCard
			title={title}
			{...(subtitle !== undefined ? { subtitle } : {})}
			control={
				<>
					{extraControl}
					<SegToggle<View> options={viewOptions} value={view} onChange={setView} />
				</>
			}
		>
			{isLoading ? (
				<div className="flex h-[360px] items-center justify-center text-xs text-pro-text-tertiary">Loading...</div>
			) : isError ? (
				<div className="flex h-[360px] items-center justify-center text-xs text-pro-text-tertiary">
					Failed to load data
				</div>
			) : !chartSeries.length ? (
				<div className="flex h-[360px] items-center justify-center text-xs text-pro-text-tertiary">No data</div>
			) : (
				<MultiSeriesChart
					dataset={model.dataset}
					charts={model.charts}
					valueSymbol={valueSymbol}
					groupBy={groupBy}
					height="360px"
					chartOptions={chartOptions}
					hideDefaultLegend={false}
					exportButtons="hidden"
				/>
			)}
		</ChartCard>
	)
}
