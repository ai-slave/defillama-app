import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { pushShallowQuery } from '~/utils/routerQuery'
import { collectionHallmarks, hallmarkMetricsForKeys } from './chartHallmarks'
import { ChartRangeControl } from './ChartRangeControl'
import type { ExchangeOverviewChartModel } from './models'
import {
	DEFAULT_RESEARCH_RANGE,
	EXCHANGES_QUERY_KEYS,
	getResearchRange,
	getVenueHistoryMetric,
	type ExchangeResearchRange,
	type VenueHistoryMetric
} from './queryState'
import { useLazyVisible } from './useLazyVisible'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const STALE_TIME = 60 * 60 * 1000
const DEFAULT_VENUE_METRIC: VenueHistoryMetric = 'volume'
const UTC_TIMESTAMP = new Intl.DateTimeFormat('en', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'UTC',
	timeZoneName: 'short'
})

interface MetricSeriesSpec {
	/** One exact venue-series column per line; perpetual classes are never summed. */
	key: string
	label: string
	color: string
	/** Overrides the tab's stack so two bar groups can sit side by side (reported vs normalized). */
	stack?: string
}

interface MetricTab {
	id: VenueHistoryMetric
	label: string
	valueSymbol: string
	// Flow metrics render as bars; point-in-time levels render as lines.
	type: 'bar' | 'line'
	stack?: string
	series: Array<MetricSeriesSpec>
}

const SEGMENT_COLORS = { spot: '#5c9cf5', linear: '#9b7cf7', inverse: '#33b38f' }

// One tab per metric; each keeps spot, linear perp, and inverse perp lines separate.
// Tabs with no data for a venue are hidden.
const VENUE_TABS: Array<MetricTab> = [
	{
		id: 'volume',
		label: 'Volume',
		valueSymbol: '$',
		type: 'bar',
		stack: 'volume',
		// Normalized volume rides beside reported as a lighter stack; its history is shorter,
		// and a hallmark marks the first day it exists (see VenueChartView). COIN perps have
		// no normalized-volume band, so no twin.
		series: [
			{ key: 'spot_volume', label: 'Spot', color: SEGMENT_COLORS.spot },
			{ key: 'linear_perp_volume', label: 'USD Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_volume', label: 'COIN Perps', color: SEGMENT_COLORS.inverse },
			{ key: 'spot_normalized_volume', label: 'Spot normalized', color: `${SEGMENT_COLORS.spot}66`, stack: 'nvol' },
			{
				key: 'linear_perp_normalized_volume',
				label: 'USD Perps normalized',
				color: `${SEGMENT_COLORS.linear}66`,
				stack: 'nvol'
			}
		]
	},
	{
		id: 'oi',
		label: 'Open interest',
		valueSymbol: '$',
		type: 'line',
		series: [
			{ key: 'linear_perp_oi', label: 'USD Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_oi', label: 'COIN Perps', color: SEGMENT_COLORS.inverse }
		]
	},
	{
		id: 'depth',
		label: 'Depth ±2%',
		valueSymbol: '$',
		type: 'line',
		series: [
			{ key: 'spot_depth_2pct', label: 'Spot', color: SEGMENT_COLORS.spot },
			{ key: 'linear_perp_depth_2pct', label: 'USD Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_depth_2pct', label: 'COIN Perps', color: SEGMENT_COLORS.inverse }
		]
	},
	{
		id: 'markets',
		label: 'Markets',
		valueSymbol: '',
		type: 'line',
		series: [
			{ key: 'spot_market_count', label: 'Spot', color: SEGMENT_COLORS.spot },
			{ key: 'linear_perp_market_count', label: 'USD Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_market_count', label: 'COIN Perps', color: SEGMENT_COLORS.inverse }
		]
	}
]

export const hasObservedHistory = (values: Array<number | null> | undefined): boolean =>
	values?.some((value) => value !== null) ?? false

