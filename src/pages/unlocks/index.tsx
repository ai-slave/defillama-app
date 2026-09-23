import { useRouter } from 'next/router'
import * as React from 'react'
import { lazy, useMemo } from 'react'
import { Announcement } from '~/components/Announcement'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	buildSelectedAdditiveChart,
	rankSeriesByPeakAbsoluteValue
} from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { BasicLink } from '~/components/Link'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { PastUnlockPriceImpact } from '~/containers/Unlocks/PastUnlockPriceImpact'
import { getAllProtocolEmissions, type EnrichedProtocolEmission } from '~/containers/Unlocks/queries'
import { UnlocksTable } from '~/containers/Unlocks/Table'
import { TopUnlocks } from '~/containers/Unlocks/TopUnlocks'
import {
	buildUpcomingUnlockChart,
	buildUpcomingUnlockSeries,
	calculateUpcomingUnlockStatistics,
	type UpcomingUnlockChartSeries,
	type UpcomingUnlockValueBreakdown
} from '~/containers/Unlocks/upcomingUnlockChart'
import {
	getUpcomingUnlockGroupByQueryValue,
	getUpcomingUnlockTypeLabel,
	getUpcomingUnlockTypeQueryValue,
	getUpcomingUnlockViewModeQueryValue,
	parseUpcomingUnlockChartState,
	UPCOMING_UNLOCK_CHART_QUERY_KEYS,
	UPCOMING_UNLOCK_TYPE_HELP,
	UPCOMING_UNLOCK_TYPE_OPTIONS,
	UPCOMING_UNLOCK_VIEW_MODES
} from '~/containers/Unlocks/upcomingUnlockChartState'
import { useWatchlistManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { TagGroup } from '~/ui/SegmentedControl'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const SECONDS_PER_DAY = 24 * 60 * 60
const UPCOMING_WINDOW_DAYS = 30

export const getStaticProps = withPerformanceLogging('unlocks', async () => {
	const requestedAtSec = Math.floor(Date.now() / 1000)
	const requestedChartEndTimestampSec = requestedAtSec + UPCOMING_WINDOW_DAYS * SECONDS_PER_DAY
	const metadataModule = await import('~/utils/metadata')
	metadataModule.refreshMetadataInBackgroundIfStale('unlocks_index')
	const metadataCache = metadataModule.default
	const data = await getAllProtocolEmissions({
		endDate: requestedChartEndTimestampSec,
		tokenlist: metadataCache.tokenlist,
		emissionsHistoricalPrices: metadataCache.emissionsHistoricalPrices
	})
	const generatedAtSec = data[0]?.supplyGeneratedAtSec ?? requestedAtSec
	const chartEndTimestampSec = generatedAtSec + UPCOMING_WINDOW_DAYS * SECONDS_PER_DAY
	return {
		props: {
			data,
			unlockChartSeries: buildUpcomingUnlockSeries(data, generatedAtSec, chartEndTimestampSec),
			generatedAtSec
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', 'Token Unlocks']

const EMPTY_CHART_RESULT = {
	dataset: {
		source: [],
		dimensions: ['timestamp']
	} satisfies MultiSeriesChartDataset,
	charts: [] as NonNullable<IMultiSeriesChartProps['charts']>
}

function UpcomingUnlockMetric({ days, values }: { days: 7 | 30; values: UpcomingUnlockValueBreakdown }) {
	return (
		<MetricSection
			label={`Upcoming Unlocks (${days}d)`}
			tooltip={`Combined cliff and linear unlock value over the exact ${days}-day period. USD values use token prices from the data snapshot, not projected prices. Events without a known amount or valid snapshot price are excluded.`}
			value={formatUsd(values.total, USD_LOWERCASE_MILLIONS_OPTIONS)}
		>
			<SubMetricRow
				label="Cliff Unlocks"
				tooltip={UPCOMING_UNLOCK_TYPE_HELP.cliff}
				value={formatUsd(values.cliff, USD_LOWERCASE_MILLIONS_OPTIONS)}
			/>
			<SubMetricRow
				label="Linear Unlocks"
				tooltip={UPCOMING_UNLOCK_TYPE_HELP.linear}
				value={formatUsd(values.linear, USD_LOWERCASE_MILLIONS_OPTIONS)}
			/>
		</MetricSection>
	)
}

function UpcomingUnlockVolumeChart({ series }: { series: Array<UpcomingUnlockChartSeries> }) {
	const router = useRouter()
	const { groupBy: timePeriod, unlockType, viewMode } = parseUpcomingUnlockChartState(router.query)
	const unlockTypeLabel = getUpcomingUnlockTypeLabel(unlockType)

	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const unlockChartData = useMemo(() => {
		if (series.length === 0) return EMPTY_CHART_RESULT
		return buildUpcomingUnlockChart({
			series,
			groupBy: timePeriod,
			viewMode,
			unlockType
		})
	}, [series, timePeriod, unlockType, viewMode])
	const chartPresentation = useMemo(
		() => ({ chartData: unlockChartData, timePeriod, unlockType, viewMode }),
		[timePeriod, unlockChartData, unlockType, viewMode]
	)
	const deferredChartPresentation = React.useDeferredValue(chartPresentation)
	const {
		chartData: deferredChartData,
		timePeriod: deferredTimePeriod,
		unlockType: deferredUnlockType,
		viewMode: deferredViewMode
	} = deferredChartPresentation
	const protocolSeries = useMemo(
		() =>
			deferredViewMode === 'Breakdown View'
				? rankSeriesByPeakAbsoluteValue(
						deferredChartData.dataset,
						deferredChartData.charts.map((chart) => chart.name)
					)
				: [],
		[deferredChartData, deferredViewMode]
	)
	const { activeSeries, selectedCharts, setSelectedSeries } = useSeriesSelection({
		availableSeries: protocolSeries,
		selectionKey: `${deferredViewMode}:${deferredUnlockType}`
	})
	const selectedBreakdown = useMemo(
		() =>
			deferredViewMode === 'Breakdown View'
				? buildSelectedAdditiveChart({
						dataset: deferredChartData.dataset,
						charts: deferredChartData.charts,
						seriesOrder: protocolSeries,
						selectedCharts
					})
				: null,
		[deferredChartData, deferredViewMode, protocolSeries, selectedCharts]
	)

	return (
		<>
			<ChartPanelToolbar className="justify-end">
				<div className="mr-auto">
					<Select
						allValues={UPCOMING_UNLOCK_TYPE_OPTIONS}
						selectedValues={unlockType}
						setSelectedValues={(value: string) => {
							const selectedType = UPCOMING_UNLOCK_TYPE_OPTIONS.find((option) => option.key === value)?.key
							if (!selectedType) throw new Error(`Unknown upcoming unlock type: ${value}`)
							void pushShallowQuery(router, {
								[UPCOMING_UNLOCK_CHART_QUERY_KEYS.unlockType]: getUpcomingUnlockTypeQueryValue(selectedType)
							})
						}}
						label={unlockTypeLabel}
						labelType="none"
						variant="filter"
						size="md"
						triggerProps={{ 'aria-label': 'Upcoming unlock type' }}
					/>
				</div>
				<ChartGroupingSelector
					value={timePeriod}
					onValueChange={(value) => {
						void pushShallowQuery(router, {
							[UPCOMING_UNLOCK_CHART_QUERY_KEYS.groupBy]: getUpcomingUnlockGroupByQueryValue(value)
						})
					}}
					options={DWM_GROUPING_OPTIONS_LOWERCASE}
				/>
				<div className="flex items-center gap-1">
					<TagGroup
						variant="default"
						size="md"
						selectedValue={viewMode}
						setValue={(value) => {
							void pushShallowQuery(router, {
								[UPCOMING_UNLOCK_CHART_QUERY_KEYS.viewMode]: getUpcomingUnlockViewModeQueryValue(value)
							})
						}}
						values={UPCOMING_UNLOCK_VIEW_MODES}
					/>
					<Tooltip
						content="Total View aggregates the selected unlock type across all protocols. Breakdown View stacks the same value by protocol."
						render={<button type="button" aria-label="Explain chart views" className="cursor-help text-tertiary" />}
					>
						<Icon name="help-circle" height={16} width={16} aria-hidden="true" />
					</Tooltip>
				</div>
				{protocolSeries.length > 1 ? (
					<SelectWithCombobox
						allValues={protocolSeries}
						selectedValues={activeSeries}
						setSelectedValues={setSelectedSeries}
						label="Protocol"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				{deferredChartData.dataset.source.length > 0 ? (
					<ChartExportButtons
						chartInstance={exportChartInstance}
						filename={`${unlockType}-upcoming-unlocks`}
						title={unlockType === 'all' ? 'Upcoming Unlocks' : `Upcoming ${unlockTypeLabel}`}
						csvSource={{
							type: 'dataset',
							prepare: () => ({ ...deferredChartData.dataset, groupBy: deferredTimePeriod })
						}}
					/>
				) : null}
			</ChartPanelToolbar>
			{deferredChartData.dataset.source.length > 0 ? (
				<React.Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={selectedBreakdown?.dataset ?? deferredChartData.dataset}
						charts={selectedBreakdown?.charts ?? deferredChartData.charts}
						hideDefaultLegend={deferredViewMode === 'Total View'}
						groupBy={deferredTimePeriod}
						valueSymbol="$"
						onReady={handleChartReady}
					/>
				</React.Suspense>
			) : (
				<p className="flex items-center justify-center" style={{ height: '360px' }}>
					No upcoming unlock data available for the selected period.
				</p>
			)}
		</>
	)
}

export default function Protocols({
	data,
	unlockChartSeries,
	generatedAtSec
}: {
	data: Array<EnrichedProtocolEmission>
	unlockChartSeries: Array<UpcomingUnlockChartSeries>
	generatedAtSec: number
}) {
	const { savedProtocols } = useWatchlistManager('defi')
	const router = useRouter()

	const showOnlyWatchlist = readSingleQueryValue(router.query.watchlist) === 'true'

	const { upcomingUnlocks7d, upcomingUnlocks30d } = useMemo(
		() => calculateUpcomingUnlockStatistics(data, generatedAtSec),
		[data, generatedAtSec]
	)
	const totalProtocols = data.length

	return (
		<Layout
			title="Token Unlocks & Vesting Schedules - DefiLlama"
			description="Track upcoming token unlocks and vesting schedules for 500+ DeFi protocols. Monitor unlock dates, amounts, and price impact. Real-time token unlock calendar with 7-day and 30-day unlock analytics."
			canonicalUrl="/unlocks"
			pageName={pageName}
		>
			<Announcement notCancellable>
				<span>Are we missing any protocol?</span>{' '}
				<a
					href="https://airtable.com/shrD1bSGYNcdFQ6kd"
					className="font-medium text-link underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					Add it here!
				</a>
			</Announcement>

			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="heading-sm">Unlock Statistics</h1>
					<div className="flex flex-col">
						<UpcomingUnlockMetric days={7} values={upcomingUnlocks7d} />
						<UpcomingUnlockMetric days={30} values={upcomingUnlocks30d} />
						<MetricRow label="Total Protocols Tracked" value={totalProtocols} />
					</div>
					<BasicLink
						href="/unlocks/calendar"
						className="mt-auto flex items-center justify-center gap-1 rounded-md border border-medium px-2 py-1.5 text-secondary hover:bg-hover-row focus-visible:bg-hover-row"
					>
						<span>View unlocks calendar</span>
						<Icon name="arrow-right" className="size-4" />
					</BasicLink>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<UpcomingUnlockVolumeChart series={unlockChartSeries} />
				</ChartPanel>
			</SummaryCardGrid>

			<div className="isolate grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<TopUnlocks data={data} period={1} title="Past 24h Top Unlocks" initialNowSec={generatedAtSec} />
				</Card>

				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<TopUnlocks data={data} period={30} title="Past 30d Top Unlocks" initialNowSec={generatedAtSec} />
				</Card>

				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<PastUnlockPriceImpact data={data} title="7d Price Change After Unlock" initialNowSec={generatedAtSec} />
				</Card>
			</div>

			<UnlocksTable protocols={data} showOnlyWatchlist={showOnlyWatchlist} savedProtocols={savedProtocols} />
		</Layout>
	)
}
