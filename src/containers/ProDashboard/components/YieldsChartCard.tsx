import { useQuery } from '@tanstack/react-query'
import { lazy, type ReactNode, Suspense, useContext } from 'react'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { downloadCSV } from '~/utils/download'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext } from '../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../queryPolicy'
import { fetchProDashboardProxy } from '../services/fetchViaProxy'
import { normalizeYieldChartType, type ActiveYieldChartType, type YieldsChartConfig } from '../types'
import { ProMeta } from '../ui'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'
import { useYieldChartTransformations } from './useYieldChartTransformations'
import {
	borrowApyCharts,
	netBorrowApyCharts,
	percentTimeChartOptions,
	singlePercentTimeChartOptions,
	supplyApy7dCharts,
	supplyApyCharts,
	tvlApyCharts
} from './yieldChartConfig'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type ChartConfigWithUndefinedColor = Omit<MultiSeriesChartSeriesConfig, 'color'> & { color?: string | undefined }

const normalizeChartColors = (charts: Array<ChartConfigWithUndefinedColor>): Array<MultiSeriesChartSeriesConfig> =>
	charts.map(({ color, ...chart }) => ({ ...chart, ...(color ? { color } : {}) }))

const SUPPLY_APY_CHARTS = normalizeChartColors(supplyApyCharts)
const BORROW_APY_CHARTS = normalizeChartColors(borrowApyCharts)

interface YieldsChartCardProps {
	config: YieldsChartConfig
}