export function VenueChart({
	exchange,
	loadSeries,
	showGlobalDataNotice
}: {
	exchange: string
	loadSeries: (exchange: string, range: ExchangeResearchRange) => Promise<ExchangeOverviewChartModel>
	showGlobalDataNotice: boolean
}) {
	const router = useRouter()
	const range = getResearchRange(router.query)
	const { ref, visible } = useLazyVisible<HTMLDivElement>()
	const query = useQuery({
		queryKey: ['exchange-venue-series', exchange, range],
		queryFn: () => loadSeries(exchange, range),
		enabled: visible,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
	const requestedMetric = getVenueHistoryMetric(router.query)
	const fallbackMetric = requestedMetric ?? DEFAULT_VENUE_METRIC

	return (
		<div ref={ref}>
			{query.data ? (
				<VenueChartView chart={query.data} range={range} showGlobalDataNotice={showGlobalDataNotice} />
			) : (
				<VenueChartFrame
					tabs={VENUE_TABS}
					activeId={fallbackMetric}
					range={range}
					updatedAt={null}
					showGlobalDataNotice={showGlobalDataNotice}
				>
					<ChartPanelBodyFallback
						role={query.isError ? 'alert' : 'status'}
						aria-live={query.isError ? undefined : 'polite'}
						className={query.isError ? 'body-sm text-data-down' : undefined}
					>
						{query.isError ? 'Failed to load venue history.' : <LoadingIndicator />}
					</ChartPanelBodyFallback>
				</VenueChartFrame>
			)}
		</div>
	)
}

function VenueChartView({
	chart,
	range,
	showGlobalDataNotice
}: {
	chart: ExchangeOverviewChartModel
	range: ExchangeResearchRange
	showGlobalDataNotice: boolean
}) {
	const router = useRouter()
	const tabs = React.useMemo(
		() =>
			VENUE_TABS.map((tab) => ({
				...tab,
				series: tab.series.flatMap((spec) => {
					const values = chart.series[spec.key]
					return values && hasObservedHistory(values) ? [{ spec, values }] : []
				})
			})).filter((tab) => tab.series.length > 0),
		[chart.series]
	)
	const requestedMetric = getVenueHistoryMetric(router.query)
	const active = tabs.find((tab) => tab.id === requestedMetric) ?? tabs[0]
	// Same collection notes as the listing: a coverage step looks like a market move on
	// a venue chart too.
	const hallmarks = React.useMemo(() => {
		const series = active?.series ?? []
		const marks = collectionHallmarks(hallmarkMetricsForKeys(series.map(({ spec }) => spec.key)))
		// Normalized volume has a shorter history than reported volume: mark the first day it
		// exists so the lighter bars appearing mid-chart read as our coverage, not a market move.
		// Only when it starts strictly after reported — a venue listed mid-window has both
		// series begin together, and that is a listing, not a coverage step.
		const firstIndex = (values: ReadonlyArray<number | null>) => values.findIndex((value) => value !== null)
		const firstReported = Math.min(
			...series
				.filter(({ spec }) => spec.key.endsWith('_volume') && !spec.key.includes('normalized'))
				.map(({ values }) => firstIndex(values))
				.filter((index) => index >= 0)
		)
		const firstNormalized = series
			.filter(({ spec }) => spec.key.endsWith('_normalized_volume'))
			.map(({ values }) => firstIndex(values))
			.filter((index) => index > 0 && index > firstReported)
		if (firstNormalized.length > 0) {
			const day = chart.days[Math.min(...firstNormalized)]
			if (day != null) marks.push([day, 'Normalized volume starts'])
		}
		return marks.sort((a, b) => a[0] - b[0])
	}, [active, chart.days])
	const chartModel = React.useMemo(
		() =>
			buildAlignedCartesianChartModel(
				chart.days,
				(active?.series ?? []).map(({ spec, values }) => ({
					name: spec.label,
					type: active?.type ?? 'line',
					color: spec.color,
					...(active?.type === 'bar' && (spec.stack ?? active.stack) ? { stack: spec.stack ?? active.stack } : null),
					values
				}))
			),
		[active, chart.days]
	)

	if (!active) {
		return (
			<VenueChartFrame
				tabs={[]}
				activeId={DEFAULT_VENUE_METRIC}
				updatedAt={chart.lastUpdated}
				showGlobalDataNotice={showGlobalDataNotice}
			>
				<ChartPanelBodyFallback className="body-sm text-tertiary">
					No time-series data is available for this venue.
				</ChartPanelBodyFallback>
			</VenueChartFrame>
		)
	}

	return (
		<VenueChartFrame
			tabs={tabs}
			activeId={active.id}
			range={range}
			updatedAt={chart.lastUpdated}
			showGlobalDataNotice={showGlobalDataNotice}
		>
			{/* key forces a fresh chart per metric so series and value units are replaced, not merged. */}
			<React.Suspense
				fallback={
					<ChartPanelBodyFallback>
						<LoadingIndicator />
					</ChartPanelBodyFallback>
				}
			>
				<ChartPanelBody role="img" aria-label={`${active.label} history for this venue.`}>
					<MultiSeriesChart
						key={active.id}
						dataset={chartModel.dataset}
						charts={chartModel.charts}
						valueSymbol={active.valueSymbol}
						height="360px"
						hideDefaultLegend={false}
						exportButtons="hidden"
						hallmarks={hallmarks}
					/>
				</ChartPanelBody>
			</React.Suspense>
		</VenueChartFrame>
	)
}

function VenueChartFrame({
	tabs,
	activeId,
	range = DEFAULT_RESEARCH_RANGE,
	updatedAt,
	showGlobalDataNotice,
	children
}: {
	tabs: Array<Pick<MetricTab, 'id' | 'label'>>
	activeId: VenueHistoryMetric
	range?: ExchangeResearchRange
	updatedAt: string | null
	showGlobalDataNotice: boolean
	children: React.ReactNode
}) {
	const router = useRouter()
	return (
		<ChartPanel>
			<ChartPanelToolbar>
				{tabs.length > 1 ? (
					<SegmentedControl<VenueHistoryMetric>
						value={activeId}
						onValueChange={(nextMetric) => {
							void pushShallowQuery(router, {
								[EXCHANGES_QUERY_KEYS.venueHistory]: nextMetric === tabs[0]?.id ? undefined : nextMetric
							})
						}}
						options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
						label="Chart metric"
						variant="default"
						size="md"
					/>
				) : null}
				<ChartRangeControl range={range} />
			</ChartPanelToolbar>
			{children}
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pt-0 pb-2 body-sm text-tertiary">
				{showGlobalDataNotice ? <p>Totals and chart show global data</p> : null}
				{/* Keep loading, error, empty, and ready panels the same height. */}
				<p aria-hidden={updatedAt ? undefined : true} className={`ml-auto ${updatedAt ? '' : 'invisible'}`.trim()}>
					{updatedAt ? `Last updated ${UTC_TIMESTAMP.format(new Date(updatedAt))}` : 'Last updated'}
				</p>
			</div>
		</ChartPanel>
	)
}
