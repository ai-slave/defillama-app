import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import * as React from 'react'
import { lazy, useMemo } from 'react'
import { Announcement } from '~/components/Announcement'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import type { IMultiSeriesChart2Props, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { BasicLink } from '~/components/Link'
import { PastUnlockPriceImpact } from '~/containers/Unlocks/PastUnlockPriceImpact'
import { getAllProtocolEmissions } from '~/containers/Unlocks/queries'
import { UnlocksTable } from '~/containers/Unlocks/Table'
import { TopUnlocks } from '~/containers/Unlocks/TopUnlocks'
import {
	buildUpcomingUnlockChart,
	buildUpcomingUnlockSeries,
	type UpcomingUnlockChartSeries
} from '~/containers/Unlocks/upcomingUnlockChart'
import { useWatchlistManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { TagGroup } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formattedNum } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

const calculateUnlockStatistics = (data, nowSec: number) => {
	let upcomingUnlocks30dValue = 0
	let upcomingUnlocks7dValue = 0
	const thirtyDaysLater = nowSec + 30 * 24 * 60 * 60
	const sevenDaysLater = nowSec + 7 * 24 * 60 * 60

	if (data) {
		for (const protocol of data) {
			if (!protocol.upcomingEvent || protocol.tPrice == null) {
				continue
			}

			for (const event of protocol.upcomingEvent) {
				if (event.timestamp === null || !event.noOfTokens || event.noOfTokens.length === 0) {
					continue
				}

				const totalTokens = event.noOfTokens.reduce((sum, amount) => sum + amount, 0)
				if (totalTokens === 0) {
					continue
				}

				const valueUSD = totalTokens * protocol.tPrice
				if (event.timestamp >= nowSec && event.timestamp <= thirtyDaysLater) {
					upcomingUnlocks30dValue += valueUSD
				}
				if (event.timestamp >= nowSec && event.timestamp <= sevenDaysLater) {
					upcomingUnlocks7dValue += valueUSD
				}
			}
		}
	}

	return {
		upcomingUnlocks7dValue,
		upcomingUnlocks30dValue,
		totalProtocols: data?.length || 0
	}
}

export const getStaticProps = withPerformanceLogging('unlocks', async () => {
	const generatedAtSec = Math.floor(Date.now() / 1000)
	const metadataModule = await import('~/utils/metadata')
	metadataModule.refreshMetadataInBackgroundIfStale('unlocks_index')
	const metadataCache = metadataModule.default
	const data = await getAllProtocolEmissions({
		endDate: generatedAtSec + 30 * 24 * 60 * 60,
		tokenlist: metadataCache.tokenlist,
		emissionsHistoricalPrices: metadataCache.emissionsHistoricalPrices
	})
	return {
		props: {
			data,
			unlockChartSeries: buildUpcomingUnlockSeries(data, generatedAtSec, END_TIMESTAMP),
			generatedAtSec
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', 'Token Unlocks']

const VIEW_MODES = ['Total View', 'Breakdown View'] as const
type ViewMode = (typeof VIEW_MODES)[number]

const END_TIMESTAMP = dayjs('2031-01-01').unix()

const EMPTY_CHART_RESULT = {
	dataset: { source: [], dimensions: ['timestamp'] } satisfies MultiSeriesChart2Dataset,
	charts: [] as NonNullable<IMultiSeriesChart2Props['charts']>
}

const normalizeChartGroup = (value: string | null | undefined): LowercaseDwmGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	if (DWM_GROUPING_OPTIONS_LOWERCASE.some((option) => option.value === normalizedValue)) {
		return normalizedValue as LowercaseDwmGrouping
	}
	return null
}

function UpcomingUnlockVolumeChart({ series }: { series: UpcomingUnlockChartSeries[] }) {
	const router = useRouter()

	const updateQueryParam = React.useCallback(
		(key: string, value: string, defaultValue: string) => {
			void pushShallowQuery(router, { [key]: value === defaultValue ? undefined : value })
		},
		[router]
	)

	const chartGroupParam = readSingleQueryValue(router.query.chartGroup)
	const timePeriod: LowercaseDwmGrouping =
		// Preserve existing shared/bookmarked URLs that still use title-cased values like `Weekly`.
		normalizeChartGroup(chartGroupParam) ?? 'daily'

	const chartViewParam = readSingleQueryValue(router.query.chartView)
	const viewMode: ViewMode =
		chartViewParam && (VIEW_MODES as readonly string[]).includes(chartViewParam)
			? (chartViewParam as ViewMode)
			: 'Total View'

	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const unlockChartData = useMemo(() => {
		if (series.length === 0) return EMPTY_CHART_RESULT
		return buildUpcomingUnlockChart({
			series,
			groupBy: timePeriod,
			viewMode
		})
	}, [series, timePeriod, viewMode])
	const deferredChartData = React.useDeferredValue(unlockChartData)

	return (
		<>
			{unlockChartData.dataset.source.length > 0 ? (
				<>
					<ChartPanelToolbar className="justify-end">
						<h2 className="mr-auto heading-xs">Upcoming Unlocks</h2>
						<ChartGroupingSelector
							value={timePeriod}
							onValueChange={(value) => updateQueryParam('chartGroup', value, 'daily')}
							options={DWM_GROUPING_OPTIONS_LOWERCASE}
						/>
						<TagGroup
							variant="default"
							size="md"
							selectedValue={viewMode}
							setValue={(value) => updateQueryParam('chartView', value, 'Total View')}
							values={VIEW_MODES}
						/>
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename="upcoming-unlocks"
							title="Upcoming Unlocks"
						/>
					</ChartPanelToolbar>
					<React.Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart2
							dataset={deferredChartData.dataset}
							charts={deferredChartData.charts}
							hideDefaultLegend={viewMode === 'Total View'}
							groupBy={timePeriod}
							valueSymbol="$"
							onReady={handleChartReady}
						/>
					</React.Suspense>
				</>
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
	data: any[]
	unlockChartSeries: UpcomingUnlockChartSeries[]
	generatedAtSec: number
}) {
	const { savedProtocols } = useWatchlistManager('defi')
	const router = useRouter()

	const showOnlyWatchlist = readSingleQueryValue(router.query.watchlist) === 'true'

	const { upcomingUnlocks7dValue, upcomingUnlocks30dValue, totalProtocols } = useMemo(
		() => calculateUnlockStatistics(data, generatedAtSec),
		[data, generatedAtSec]
	)

	return (
		<Layout
			title="Token Unlocks & Vesting Schedules - DefiLlama"
			description="Track upcoming token unlocks and vesting schedules for 500+ DeFi protocols. Monitor unlock dates, amounts, and price impact. Real-time token unlock calendar with 7-day and 30-day unlock analytics."
			canonicalUrl={`/unlocks`}
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
					<StatItem label="Total Protocols Tracked" value={totalProtocols} />
					<StatItem label="Upcoming Unlocks (7d)" value={formattedNum(upcomingUnlocks7dValue, true)} />
					<StatItem label="Upcoming Unlocks (30d)" value={formattedNum(upcomingUnlocks30dValue, true)} />
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
					<TopUnlocks data={data} period={1} title="24h Top Unlocks" initialNowSec={generatedAtSec} />
				</Card>

				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<TopUnlocks data={data} period={30} title="30d Top Unlocks" initialNowSec={generatedAtSec} />
				</Card>

				<Card padding="sm" className="col-span-1 flex flex-col gap-3">
					<PastUnlockPriceImpact data={data} title="Post Unlock Price Impact" initialNowSec={generatedAtSec} />
				</Card>
			</div>

			<UnlocksTable protocols={data} showOnlyWatchlist={showOnlyWatchlist} savedProtocols={savedProtocols} />
		</Layout>
	)
}
