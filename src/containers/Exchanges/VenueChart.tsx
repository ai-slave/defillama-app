import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ExchangeOverviewChartModel } from './models'
import { EXCHANGES_QUERY_KEYS, getVenueHistoryMetric, type VenueHistoryMetric } from './queryState'
import { useLazyVisible } from './useLazyVisible'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const STALE_TIME = 60 * 60 * 1000
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
}

interface MetricTab {
	id: VenueHistoryMetric
	label: string
	valueSymbol: string
	// Flow metrics render as bars; point-in-time levels render as lines.
	type: 'bar' | 'line'
	stack?: string
	series: MetricSeriesSpec[]
}

const SEGMENT_COLORS = { spot: '#5c9cf5', linear: '#9b7cf7', inverse: '#33b38f' }

// One tab per metric; each keeps spot, linear perp, and inverse perp lines separate.
// Tabs with no data for a venue are hidden.
const VENUE_TABS: MetricTab[] = [
	{
		id: 'volume',
		label: 'Volume',
		valueSymbol: '$',
		type: 'bar',
		stack: 'volume',
		series: [
			{ key: 'spot_volume', label: 'Spot', color: SEGMENT_COLORS.spot },
			{ key: 'linear_perp_volume', label: 'Linear Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_volume', label: 'Inverse Perps', color: SEGMENT_COLORS.inverse }
		]
	},
	{
		id: 'oi',
		label: 'Open interest',
		valueSymbol: '$',
		type: 'line',
		series: [
			{ key: 'linear_perp_oi', label: 'Linear Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_oi', label: 'Inverse Perps', color: SEGMENT_COLORS.inverse }
		]
	},
	{
		id: 'depth',
		label: 'Depth ±2%',
		valueSymbol: '$',
		type: 'line',
		series: [
			{ key: 'spot_depth_2pct', label: 'Spot', color: SEGMENT_COLORS.spot },
			{ key: 'linear_perp_depth_2pct', label: 'Linear Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_depth_2pct', label: 'Inverse Perps', color: SEGMENT_COLORS.inverse }
		]
	},
	{
		id: 'nvol',
		label: 'Normalized vol',
		valueSymbol: '$',
		type: 'bar',
		stack: 'nvol',
		series: [
			{ key: 'spot_normalized_volume', label: 'Spot', color: SEGMENT_COLORS.spot },
			{ key: 'linear_perp_normalized_volume', label: 'Linear Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_normalized_volume', label: 'Inverse Perps', color: SEGMENT_COLORS.inverse }
		]
	},
	{
		id: 'markets',
		label: 'Markets',
		valueSymbol: '',
		type: 'line',
		series: [
			{ key: 'spot_market_count', label: 'Spot', color: SEGMENT_COLORS.spot },
			{ key: 'linear_perp_market_count', label: 'Linear Perps', color: SEGMENT_COLORS.linear },
			{ key: 'inverse_perp_market_count', label: 'Inverse Perps', color: SEGMENT_COLORS.inverse }
		]
	}
]

export const hasObservedHistory = (values: Array<number | null> | undefined): boolean =>
	values?.some((value) => value !== null) ?? false

export function VenueChart({
	exchange,
	loadSeries
}: {
	exchange: string
	loadSeries: (exchange: string) => Promise<ExchangeOverviewChartModel>
}) {
	const router = useRouter()
	const { ref, visible } = useLazyVisible<HTMLDivElement>()
	const query = useQuery({
		queryKey: ['exchange-venue-series', exchange],
		queryFn: () => loadSeries(exchange),
		enabled: visible,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
	const requestedMetric = getVenueHistoryMetric(router.query)
	const fallbackMetric = requestedMetric ?? VENUE_TABS[0].id

	return (
		<div ref={ref}>
			{query.data ? (
				<VenueChartView chart={query.data} />
			) : (
				<VenueChartFrame tabs={VENUE_TABS} activeId={fallbackMetric} updatedAt={null}>
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

function VenueChartView({ chart }: { chart: ExchangeOverviewChartModel }) {
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

	const chartModel = React.useMemo(
		() =>
			buildAlignedCartesianChartModel(
				chart.days,
				(active?.series ?? []).map(({ spec, values }) => ({
					name: spec.label,
					type: active?.type ?? 'line',
					color: spec.color,
					stack: active?.type === 'bar' ? active.stack : undefined,
					values
				}))
			),
		[active, chart.days]
	)

	if (!active) {
		return (
			<VenueChartFrame tabs={[]} activeId={VENUE_TABS[0].id} updatedAt={chart.lastUpdated}>
				<ChartPanelBodyFallback className="body-sm text-tertiary">
					No time-series data is available for this venue.
				</ChartPanelBodyFallback>
			</VenueChartFrame>
		)
	}

	return (
		<VenueChartFrame tabs={tabs} activeId={active.id} updatedAt={chart.lastUpdated}>
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
					/>
				</ChartPanelBody>
			</React.Suspense>
		</VenueChartFrame>
	)
}

function VenueChartFrame({
	tabs,
	activeId,
	updatedAt,
	children
}: {
	tabs: Array<Pick<MetricTab, 'id' | 'label'>>
	activeId: VenueHistoryMetric
	updatedAt: string | null
	children: React.ReactNode
}) {
	const router = useRouter()
	return (
		<ChartPanel>
			<ChartPanelToolbar className="justify-end">
				{tabs.length > 1 ? (
					<SegmentedControl<VenueHistoryMetric>
						value={activeId}
						onValueChange={(nextMetric) => {
							void pushShallowQuery(router, {
								[EXCHANGES_QUERY_KEYS.venueHistory]: nextMetric === tabs[0].id ? undefined : nextMetric
							})
						}}
						options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
						label="Chart metric"
						variant="default"
						size="md"
					/>
				) : null}
			</ChartPanelToolbar>
			{children}
			{/* Keep loading, error, empty, and ready panels the same height. */}
			<p
				aria-hidden={updatedAt ? undefined : true}
				className={`px-2 pt-0 pb-2 text-right body-sm text-tertiary ${updatedAt ? '' : 'invisible'}`.trim()}
			>
				{updatedAt ? `Last updated ${UTC_TIMESTAMP.format(new Date(updatedAt))}` : 'Last updated'}
			</p>
		</ChartPanel>
	)
}
