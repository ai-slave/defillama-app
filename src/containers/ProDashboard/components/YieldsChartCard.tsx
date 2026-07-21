import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import { formattedNum } from '~/utils'
import { download } from '~/utils/download'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext } from '../queries'
import { fetchYieldsLendBorrowViaProxy, fetchYieldsViaProxy } from '../services/fetchViaProxy'
import { normalizeYieldChartType, type ActiveYieldChartType, type YieldsChartConfig } from '../types'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'
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

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

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
	const gatedPoolId = streamDone && needsSupplyData ? poolConfigId : null
	const {
		data: chart,
		isLoading: fetchingChartData,
		isError: chartError
	} = useQuery({
		queryKey: ['yield-supply-history', gatedPoolId],
		queryFn: (): Promise<PoolHistory> =>
			authToken ? fetchYieldsViaProxy(gatedPoolId!, authToken) : fetchPoolDetailHistory(gatedPoolId!, 'max'),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!gatedPoolId
	})

	const borrowPoolId = streamDone && needsBorrowData ? poolConfigId : null
	const {
		data: borrowChart,
		isLoading: fetchingBorrowData,
		isError: borrowError
	} = useQuery({
		queryKey: ['yield-borrow-history', borrowPoolId],
		queryFn: (): Promise<BorrowMarketHistory> =>
			authToken
				? fetchYieldsLendBorrowViaProxy(borrowPoolId!, authToken)
				: fetchBorrowMarketDetailHistory(borrowPoolId!, 'max'),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!borrowPoolId
	})

	const { tvlApyDataset, supplyApyDataset, supplyApy7dDataset, borrowApyDataset, netBorrowApyDataset, latestData } =
		useYieldChartTransformations({
			chartData: chart,
			borrowData: borrowChart,
			timePeriod,
			customTimePeriod
		})

	const currentChartDataset = useMemo(() => {
		switch (chartType) {
			case 'tvl-apy':
				return tvlApyDataset
			case 'supply-apy':
				return supplyApyDataset
			case 'supply-apy-7d':
				return supplyApy7dDataset
			case 'borrow-apy':
				return borrowApyDataset
			case 'net-borrow-apy':
				return netBorrowApyDataset
			default:
				return tvlApyDataset
		}
	}, [chartType, tvlApyDataset, supplyApyDataset, supplyApy7dDataset, borrowApyDataset, netBorrowApyDataset])

	const handleCsvExport = () => {
		if (currentChartDataset.source.length === 0) return

		let headers: string[]
		let rows: Array<Array<string | number>>

		switch (chartType) {
			case 'tvl-apy':
				headers = ['Date', 'Supply APY', 'TVL']
				rows = tvlApyDataset.source.map((point) => [
					new Date(point[0] as number).toISOString().slice(0, 10),
					point[1] ?? '',
					point[2] ?? ''
				])
				break
			case 'supply-apy':
				headers = ['Date', 'Base', 'Reward', 'Intrinsic']
				rows = supplyApyDataset.source.map((point) => [
					new Date(point[0] as number).toISOString().slice(0, 10),
					point[1] ?? '',
					point[2] ?? '',
					point[3] ?? ''
				])
				break
			case 'borrow-apy':
				headers = ['Date', 'Base cost', 'Reward offset', 'Intrinsic']
				rows = borrowApyDataset.source.map((point) => [
					new Date(point[0] as number).toISOString().slice(0, 10),
					point[1] ?? '',
					point[2] ?? '',
					point[3] ?? ''
				])
				break
			case 'supply-apy-7d':
				headers = ['Date', '7d Supply APY']
				rows = supplyApy7dDataset.source.map((point) => [
					new Date(point[0] as number).toISOString().slice(0, 10),
					point[1]
				])
				break
			case 'net-borrow-apy':
				headers = ['Date', 'Net borrow cost']
				rows = netBorrowApyDataset.source.map((point) => [
					new Date(point[0] as number).toISOString().slice(0, 10),
					point[1]
				])
		}

		const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')
		const chartTypeSuffix = chartType !== 'tvl-apy' ? `_${chartType}` : ''
		const fileName = `${poolName.replace(/\s+/g, '_')}${chartTypeSuffix}_${new Date().toISOString().split('T')[0]}.csv`
		download(fileName, csvContent)
	}

	const imageFilename = `${poolName.replace(/\s+/g, '_')}`
	const imageTitle = `${poolName} - ${project} (${chain})`

	const isLoading = (needsBorrowData ? fetchingBorrowData : fetchingChartData) || !streamDone

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
						<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
						<ProTableCSVButton
							onClick={handleCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</div>
				) : null}
			</div>

			{chartType === 'tvl-apy' && latestData.apy !== null && latestData.tvl !== null ? (
				<div className="mb-2 flex gap-4">
					<div className="flex flex-col">
						<span className="text-[10px] text-pro-text-tertiary uppercase">Latest Supply APY</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#cc3e82' }}>
							{latestData.apy}%
						</span>
					</div>
					<div className="flex flex-col">
						<span className="text-[10px] text-pro-text-tertiary uppercase">TVL</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#3e79cc' }}>
							{formattedNum(latestData.tvl, true)}
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
							dataset={tvlApyDataset}
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
							dataset={supplyApyDataset}
							charts={supplyApyCharts}
							chartOptions={percentTimeChartOptions}
							valueSymbol="%"
							hideDefaultLegend={false}
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'supply-apy-7d' ? (
						<MultiSeriesChart
							height="320px"
							dataset={supplyApy7dDataset}
							charts={supplyApy7dCharts}
							chartOptions={singlePercentTimeChartOptions}
							valueSymbol="%"
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'borrow-apy' ? (
						<MultiSeriesChart
							height="320px"
							dataset={borrowApyDataset}
							charts={borrowApyCharts}
							chartOptions={percentTimeChartOptions}
							valueSymbol="%"
							hideDefaultLegend={false}
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'net-borrow-apy' ? (
						<MultiSeriesChart
							height="320px"
							dataset={netBorrowApyDataset}
							charts={netBorrowApyCharts}
							chartOptions={singlePercentTimeChartOptions}
							valueSymbol="%"
							onReady={handleChartReady}
						/>
					) : null}
				</Suspense>
			</div>
		</div>
	)
}
