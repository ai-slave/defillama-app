import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { formatTvlApyTooltip } from '~/components/ECharts/formatters'
import type { IBarChartProps, IChartProps, IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { CHART_COLORS } from '~/constants/colors'
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

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const BarChart = lazy(() => import('~/components/ECharts/BarChart')) as React.FC<IBarChartProps>
const AreaChart = lazy(() => import('~/components/ECharts/AreaChart')) as React.FC<IChartProps>

interface YieldsChartCardProps {
	config: YieldsChartConfig
}

const tvlApyCharts = [
	{
		type: 'line' as const,
		name: 'APY',
		encode: { x: 'timestamp', y: 'APY' },
		color: '#cc3e82',
		yAxisIndex: 0,
		valueSymbol: '%'
	},
	{
		type: 'line' as const,
		name: 'TVL',
		encode: { x: 'timestamp', y: 'TVL' },
		color: '#3e79cc',
		yAxisIndex: 1,
		valueSymbol: '$'
	}
]
const tvlApyChartOptions = { tooltip: { formatter: formatTvlApyTooltip } }

const supplyChartStacks = { Base: 'a', Reward: 'a', Intrinsic: 'a' }
const supplyChartColors = { Base: CHART_COLORS[0], Reward: CHART_COLORS[1], Intrinsic: CHART_COLORS[2] }
const borrowChartStacks = { 'Base cost': 'a', 'Reward offset': 'a', Intrinsic: 'a' }
const borrowChartColors = { 'Base cost': CHART_COLORS[0], 'Reward offset': CHART_COLORS[1], Intrinsic: CHART_COLORS[2] }

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

	const {
		tvlApyData,
		tvlApyDataset,
		supplyApyBarData,
		supplyApy7dData,
		borrowApyBarData,
		netBorrowApyData,
		latestData
	} = useYieldChartTransformations({
		chartData: chart,
		borrowData: borrowChart,
		timePeriod,
		customTimePeriod
	})

	const currentChartData = useMemo(() => {
		switch (chartType) {
			case 'tvl-apy':
				return tvlApyData
			case 'supply-apy':
				return supplyApyBarData
			case 'supply-apy-7d':
				return supplyApy7dData
			case 'borrow-apy':
				return borrowApyBarData
			case 'net-borrow-apy':
				return netBorrowApyData
			default:
				return tvlApyData
		}
	}, [chartType, tvlApyData, supplyApyBarData, supplyApy7dData, borrowApyBarData, netBorrowApyData])

	const handleCsvExport = () => {
		if (!currentChartData || currentChartData.length === 0) return

		let headers: string[]
		let rows: Array<Array<string | number>>

		switch (chartType) {
			case 'tvl-apy':
				headers = ['Date', 'Supply APY', 'TVL']
				rows = tvlApyData.map((point) => [
					new Date(point.date * 1000).toISOString().slice(0, 10),
					point.APY ?? '',
					point.TVL ?? ''
				])
				break
			case 'supply-apy':
				headers = ['Date', 'Base', 'Reward', 'Intrinsic']
				rows = supplyApyBarData.map((point) => [
					new Date(point.date * 1000).toISOString().slice(0, 10),
					point.Base ?? '',
					point.Reward ?? '',
					point.Intrinsic ?? ''
				])
				break
			case 'borrow-apy':
				headers = ['Date', 'Base cost', 'Reward offset', 'Intrinsic']
				rows = borrowApyBarData.map((point) => [
					new Date(point.date * 1000).toISOString().slice(0, 10),
					point['Base cost'] ?? '',
					point['Reward offset'] ?? '',
					point.Intrinsic ?? ''
				])
				break
			case 'supply-apy-7d':
				headers = ['Date', '7d Supply APY']
				rows = supplyApy7dData.map(([date, value]) => [new Date(date * 1000).toISOString().slice(0, 10), value])
				break
			case 'net-borrow-apy':
				headers = ['Date', 'Net borrow cost']
				rows = netBorrowApyData.map(([date, value]) => [new Date(date * 1000).toISOString().slice(0, 10), value])
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

	const hasRequiredData = (() => {
		switch (chartType) {
			case 'tvl-apy':
				return tvlApyData.length > 0
			case 'supply-apy':
				return supplyApyBarData.length > 0
			case 'supply-apy-7d':
				return supplyApy7dData.length > 0
			case 'borrow-apy':
				return borrowApyBarData.length > 0
			case 'net-borrow-apy':
				return netBorrowApyData.length > 0
			default:
				return tvlApyData.length > 0
		}
	})()

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
				<span className="text-sm pro-text3">Failed to load chart data</span>
			</div>
		)
	}

	if (!hasRequiredData) {
		return (
			<div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
				<span className="text-sm pro-text3">No data available for this chart type</span>
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
					<h3 className="text-sm font-semibold pro-text1">{poolName}</h3>
					<p className="text-xs pro-text2">
						{project} - {chain} {chartType !== 'tvl-apy' ? <span className="pro-text3">({chartTitle})</span> : null}
					</p>
				</div>
				{currentChartData && currentChartData.length > 0 ? (
					<div className="flex gap-2">
						<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
						<ProTableCSVButton
							onClick={handleCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-blue focus-visible:border-transparent focus-visible:not-disabled:pro-btn-blue disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</div>
				) : null}
			</div>

			{chartType === 'tvl-apy' && latestData.apy !== null && latestData.tvl !== null ? (
				<div className="mb-2 flex gap-4">
					<div className="flex flex-col">
						<span className="text-[10px] pro-text3 uppercase">Latest Supply APY</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#cc3e82' }}>
							{latestData.apy}%
						</span>
					</div>
					<div className="flex flex-col">
						<span className="text-[10px] pro-text3 uppercase">TVL</span>
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
						<MultiSeriesChart2
							height="320px"
							dataset={tvlApyDataset}
							charts={tvlApyCharts}
							chartOptions={tvlApyChartOptions}
							valueSymbol=""
							alwaysShowTooltip={false}
							hideDefaultLegend={false}
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'supply-apy' ? (
						<BarChart
							height="320px"
							chartData={supplyApyBarData}
							stacks={supplyChartStacks}
							stackColors={supplyChartColors}
							title=""
							valueSymbol="%"
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'supply-apy-7d' ? (
						<AreaChart
							height="320px"
							chartData={supplyApy7dData}
							title=""
							valueSymbol="%"
							color={CHART_COLORS[0]}
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'borrow-apy' ? (
						<BarChart
							height="320px"
							chartData={borrowApyBarData}
							stacks={borrowChartStacks}
							stackColors={borrowChartColors}
							title=""
							valueSymbol="%"
							onReady={handleChartReady}
						/>
					) : null}
					{chartType === 'net-borrow-apy' ? (
						<AreaChart
							height="320px"
							chartData={netBorrowApyData}
							title=""
							valueSymbol="%"
							color={CHART_COLORS[0]}
							onReady={handleChartReady}
						/>
					) : null}
				</Suspense>
			</div>
		</div>
	)
}
