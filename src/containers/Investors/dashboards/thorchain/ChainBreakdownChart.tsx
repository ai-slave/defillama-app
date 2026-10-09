import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel, type SparseCartesianSeries } from '~/components/ECharts/MultiSeriesChart/model'
import { createCappedRemainderTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE } from '~/components/ECharts/shared/chartSpacing'
import { CHART_SERIES_LIMIT, chartColor, OTHERS_COLOR } from '~/constants/colors'
import { ADAPTER_DATA_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchProtocolChainBreakdownData } from '~/containers/ProDashboard/services/ProtocolChartBuilderData'
import { getGroupedTimestampSec } from '~/containers/ProDashboard/utils'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBodyError,
	ChartPanelBodyFallback,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator, SurfaceBodyStatus } from '~/ui/Status'
import { mergeFailedReads, queryReadFailed, type QueryRetry } from '~/utils/query'
import { carryForwardCumulative, parseDateToUnix, sumDailySeries, type Chart } from './transform'
import { DEX, NETWORK_FEE_DATA_TYPES, networkFeeQuery, PALETTE, THOR_TEAL, withNetworkFee } from './ui'

const MultiSeriesChart: React.FC<IMultiSeriesChartProps> = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const GOLD = '#f5c842'
const THORCHAIN = 'THORChain'

// All from DefiLlama internal APIs (context-free services, no ir-server hop).
type Metric =
	| 'fees'
	| 'revenue'
	| 'volume'
	| 'user-fees'
	| 'holders-revenue'
	| 'protocol-revenue'
	| 'supply-side-revenue'
type View = 'day' | 'month' | 'quarter' | 'cumulative'
type Pts = Array<[number, number]>

const VIEWS: Array<{ value: View; label: string }> = [
	{ value: 'day', label: 'Daily' },
	{ value: 'month', label: 'Monthly' },
	{ value: 'quarter', label: 'Quarterly' },
	{ value: 'cumulative', label: 'Cumulative' }
]

interface RawSeries {
	name: string
	data: Pts
	color?: string
}

// Scrolling top legend + cleared grid top, so many-series legends never overlap the y-axis.
const CHART_OPTIONS = {
	legend: { type: 'scroll', top: CHART_INSET },
	grid: { top: CHART_LEGEND_RESERVE }
} satisfies NonNullable<IMultiSeriesChartProps['chartOptions']>
const QUERY_OPTS = { staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false } as const

function getPaletteColor(index: number): string {
	const paletteIndex = index % PALETTE.length
	for (const [currentIndex, color] of PALETTE.entries()) {
		if (currentIndex === paletteIndex) return color
	}
	throw new Error('THORChain chart palette must not be empty')
}

function pairChartDatesWithValues(dates: Array<string>, values: Array<number | null | undefined>): Pts {
	const points: Pts = []
	for (const [index, date] of dates.entries()) {
		points.push([parseDateToUnix(date), values.at(index) ?? 0])
	}
	return points
}

function aggregate(series: Array<RawSeries>, view: View, stacked: boolean): Array<SparseCartesianSeries> {
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
		return {
			name: s.name,
			color: s.color ? s.color : getPaletteColor(i),
			points
		}
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

function TrendCard({
	title,
	subtitle,
	valueSymbol,
	view,
	setView,
	chartSeries,
	isLoading,
	failedRead
}: {
	title: string
	subtitle?: string
	valueSymbol: string
	view: View
	setView: (v: View) => void
	chartSeries: ReturnType<typeof aggregate>
	isLoading: boolean
	/** The read that failed, or null: its Try again reruns it, and the error stays on screen while it does. */
	failedRead?: QueryRetry | null
}) {
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
		<ChartPanel>
			<ChartPanelToolbar leading={<ChartPanelTitle subtitle={subtitle}>{title}</ChartPanelTitle>}>
				<SegmentedControl
					variant="default"
					size="md"
					label={`${title} period`}
					options={VIEWS}
					value={view}
					onValueChange={setView}
				/>
			</ChartPanelToolbar>
			{failedRead ? (
				<ChartPanelBodyError retry={failedRead}>Failed to load chart data.</ChartPanelBodyError>
			) : isLoading ? (
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator />
				</ChartPanelBodyFallback>
			) : chartSeries.length === 0 ? (
				<SurfaceBodyStatus variant="empty">No data</SurfaceBodyStatus>
			) : (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={model.dataset}
						charts={model.charts}
						valueSymbol={valueSymbol}
						groupBy={groupBy}
						containerClassName={CHART_FILL}
						chartOptions={chartOptions}
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</Suspense>
			)}
		</ChartPanel>
	)
}

