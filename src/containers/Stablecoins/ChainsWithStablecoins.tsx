import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ButtonStyled/ChartRestoreButton'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import type { IHBarChartProps, IPieChartProps, ITreemapChartProps } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import { Icon } from '~/components/Icon'
import { Select } from '~/components/Select/Select'
import { CHART_COLORS } from '~/constants/colors'
import type { StablecoinsChartConfig } from '~/containers/ProDashboard/types'
import type { StablecoinChartSeriesPayload } from '~/containers/Stablecoins/chartSeries'
import {
	getStablecoinChainsSeriesChart,
	getStablecoinChainsVolumeChartKind,
	getStablecoinDashboardChartType,
	getStablecoinChartTypeOptions,
	getStablecoinChartTypeQueryValue,
	getStablecoinChartViewLabel,
	getStablecoinChartViewOptions,
	getStablecoinChartViewQueryValue,
	parseStablecoinChartState,
	parseStablecoinVolumeGroupBy,
	type StablecoinChartType as StablecoinChartCategory,
	type StablecoinChartView
} from '~/containers/Stablecoins/chartState'
import { useCalcCirculating, useGroupChainsPegged } from '~/containers/Stablecoins/hooks'
import { useStablecoinChartSeriesData, useStablecoinVolumeChartData } from '~/containers/Stablecoins/queries.client'
import { getStablecoinDominance, type IFormattedStablecoinChainRow } from '~/containers/Stablecoins/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import { isTruthyQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { StablecoinsChainsTable } from './StablecoinsChainsTable'
import { groupStablecoinVolumeChartPayload } from './volumeChart'

const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<ITreemapChartProps>
const UNRELEASED_QUERY_KEY = 'unreleased'
const MAX_HORIZONTAL_BARS = 9
const MAX_TREEMAP_ITEMS = 20

interface ChainsWithStablecoinsProps {
	chainCirculatings: IFormattedStablecoinChainRow[]
	chainList: string[]
	chainsGroupbyParent: Record<string, Record<string, string[]>>
	deprecatedChains: Record<string, true>
	change1d: string
	change7d: string
	change30d: string
	totalMcapCurrent: number | null
	change1d_nol: string
	change7d_nol: string
	change30d_nol: string
}

const CHAINS_CHART_MODE = { page: 'chains' } as const

