import { useQuery } from '@tanstack/react-query'
import { lazy, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel, type SparseCartesianSeries } from '~/components/ECharts/MultiSeriesChart/model'
import { createCappedRemainderTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE } from '~/components/ECharts/shared/chartSpacing'
import ProtocolChartBuilderData from '~/containers/ProDashboard/services/ProtocolChartBuilderData'
import ProtocolCharts from '~/containers/ProDashboard/services/ProtocolCharts'
import { getGroupedTimestampSec } from '~/containers/ProDashboard/utils'
import { parseDateToUnix, type Chart } from './transform'
import { ChartCard, PALETTE, SegToggle, THOR_TEAL } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const DEX = 'thorchain-dex'
const GOLD = '#f5c842'

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

const VIEWS: { value: View; label: string }[] = [
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

function aggregate(series: RawSeries[], view: View, stacked: boolean) {
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
		return {
			name: s.name,
			color: s.color || PALETTE[i % PALETTE.length],
			points
		}
	})
	const useArea = stacked || agg.length === 1
	return agg.map((s) => ({
		name: s.name,
		data: s.points,
		color: s.color,
		type: (view === 'cumulative' ? 'line' : 'bar') as 'line' | 'bar',
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
	isError
}: {
	title: string
	subtitle?: string
	valueSymbol: string
	view: View
	setView: (v: View) => void
	chartSeries: ReturnType<typeof aggregate>
	isLoading: boolean
	isError?: boolean
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
		<ChartCard
			title={title}
			subtitle={subtitle}
			control={<SegToggle options={VIEWS} value={view} onChange={setView} />}
		>
			{isLoading ? (
				<div className="flex h-[360px] items-center justify-center text-xs text-pro-text-tertiary">Loading…</div>
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

// Single metric, broken down by chain (stacked). Used for the by-chain detail on Financials.
export function ChainBreakdownChart({
	metric,
	title,
	subtitle,
	protocol = DEX,
	valueSymbol = '$',
	limit = 12
}: {
	metric: Metric
	title: string
	subtitle?: string
	protocol?: string
	valueSymbol?: string
	limit?: number
}) {
	const [view, setView] = useState<View>('day')
	const { data, isLoading, isError } = useQuery<{ series: RawSeries[] }>({
		queryKey: ['thorchain-breakdown', protocol, metric, limit],
		queryFn: () => ProtocolChartBuilderData.getProtocolChainData(protocol, metric, undefined, limit),
		...QUERY_OPTS
	})
	// The API returns chains unordered and spells the chain "Thorchain" — order the
	// legend by lifetime size (catch-all "Others" bucket last) and fix the casing.
	const series = useMemo(() => {
		const total = (s: RawSeries) => s.data.reduce((t, [, v]) => t + (v || 0), 0)
		return (data?.series ?? [])
			.map((s) => (s.name === 'Thorchain' ? { ...s, name: 'THORChain' } : s))
			.sort((a, b) => {
				const aOthers = a.name.startsWith('Others'),
					bOthers = b.name.startsWith('Others')
				if (aOthers !== bOthers) return aOthers ? 1 : -1
				return total(b) - total(a)
			})
	}, [data])
	const chartSeries = useMemo(() => aggregate(series, view, true), [series, view])
	return (
		<TrendCard
			title={title}
			subtitle={subtitle}
			valueSymbol={valueSymbol}
			view={view}
			setView={setView}
			chartSeries={chartSeries}
			isLoading={isLoading}
			isError={isError}
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
			data: chart.dates.map((d, i) => [parseDateToUnix(d), s.data?.[i] ?? 0] as [number, number])
		}))
	}, [chart])
	const stacked = Boolean(chart?.series?.some((s) => s.stack))
	const chartSeries = useMemo(() => aggregate(rawSeries, view, stacked), [rawSeries, view, stacked])
	return (
		<TrendCard
			title={chart?.title ?? ''}
			subtitle={subtitle ?? chart?.subtitle}
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
		if (!chart?.dates?.length || !chart.series.length) return undefined
		const colors = [THOR_TEAL, GOLD]
		const series: SparseCartesianSeries[] = chart.series.map((s, i) => ({
			name: s.name,
			type: (s.type ?? 'line') as 'line' | 'bar',
			color: colors[i % colors.length],
			yAxisIndex: i,
			// Keep the overlay line un-filled so it doesn't obscure the bars below.
			...(s.type === 'line' ? { areaStyle: { opacity: 0 } } : {}),
			data: chart.dates.map((d, j) => [parseDateToUnix(d), s.data?.[j] ?? 0] as [number, number])
		}))
		return buildSparseCartesianChartModel(series)
	}, [chart])
	if (!model) return null
	return (
		<ChartCard title={chart.title ?? ''} subtitle={subtitle ?? chart.subtitle}>
			<MultiSeriesChart
				dataset={model.dataset}
				charts={model.charts}
				valueSymbol="$"
				groupBy="daily"
				height="360px"
				chartOptions={CHART_OPTIONS}
				hideDefaultLegend={false}
				exportButtons="hidden"
			/>
		</ChartCard>
	)
}

// Fees + Revenue merged (two overlaid totals), both from the protocol fees adapter so the
// chain figures match defillama.com/chain/thorchain. `chain` → native `thorchain` protocol
// (NOT the chain-wide aggregate, which folds in unaffiliated apps like THORWallet); `dex` → thorchain-dex.
function totalFn(source: 'chain' | 'dex', metric: 'fees' | 'revenue'): () => Promise<Pts> {
	const protocol = source === 'chain' ? 'thorchain' : DEX
	return metric === 'fees' ? () => ProtocolCharts.fees(protocol) : () => ProtocolCharts.revenue(protocol)
}

export function FeeRevenueChart({
	source,
	title,
	subtitle,
	defaultView = 'cumulative'
}: {
	source: 'chain' | 'dex'
	title: string
	subtitle?: string
	defaultView?: View
}) {
	const [view, setView] = useState<View>(defaultView)
	const fees = useQuery({
		queryKey: ['thorchain-total', source, 'fees'],
		queryFn: totalFn(source, 'fees'),
		...QUERY_OPTS
	})
	const revenue = useQuery({
		queryKey: ['thorchain-total', source, 'revenue'],
		queryFn: totalFn(source, 'revenue'),
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
			subtitle={subtitle}
			valueSymbol="$"
			view={view}
			setView={setView}
			chartSeries={chartSeries}
			isLoading={fees.isLoading || revenue.isLoading}
			isError={fees.isError || revenue.isError}
		/>
	)
}