// Single metric, broken down by chain (stacked). Used for the by-chain detail on Financials.
export function ChainBreakdownChart({
	metric,
	title,
	subtitle,
	protocol = DEX,
	valueSymbol = '$',
	limit = CHART_SERIES_LIMIT
}: {
	metric: Metric
	title: string
	subtitle?: string
	protocol?: string
	valueSymbol?: string
	limit?: number
}) {
	const [view, setView] = useState<View>('day')
	const breakdown = useQuery<{ series: Array<RawSeries> }>({
		queryKey: ['thorchain-breakdown', protocol, metric, limit],
		queryFn: () => fetchProtocolChainBreakdownData({ protocol, metric, limit }),
		...QUERY_OPTS
	})
	const networkFeeDataType = protocol === DEX ? NETWORK_FEE_DATA_TYPES[metric] : undefined
	const networkFee = useQuery({
		...networkFeeQuery(networkFeeDataType),
		enabled: networkFeeDataType != null
	})
	// The API returns chains unordered and spells the chain "Thorchain" — fix the casing, then
	// order the legend by lifetime size (catch-all "Others" bucket last).
	const series = useMemo(() => {
		const total = (s: RawSeries) => s.data.reduce((t, [, v]) => t + (v || 0), 0)
		const chains = (breakdown.data?.series ?? []).map((s) => (s.name === 'Thorchain' ? { ...s, name: THORCHAIN } : s))
		// The native L1 tx fee comes from its own adapter but is THORChain-chain activity, so it
		// adds to that chain's bucket rather than reading as a separate chain in the legend.
		if (networkFee.data?.length) {
			const index = chains.findIndex((s) => s.name === THORCHAIN)
			const existing = chains[index]
			const merged = {
				...(existing ?? { name: THORCHAIN }),
				data: sumDailySeries(existing ? [existing.data, networkFee.data] : [networkFee.data])
			}
			if (existing) chains[index] = merged
			else chains.push(merged)
		}
		chains.sort((a, b) => {
			const aOthers = a.name.startsWith('Others'),
				bOthers = b.name.startsWith('Others')
			if (aOthers !== bOthers) return aOthers ? 1 : -1
			return total(b) - total(a)
		})
		// Chains take the palette by their rank in this legend, not the server's ranking.
		return chains.map((s, rank) => ({ ...s, color: s.name.startsWith('Others') ? OTHERS_COLOR : chartColor(rank) }))
	}, [breakdown.data, networkFee.data])
	const chartSeries = useMemo(() => aggregate(series, view, true), [series, view])
	return (
		<TrendCard
			title={title}
			{...(subtitle !== undefined ? { subtitle } : {})}
			valueSymbol={valueSymbol}
			view={view}
			setView={setView}
			chartSeries={chartSeries}
			isLoading={breakdown.isLoading || networkFee.isLoading}
			failedRead={queryReadFailed(breakdown) ? breakdown : null}
		/>
	)
}