export function ChainsWithStablecoins({
	chainCirculatings,
	chainList: _chainList,
	chainsGroupbyParent,
	deprecatedChains,
	change1d,
	change7d,
	change30d,
	totalMcapCurrent,
	change1d_nol,
	change7d_nol,
	change30d_nol
}: ChainsWithStablecoinsProps) {
	const router = useRouter()
	const chartState = parseStablecoinChartState(router.query, CHAINS_CHART_MODE)
	const chartType = chartState.type
	const chartView = chartState.view
	const volumeGroupBy = React.useMemo(() => parseStablecoinVolumeGroupBy(router.query.groupBy), [router.query.groupBy])
	const chartTypeOptions = React.useMemo(() => getStablecoinChartTypeOptions(CHAINS_CHART_MODE), [])
	const chartViewOptions = React.useMemo(() => getStablecoinChartViewOptions(chartState), [chartState])
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()
	const onChartTypeChange = React.useCallback(
		(nextChartType: StablecoinChartCategory) => {
			handleChartReady(null)
			void pushShallowQuery(router, {
				chartType: getStablecoinChartTypeQueryValue(CHAINS_CHART_MODE, nextChartType),
				chartView: undefined
			})
		},
		[handleChartReady, router]
	)
	const onChartViewChange = React.useCallback(
		(nextChartView: string) => {
			const view = nextChartView as StablecoinChartView
			handleChartReady(null)
			void pushShallowQuery(router, {
				chartView: getStablecoinChartViewQueryValue(CHAINS_CHART_MODE, chartType, view)
			})
		},
		[chartType, handleChartReady, router]
	)
	const onVolumeGroupByChange = React.useCallback(
		(nextGroupBy: LowercaseDwmcGrouping) => {
			void pushShallowQuery(router, { groupBy: nextGroupBy === 'daily' ? undefined : nextGroupBy })
		},
		[router]
	)
	const volumeChartKind = getStablecoinChainsVolumeChartKind(chartType, chartView)
	const volumeChartQuery = useStablecoinVolumeChartData({
		scope: 'global',
		chart: volumeChartKind,
		enabled: volumeChartKind != null
	})

	const filteredPeggedAssets = chainCirculatings
	const includeUnreleased = React.useMemo(() => isTruthyQueryParam(router.query[UNRELEASED_QUERY_KEY]), [router.query])
	const chainTotals = useCalcCirculating<Parameters<typeof useGroupChainsPegged>[0][number]>(
		filteredPeggedAssets,
		includeUnreleased
	)

	const mcapToDisplay = formattedNum(totalMcapCurrent, true)

	let topChain = { name: 'Ethereum', mcap: 0 }
	if (chainTotals.length > 0) {
		const topChainData = chainTotals[0]
		topChain.name = topChainData.name
		topChain.mcap = topChainData.mcap ?? 0
	}

	const dominance = getStablecoinDominance(topChain, totalMcapCurrent)

	const groupedChains = useGroupChainsPegged(chainTotals, chainsGroupbyParent)

	const chainsCirculatingValues = React.useMemo(() => {
		return preparePieChartData({ data: groupedChains, sliceIdentifier: 'name', sliceValue: 'mcap', limit: 10 })
	}, [groupedChains])
	const hbarMarketCapData = React.useMemo(() => {
		return preparePieChartData({
			data: groupedChains,
			sliceIdentifier: 'name',
			sliceValue: 'mcap',
			limit: MAX_HORIZONTAL_BARS
		})
	}, [groupedChains])
	const rankedMarketCapData = React.useMemo(() => {
		const data: Array<{ name: string; value: number; color: string }> = []
		for (const chain of groupedChains) {
			const value = Number(chain.mcap ?? 0)
			if (!Number.isFinite(value) || value <= 0) continue
			data.push({
				name: chain.name,
				value,
				color: CHART_COLORS[data.length % CHART_COLORS.length]
			})
			if (data.length >= MAX_TREEMAP_ITEMS) break
		}
		return data
	}, [groupedChains])
	const hbarData = React.useMemo(() => {
		const categories: string[] = []
		const values: number[] = []
		const colors: string[] = []
		for (let i = 0; i < hbarMarketCapData.length; i++) {
			const item = hbarMarketCapData[i]
			categories.push(item.name)
			values.push(item.value)
			colors.push(CHART_COLORS[i % CHART_COLORS.length])
		}
		return { categories, values, colors }
	}, [hbarMarketCapData])
	const treemapData = React.useMemo(() => {
		let total = 0
		for (const item of rankedMarketCapData) {
			total += item.value
		}
		return rankedMarketCapData.map((item) => {
			const share = total > 0 ? Number(((item.value / total) * 100).toFixed(2)) : 0
			return {
				name: item.name,
				path: `Stablecoins/${item.name}`,
				value: [item.value, share, share],
				itemStyle: { color: item.color }
			}
		})
	}, [rankedMarketCapData])

	const selectedSeriesChart = getStablecoinChainsSeriesChart(chartType, chartView)
	const chartSeriesQuery = useStablecoinChartSeriesData({
		scope: 'chains',
		chart: selectedSeriesChart,
		includeUnreleased: selectedSeriesChart === 'dominance' && includeUnreleased,
		enabled: selectedSeriesChart != null
	})
	const selectedChartData = chartSeriesQuery.data ?? null
	const deferredSelectedChartData = React.useDeferredValue(selectedChartData)
	const groupedVolumeChartData = React.useMemo(
		() => (volumeChartQuery.data ? groupStablecoinVolumeChartPayload(volumeChartQuery.data, volumeGroupBy) : null),
		[volumeChartQuery.data, volumeGroupBy]
	)
	const deferredVolumeChartData = React.useDeferredValue(groupedVolumeChartData)
	const deferredChainsCirculatingValues = React.useDeferredValue(chainsCirculatingValues)
	const isSelectedChartLoading =
		deferredSelectedChartData == null &&
		(chartSeriesQuery.isLoading || chartSeriesQuery.isFetching || chartSeriesQuery.data != null)
	const isVolumeChartLoading =
		deferredVolumeChartData == null &&
		(volumeChartQuery.isLoading || volumeChartQuery.isFetching || volumeChartQuery.data != null)
	const showDefaultLegend =
		(chartType === 'marketCap' && (chartView === 'breakdown' || chartView === 'dominance')) ||
		(chartType === 'volume' && chartView !== 'total')

	const stablecoinsChartConfig = React.useMemo<StablecoinsChartConfig | null>(() => {
		const dashboardChartType = getStablecoinDashboardChartType(chartType, chartView)
		if (!dashboardChartType) return null
		return {
			id: `stablecoins-All-${dashboardChartType}`,
			kind: 'stablecoins',
			chain: 'All',
			chartType: dashboardChartType
		}
	}, [chartType, chartView])

	const exportMeta = React.useMemo(() => {
		let title = 'Stablecoins Circulating Supply'
		if (chartType === 'volume') {
			title = 'Stablecoins Volume'
		}

		return {
			filename: `stablecoins-chains-${chartType}-${chartView}`,
			title
		}
	}, [chartType, chartView])

	return (
		<>
			<SummaryCardGrid>
				<SummaryStatsCard>
					<StatItem label="Total Stablecoins Market Cap" labelAs="h1" value={mcapToDisplay} />

					<details className="group text-base">
						<summary className="flex items-center">
							<Icon
								name="chevron-right"
								height={20}
								width={20}
								className="-mb-5 -ml-5 text-tertiary transition-transform duration-100 group-open:rotate-90"
							/>
							<span className="flex w-full flex-col">
								<span className="text-secondary">Change (7d)</span>

								<span className="flex flex-nowrap items-end justify-between gap-1">
									<span className="font-jetbrains text-2xl font-semibold">{change7d_nol}</span>
									<span
										className={`${
											change7d.startsWith('-') ? 'text-data-down' : 'text-data-up'
										} overflow-hidden font-jetbrains text-ellipsis whitespace-nowrap`}
									>{`${change7d}%`}</span>
								</span>
							</span>
						</summary>

						<p className="mt-3 flex flex-wrap items-center justify-between gap-2">
							<span className="text-secondary">Change (1d)</span>
							<Tooltip
								content={change1d_nol}
								className={`overflow-hidden font-jetbrains text-ellipsis whitespace-nowrap underline decoration-dotted ${
									change1d.startsWith('-') ? 'text-data-down' : 'text-data-up'
								}`}
							>
								{`${change1d}%`}
							</Tooltip>
						</p>
						<p className="mt-3 flex flex-wrap items-center justify-between gap-2">
							<span className="text-secondary">Change (30d)</span>
							<Tooltip
								content={change30d_nol}
								className={`overflow-hidden font-jetbrains text-ellipsis whitespace-nowrap underline decoration-dotted ${
									change30d.startsWith('-') ? 'text-data-down' : 'text-data-up'
								}`}
							>
								{`${change30d}%`}
							</Tooltip>
						</p>
					</details>

					<StatItem label={<>{topChain.name} Dominance</>} value={<>{dominance}%</>} />
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar className="justify-end">
						<SegmentedControl
							value={chartType}
							onValueChange={onChartTypeChange}
							options={chartTypeOptions.map(({ key, name }) => ({ value: key, label: name }))}
							label="Chart type"
							variant="default"
							size="md"
							className="mr-auto"
						/>
						<Select
							allValues={chartViewOptions}
							selectedValues={chartView}
							setSelectedValues={onChartViewChange}
							label={getStablecoinChartViewLabel(chartView)}
							labelType="none"
							variant="filter"
							size="md"
						/>
						{stablecoinsChartConfig == null ||
						chartType === 'volume' ||
						chartView === 'hbar' ||
						chartView === 'treemap' ? null : (
							<AddToDashboardButton chartConfig={stablecoinsChartConfig} smol />
						)}
						{chartType === 'volume' ? (
							<ChartGroupingSelector
								value={volumeGroupBy}
								options={DWMC_GROUPING_OPTIONS_LOWERCASE}
								onValueChange={onVolumeGroupByChange}
							/>
						) : null}
						{chartType === 'marketCap' && chartView === 'treemap' ? (
							<ChartRestoreButton chartInstance={exportChartInstance} />
						) : null}
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename={exportMeta.filename}
							title={exportMeta.title}
						/>
					</ChartPanelToolbar>
					{chartType === 'marketCap' && chartView === 'pie' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<PieChart chartData={deferredChainsCirculatingValues} onReady={handleChartReady} />
						</React.Suspense>
					) : chartType === 'marketCap' && chartView === 'hbar' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<HBarChart
								categories={hbarData.categories}
								values={hbarData.values}
								colors={hbarData.colors}
								valueSymbol="$"
								onReady={handleChartReady}
							/>
						</React.Suspense>
					) : chartType === 'marketCap' && chartView === 'treemap' ? (
						<React.Suspense fallback={<div className="min-h-[600px]" />}>
							<TreemapChart
								treeData={treemapData}
								variant="rwa"
								height="600px"
								onReady={handleChartReady}
								valueLabel="Market Cap"
							/>
						</React.Suspense>
					) : chartType === 'volume' ? (
						<SelectedChainsChart
							data={deferredVolumeChartData}
							isLoading={isVolumeChartLoading}
							isError={!isVolumeChartLoading && volumeChartQuery.error != null}
							hideDefaultLegend={!showDefaultLegend}
							groupBy={volumeGroupBy}
							onReady={handleChartReady}
						/>
					) : (
						<SelectedChainsChart
							data={deferredSelectedChartData}
							isLoading={isSelectedChartLoading}
							isError={!isSelectedChartLoading && chartSeriesQuery.error != null}
							hideDefaultLegend={!showDefaultLegend}
							onReady={handleChartReady}
						/>
					)}
				</ChartPanel>
			</SummaryCardGrid>

			<StablecoinsChainsTable data={groupedChains} deprecatedChains={deprecatedChains} />
		</>
	)
}

