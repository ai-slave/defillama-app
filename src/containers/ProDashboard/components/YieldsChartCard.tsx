import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext } from 'react'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { downloadCSV } from '~/utils/download'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext } from '../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../queryPolicy'
import { fetchProDashboardProxy } from '../services/fetchViaProxy'
import { normalizeYieldChartType, type ActiveYieldChartType, type YieldsChartConfig } from '../types'
import { LoadingSpinner } from './LoadingSpinner'
import { ProCardOverflowMenu } from './ProCardActions'
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
	const {
		data: chart,
		isLoading: fetchingChartData,
		isError: chartError
	} = useQuery({
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

	const {
		data: borrowChart,
		isLoading: fetchingBorrowData,
		isError: borrowError
	} = useQuery({
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

	const { dataset: currentChartDataset, latestData } = useYieldChartTransformations({
		chartType,
		chartData: chart,
		borrowData: borrowChart,
		timePeriod,
		customTimePeriod
	})

	const handleCsvExport = () => {
		if (currentChartDataset.source.length === 0) return
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

	const hasRequiredData = currentChartDataset.source.length > 0

	if (isLoading) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	if (hasError) {
		return (
			<div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
				<span className="text-sm text-pro-text-tertiary">Failed to load chart data</span>
			</div>
		)
	}

	if (!hasRequiredData) {
		return (
			<div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
				<span className="text-sm text-pro-text-tertiary">No data available for this chart type</span>
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
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{poolName}</h3>
					<p className="text-xs text-pro-text-secondary">
						{project} - {chain}{' '}
						{chartType !== 'tvl-apy' ? <span className="text-pro-text-tertiary">({chartTitle})</span> : null}
					</p>
				</div>
				{currentChartDataset.source.length > 0 ? (
					<div className="flex gap-2">
						<ProCardOverflowMenu
							image={{ chartInstance, filename: imageFilename, title: imageTitle }}
							csv={{ onClick: handleCsvExport }}
						/>
					</div>
				) : null}
			</div>

			{chartType === 'tvl-apy' && latestData.apy !== null && latestData.tvl !== null ? (
				<div className="mb-2 flex gap-4">
					<div className="flex flex-col">
						<span className="text-[10px] text-pro-text-tertiary uppercase">Latest Supply APY</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#cc3e82' }}>
							{formatPercent(latestData.apy, { input: 'percent' })}
						</span>
					</div>
					<div className="flex flex-col">
						<span className="text-[10px] text-pro-text-tertiary uppercase">TVL</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#3e79cc' }}>
							{formatUsd(latestData.tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</span>
					</div>
				</div>
			) : null}

			<div className="flex-1">
				<Suspense
					fallback={
						<div className="flex h-[320px] items-center justify-center">
							<LoadingSpinner />
						</div>
					}
				>
					{chartType === 'tvl-apy' ? (
						<MultiSeriesChart
							height="320px"
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
							height="320px"
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
							height="320px"
							dataset={currentChartDataset}
							charts={supplyApy7dCharts}
							{...(singlePercentTimeChartOptions ? { chartOptions: singlePercentTimeChartOptions } : {})}
							valueSymbol="%"
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'borrow-apy' ? (
						<MultiSeriesChart
							height="320px"
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
							height="320px"
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
	)
}