// An ir-server Chart payload rendered with the same Daily / Monthly / Quarterly /
// Cumulative toggle as the DefiLlama-sourced trend charts. Series sharing a `stack`
// stay stacked in the daily/monthly/quarterly bar views.
export function ApiTrendChart({
	chart,
	subtitle,
	valueSymbol = '$',
	defaultView = 'day'
}: {
	chart?: Chart | null
	subtitle?: string
	valueSymbol?: string
	defaultView?: View
}) {
	const [view, setView] = useState<View>(defaultView)
	const rawSeries = useMemo(() => {
		if (!chart?.dates?.length) return []
		return chart.series.map((s) => ({
			name: s.name,
			data: pairChartDatesWithValues(chart.dates, s.data ?? [])
		}))
	}, [chart])
	const stacked = Boolean(chart?.series?.some((s) => s.stack))
	const chartSeries = useMemo(() => aggregate(rawSeries, view, stacked), [rawSeries, view, stacked])
	const resolvedSubtitle = subtitle ?? chart?.subtitle
	return (
		<TrendCard
			title={chart?.title ?? ''}
			{...(resolvedSubtitle !== undefined ? { subtitle: resolvedSubtitle } : {})}
			valueSymbol={valueSymbol}
			view={view}
			setView={setView}
			chartSeries={chartSeries}
			isLoading={false}
		/>
	)
}

// Two-series overlay with the second series on its own right-hand axis — e.g. the
// RUNE price line over swap-volume bars. Expects an ir-server Chart whose first
// series is the bar (left axis) and second the line (right axis).
export function DualAxisChart({ chart, subtitle }: { chart?: Chart | null; subtitle?: string }) {
	const model = useMemo(() => {
		if (!chart?.dates?.length || chart.series.length === 0) return undefined
		const series: Array<SparseCartesianSeries> = chart.series.map((s, i) => ({
			name: s.name,
			type: s.type === 'bar' ? 'bar' : 'line',
			color: i % 2 === 0 ? THOR_TEAL : GOLD,
			yAxisIndex: i,
			// Keep the overlay line un-filled so it doesn't obscure the bars below.
			...(s.type === 'line' ? { areaStyle: { opacity: 0 } } : {}),
			data: pairChartDatesWithValues(chart.dates, s.data ?? [])
		}))
		return {
			...buildSparseCartesianChartModel(series),
			title: chart.title ?? '',
			subtitle: subtitle ?? chart.subtitle
		}
	}, [chart, subtitle])
	if (!model) return null
	return (
		<ChartPanel>
			<ChartPanelToolbar leading={<ChartPanelTitle subtitle={model.subtitle}>{model.title}</ChartPanelTitle>} />
			<Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={model.dataset}
					charts={model.charts}
					valueSymbol="$"
					groupBy="daily"
					containerClassName={CHART_FILL}
					chartOptions={CHART_OPTIONS}
					hideDefaultLegend={false}
					exportButtons="hidden"
				/>
			</Suspense>
		</ChartPanel>
	)
}

// Fees + Revenue merged (two overlaid totals), each summing the thorchain-dex adapter with the
// native `thorchain` protocol's network fee (NOT the chain-wide aggregate, which folds in
// unaffiliated apps like THORWallet) — same totals as the headline KPIs.
export function FeeRevenueChart({
	title,
	subtitle,
	defaultView = 'cumulative'
}: {
	title: string
	subtitle?: string
	defaultView?: View
}) {
	const [view, setView] = useState<View>(defaultView)
	const fees = useQuery({
		queryKey: ['thorchain-total', 'fees'],
		queryFn: withNetworkFee(ADAPTER_DATA_TYPES.DAILY_FEES),
		...QUERY_OPTS
	})
	const revenue = useQuery({
		queryKey: ['thorchain-total', 'revenue'],
		queryFn: withNetworkFee(ADAPTER_DATA_TYPES.DAILY_REVENUE),
		...QUERY_OPTS
	})
	const rawSeries = useMemo(
		() =>
			[
				fees.data?.length ? { name: 'Fees', data: fees.data, color: THOR_TEAL } : null,
				revenue.data?.length ? { name: 'Revenue', data: revenue.data, color: GOLD } : null
			].filter((series) => series != null),
		[fees.data, revenue.data]
	)
	const chartSeries = useMemo(() => aggregate(rawSeries, view, false), [rawSeries, view])
	return (
		<TrendCard
			title={title}
			{...(subtitle !== undefined ? { subtitle } : {})}
			valueSymbol="$"
			view={view}
			setView={setView}
			chartSeries={chartSeries}
			isLoading={fees.isLoading || revenue.isLoading}
			failedRead={mergeFailedReads([queryReadFailed(fees) ? fees : null, queryReadFailed(revenue) ? revenue : null])}
		/>
	)
}