export function YieldsChartCard({ config }: YieldsChartCardProps) {
	const { poolConfigId, poolName, project, chain } = config
	const chartType = normalizeYieldChartType(config.chartType)
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useChartImageExport()

	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const needsBorrowData = chartType === 'borrow-apy' || chartType === 'net-borrow-apy'
	const needsSupplyData = !needsBorrowData
	const supplyQuery = useQuery({
		queryKey: ['yield-supply-history', poolConfigId],
		queryFn: (): Promise<PoolHistory> => {
			return authToken
				? fetchProDashboardProxy('yields', { poolConfigId }, authToken)
				: fetchPoolDetailHistory(poolConfigId, 'max')
		},
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: streamDone && needsSupplyData && Boolean(poolConfigId)
	})
	const { data: chart, isLoading: fetchingChartData } = supplyQuery
	const chartError = queryReadFailed(supplyQuery)

	const borrowQuery = useQuery({
		queryKey: ['yield-borrow-history', poolConfigId],
		queryFn: (): Promise<BorrowMarketHistory> => {
			return authToken
				? fetchProDashboardProxy('yieldsLendBorrow', { poolConfigId }, authToken)
				: fetchBorrowMarketDetailHistory(poolConfigId, 'max')
		},
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: streamDone && needsBorrowData && Boolean(poolConfigId)
	})
	const { data: borrowChart, isLoading: fetchingBorrowData } = borrowQuery
	const borrowError = queryReadFailed(borrowQuery)

	const { dataset: currentChartDataset, latestData } = useYieldChartTransformations({
		chartType,
		chartData: chart,
		borrowData: borrowChart,
		timePeriod,
		customTimePeriod
	})

	const handleCsvExport = () => {
		if (currentChartDataset.source.length === 0) return
		// eslint-disable-next-line unicorn/consistent-function-scoping -- the point type is derived from the dataset in this scope
		const formatPointDate = (point: (typeof currentChartDataset.source)[number], pointIndex: number) => {
			const timestamp = point[0]
			if (typeof timestamp !== 'number') throw new Error(`Invalid yield chart timestamp at index ${pointIndex}`)
			return new Date(timestamp).toISOString().slice(0, 10)
		}

		let headers: Array<string>
		let rows: Array<Array<string | number>>

		switch (chartType) {
			case 'tvl-apy':
				headers = ['Date', 'Supply APY', 'TVL']
				rows = currentChartDataset.source.map((point, pointIndex) => [
					formatPointDate(point, pointIndex),
					point[1] ?? '',
					point[2] ?? ''
				])
				break
			case 'supply-apy':
				headers = ['Date', 'Base', 'Reward', 'Intrinsic']
				rows = currentChartDataset.source.map((point, pointIndex) => [
					formatPointDate(point, pointIndex),
					point[1] ?? '',
					point[2] ?? '',
					point[3] ?? ''
				])
				break
			case 'borrow-apy':
				headers = ['Date', 'Base cost', 'Reward offset', 'Intrinsic']
				rows = currentChartDataset.source.map((point, pointIndex) => [
					formatPointDate(point, pointIndex),
					point[1] ?? '',
					point[2] ?? '',
					point[3] ?? ''
				])
				break
			case 'supply-apy-7d':
				headers = ['Date', '7d Supply APY']
				rows = currentChartDataset.source.map((point, pointIndex) => [
					formatPointDate(point, pointIndex),
					point[1] ?? ''
				])
				break
			case 'net-borrow-apy':
				headers = ['Date', 'Net borrow cost']
				rows = currentChartDataset.source.map((point, pointIndex) => [
					formatPointDate(point, pointIndex),
					point[1] ?? ''
				])
		}

		const chartTypeSuffix = chartType !== 'tvl-apy' ? `_${chartType}` : ''
		const fileName = `${poolName.replace(/\s+/g, '_')}${chartTypeSuffix}_${new Date().toISOString().split('T')[0]}.csv`
		downloadCSV(fileName, [headers, ...rows])
	}

	const imageFilename = `${poolName.replace(/\s+/g, '_')}`
	const imageTitle = `${poolName} - ${project} (${chain})`

	const selectedData = needsBorrowData ? borrowChart : chart
	const isLoading =
		(needsBorrowData ? fetchingBorrowData : fetchingChartData) || (!streamDone && selectedData === undefined)

	const hasError = needsBorrowData ? chartError || borrowError : chartError
	const retryChartData = {
		refetch: () => {
			if (chartError) void supplyQuery.refetch()
			if (borrowError) void borrowQuery.refetch()
		},
		isFetching: needsBorrowData ? borrowQuery.isFetching || supplyQuery.isFetching : supplyQuery.isFetching
	}

	const hasRequiredData = currentChartDataset.source.length > 0
	const hallmarks = useDashboardAnnotationHallmarks()
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(320, cardHeightScale)

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader titleAs="h3" title={poolName} subtitle={<ProMeta items={[project, chain]} />} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (hasError && selectedData === undefined) {
		return renderStatusShell(<ProCardError retry={retryChartData} />)
	}

	if (isLoading) {
		return renderStatusShell(<ProCardLoading />)
	}

	if (!hasRequiredData) {
		return (
			<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col justify-center">
				<ProCardEmpty message="No data available for this chart type" />
			</div>
		)
	}

	const chartTitles: Record<ActiveYieldChartType, string> = {
		'tvl-apy': 'TVL & Supply APY',
		'supply-apy': 'Supply APY',
		'supply-apy-7d': '7d Avg Supply APY',
		'borrow-apy': 'Borrow Cost APY',
		'net-borrow-apy': 'Net Borrow Cost'
	}
	const chartTitle = chartTitles[chartType]

	return (
		<div className="flex h-full flex-col p-0">
			{hasError ? <ProCardRefreshFailed retry={retryChartData} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={poolName}
				subtitle={<ProMeta items={[project, chain, chartType !== 'tvl-apy' ? chartTitle : null]} />}
				menu={
					currentChartDataset.source.length > 0
						? {
								image: { chartInstance, filename: imageFilename, title: imageTitle },
								csv: { onClick: handleCsvExport }
							}
						: {}
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
				{chartType === 'tvl-apy' && latestData.apy !== null && latestData.tvl !== null ? (
					<div className="mb-2 flex gap-4">
						<div className="flex flex-col">
							<span className="text-xs text-pro-text-tertiary uppercase">Latest Supply APY</span>
							<span className="font-jetbrains text-sm font-bold" style={{ color: '#cc3e82' }}>
								{formatPercent(latestData.apy, { input: 'percent' })}
							</span>
						</div>
						<div className="flex flex-col">
							<span className="text-xs text-pro-text-tertiary uppercase">TVL</span>
							<span className="font-jetbrains text-sm font-bold" style={{ color: '#3e79cc' }}>
								{formatUsd(latestData.tvl, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</span>
						</div>
					</div>
				) : null}

				<div className="flex-1">
					<Suspense
						fallback={
							<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
								<ProCardLoading />
							</div>
						}
					>
						{chartType === 'tvl-apy' ? (
							<MultiSeriesChart
								height={chartHeight}
								{...(hallmarks ? { hallmarks } : {})}
								hallmarkStyle="mark-line"
								{...(syncGroup ? { syncGroup } : {})}
								dataset={currentChartDataset}
								charts={tvlApyCharts}
								valueSymbol=""
								alwaysShowTooltip={false}
								hideDefaultLegend={false}
								onReady={handleChartReady}
							/>
						) : null}
						{chartType === 'supply-apy' ? (
							<MultiSeriesChart
								height={chartHeight}
								{...(hallmarks ? { hallmarks } : {})}
								hallmarkStyle="mark-line"
								{...(syncGroup ? { syncGroup } : {})}
								dataset={currentChartDataset}
								charts={SUPPLY_APY_CHARTS}
								{...(percentTimeChartOptions ? { chartOptions: percentTimeChartOptions } : {})}
								valueSymbol="%"
								hideDefaultLegend={false}
								onReady={handleChartReady}
							/>
						) : null}
						{chartType === 'supply-apy-7d' ? (
							<MultiSeriesChart
								height={chartHeight}
								{...(hallmarks ? { hallmarks } : {})}
								hallmarkStyle="mark-line"
								{...(syncGroup ? { syncGroup } : {})}
								dataset={currentChartDataset}
								charts={supplyApy7dCharts}
								{...(singlePercentTimeChartOptions ? { chartOptions: singlePercentTimeChartOptions } : {})}
								valueSymbol="%"
								onReady={handleChartReady}
							/>
						) : null}
						{chartType === 'borrow-apy' ? (
							<MultiSeriesChart
								height={chartHeight}
								{...(hallmarks ? { hallmarks } : {})}
								hallmarkStyle="mark-line"
								{...(syncGroup ? { syncGroup } : {})}
								dataset={currentChartDataset}
								charts={BORROW_APY_CHARTS}
								{...(percentTimeChartOptions ? { chartOptions: percentTimeChartOptions } : {})}
								valueSymbol="%"
								hideDefaultLegend={false}
								onReady={handleChartReady}
							/>
						) : null}
						{chartType === 'net-borrow-apy' ? (
							<MultiSeriesChart
								height={chartHeight}
								{...(hallmarks ? { hallmarks } : {})}
								hallmarkStyle="mark-line"
								{...(syncGroup ? { syncGroup } : {})}
								dataset={currentChartDataset}
								charts={netBorrowApyCharts}
								{...(singlePercentTimeChartOptions ? { chartOptions: singlePercentTimeChartOptions } : {})}
								valueSymbol="%"
								onReady={handleChartReady}
							/>
						) : null}
					</Suspense>
				</div>
			</div>
		</div>
	)
}