function SelectedChainsChart({
	data,
	isLoading,
	isError,
	hideDefaultLegend,
	groupBy,
	onReady
}: {
	data: StablecoinChartSeriesPayload | null
	isLoading: boolean
	isError: boolean
	hideDefaultLegend: boolean
	groupBy?: LowercaseDwmcGrouping
	onReady: (instance: echarts.ECharts | null) => void
}) {
	if (isLoading) {
		return (
			<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
				Loading chart...
			</ChartPanelBodyFallback>
		)
	}
	if (isError || !data) {
		return (
			<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
				Chart unavailable
			</ChartPanelBodyFallback>
		)
	}
	if (data.charts.length === 0 || data.dataset.source.length === 0) {
		return (
			<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
				Chart unavailable
			</ChartPanelBodyFallback>
		)
	}
	return (
		<React.Suspense fallback={<ChartPanelBodyFallback />}>
			<MultiSeriesChart2
				dataset={data.dataset}
				charts={data.charts}
				stacked={data.stacked}
				expandTo100Percent={data.expandTo100Percent}
				valueSymbol={data.valueSymbol}
				showTotalInTooltip={data.showTotalInTooltip}
				hideDefaultLegend={hideDefaultLegend}
				groupBy={groupBy}
				onReady={onReady}
			/>
		</React.Suspense>
	)
}
