import { useRouter } from 'next/router'
import * as React from 'react'
import { lazy, useMemo } from 'react'
import { Announcement } from '~/components/Announcement'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	buildSelectedAdditiveChart,
	rankSeriesByPeakAbsoluteValue,
	selectChartDatasetColumns
} from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { BasicLink } from '~/components/Link'
import { useLocalSelection } from '~/components/Select/localSelection'
import { PastUnlockPriceImpact } from '~/containers/Unlocks/PastUnlockPriceImpact'
import { getAllProtocolEmissions, type EnrichedProtocolEmission } from '~/containers/Unlocks/queries'
import { getUnlockTypes, hasActiveUnlockTableFilters, UnlocksTable } from '~/containers/Unlocks/Table'
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
	getUpcomingUnlockTypeQueryUpdates,
	getUpcomingUnlockViewModeQueryValue,
	parseUpcomingUnlockChartState,
	UPCOMING_UNLOCK_CHART_QUERY_KEYS,
	UPCOMING_UNLOCK_TYPE_HELP,
	UPCOMING_UNLOCK_TYPE_OPTIONS,
	UPCOMING_UNLOCK_VIEW_MODES
} from '~/containers/Unlocks/upcomingUnlockChartState'
import { useWatchlistManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { ScopeNote } from '~/ui/ScopeNote'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Select } from '~/ui/Select'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
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

function UpcomingUnlockVolumeChart({
	series,
	ignoresTableFilters
}: {
	series: Array<UpcomingUnlockChartSeries>
	ignoresTableFilters: boolean
}) {
	const router = useRouter()
	const { groupBy: timePeriod, unlockType, viewMode } = parseUpcomingUnlockChartState(router.query)
	const unlockTypeLabel = getUpcomingUnlockTypeLabel(unlockType)

	const exportChartExport = useGetChartInstance()

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
	const { activeSeries, selectedCharts, setSelectedSeries } = useLocalSelection({
		availableSeries: protocolSeries,
		scope: `${deferredViewMode}:${deferredUnlockType}`
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
			<ChartPanelToolbar>
				<div className="mr-auto">
					<Select
						heading="Release type"
						allValues={UPCOMING_UNLOCK_TYPE_OPTIONS}
						selectedValues={unlockType}
						setSelectedValues={(value: string) => {
							const selectedType = UPCOMING_UNLOCK_TYPE_OPTIONS.find((option) => option.key === value)?.key
							if (!selectedType) throw new Error(`Unknown upcoming unlock type: ${value}`)
							void pushShallowQuery(router, getUpcomingUnlockTypeQueryUpdates(selectedType))
						}}
						label={unlockTypeLabel}
						labelType="none"
						variant="filter"
						size="md"
						triggerProps={{ 'aria-label': 'Release type' }}
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
					<SegmentedControl
						variant="default"
						size="md"
						value={viewMode}
						onValueChange={(value) => {
							void pushShallowQuery(router, {
								[UPCOMING_UNLOCK_CHART_QUERY_KEYS.viewMode]: getUpcomingUnlockViewModeQueryValue(value)
							})
						}}
						options={UPCOMING_UNLOCK_VIEW_MODES.map((value) => ({ value, label: value }))}
						label="Chart view"
					/>
					<Tooltip
						content="Total View aggregates the selected unlock type across all protocols. Breakdown View stacks the same value by protocol."
						render={<button type="button" aria-label="Explain chart views" className="cursor-help text-tertiary" />}
					>
						<Icon name="help-circle" className="size-4" aria-hidden="true" />
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
						chart={exportChartExport}
						filename={`${unlockType}-upcoming-unlocks`}
						title={unlockType === 'all' ? 'Upcoming Unlocks' : `Upcoming ${unlockTypeLabel}`}
						csvSource={{
							type: 'dataset',
							prepare: () => ({
								...(selectedBreakdown
									? selectChartDatasetColumns(
											deferredChartData.dataset,
											deferredChartData.charts.filter((chart) => selectedCharts.has(chart.name))
										)
									: deferredChartData.dataset),
								groupBy: deferredTimePeriod
							})
						}}
					/>
				) : null}
			</ChartPanelToolbar>
			{ignoresTableFilters ? (
				<ScopeNote>This chart ignores the table filters and shows upcoming unlocks for every protocol.</ScopeNote>
			) : null}
			{deferredChartData.dataset.source.length > 0 ? (
				<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
					<MultiSeriesChart
						exportButtons={exportChartExport}
						dataset={selectedBreakdown?.dataset ?? deferredChartData.dataset}
						charts={selectedBreakdown?.charts ?? deferredChartData.charts}
						showLegend={deferredViewMode !== 'Total View'}
						groupBy={deferredTimePeriod}
						valueSymbol="$"
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
	const unlockTypes = useMemo(() => getUnlockTypes(data), [data])
	const chartIgnoresTableFilters = hasActiveUnlockTableFilters(router.query, unlockTypes)

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
				<Button
					as="a"
					href="https://airtable.com/shrD1bSGYNcdFQ6kd"
					target="_blank"
					rel="noopener noreferrer"
					variant="inlineLink"
				>
					Add it here!
				</Button>
			</Announcement>

			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="heading-sm">Unlock statistics</h1>
					<div className="flex flex-col">
						<UpcomingUnlockMetric days={7} values={upcomingUnlocks7d} />
						<UpcomingUnlockMetric days={30} values={upcomingUnlocks30d} />
						<MetricRow label="Total Protocols Tracked" value={totalProtocols} />
					</div>
					<Button as={BasicLink} href="/unlocks/calendar" size="md" className="mt-auto">
						<span>View unlocks calendar</span>
						<Icon name="arrow-right" className="size-3.5" />
					</Button>
				</SummaryStatsCard>
				<Panel className="col-span-2">
					<UpcomingUnlockVolumeChart series={unlockChartSeries} ignoresTableFilters={chartIgnoresTableFilters} />
				</Panel>
			</SummaryCardGrid>

			<div className="isolate grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<TopUnlocks data={data} period={1} title="Past 24h top unlocks" initialNowSec={generatedAtSec} />
				</Card>

				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<TopUnlocks data={data} period={30} title="Past 30d top unlocks" initialNowSec={generatedAtSec} />
				</Card>

				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<PastUnlockPriceImpact data={data} title="7d Price Change After Unlock" initialNowSec={generatedAtSec} />
				</Card>
			</div>

			<UnlocksTable
				protocols={data}
				showOnlyWatchlist={showOnlyWatchlist}
				savedProtocols={savedProtocols}
				initialNowSec={generatedAtSec}
			/>
		</Layout>
	)
}
