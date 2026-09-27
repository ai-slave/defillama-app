import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { StablecoinsChartConfig } from '~/containers/ProDashboard/types'
import {
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
	getStablecoinRuntimeSeries,
	type StablecoinChartSeriesPayload
} from '~/containers/Stablecoins/chartSeries'
import {
	getStablecoinChainsSeriesChart,
	getStablecoinChainsVolumeChartKind,
	getStablecoinDashboardChartType,
	getStablecoinChartTypeOptions,
	getStablecoinChartTypeQueryValue,
	getStablecoinChartViewLabel,
	useStablecoinChartViewChange,
	useStablecoinChartViewOptions,
	getStablecoinSeriesSelectorLabel,
	parseStablecoinChartState,
	parseStablecoinVolumeGroupBy,
	type StablecoinChartType as StablecoinChartCategory
} from '~/containers/Stablecoins/chartState'
import { useCalcCirculating, useGroupChainsPegged } from '~/containers/Stablecoins/hooks'
import { useStablecoinChartSeriesData, useStablecoinVolumeChartData } from '~/containers/Stablecoins/queries.client'
import { getStablecoinDominance, type IFormattedStablecoinChainRow } from '~/containers/Stablecoins/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { DataFreshness } from '~/ui/DataFreshness'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { isTruthyQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { fetchCompleteStablecoinSeriesCsvDataset, fetchCompleteStablecoinVolumeCsvDataset } from './csvDataset'
import {
	buildStablecoinMarketCapCsvDataset,
	buildStablecoinMarketCapPresentation,
	prepareStablecoinMarketCapSeries
} from './marketCapPresentation'
import { StablecoinChangeStats } from './StablecoinChangeStats'
import { StablecoinsChainsTable } from './StablecoinsChainsTable'
import { useStablecoinChartSelection, useStablecoinSelectionIntent } from './useStablecoinChartSelection'
import { groupStablecoinVolumeChartPayload } from './volumeChart'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>
const UNRELEASED_QUERY_KEY = 'unreleased'
const EMPTY_PIE_DATA: IPieChartProps['chartData'] = []
const EMPTY_HBAR_CATEGORIES: Array<string> = []
const EMPTY_HBAR_VALUES: Array<number> = []
const EMPTY_TREEMAP_DATA: TreemapChartProps['treeData'] = []
const EMPTY_SERIES: Array<string> = []
const EMPTY_RUNTIME_SERIES = {
	selectableSeries: EMPTY_SERIES,
	defaultSeries: EMPTY_SERIES,
	renderedSelectableSeries: EMPTY_SERIES,
	fixedRemainderSeries: EMPTY_SERIES,
	alwaysVisibleSeries: EMPTY_SERIES
}

interface ChainsWithStablecoinsProps {
	chainCirculatings: Array<IFormattedStablecoinChainRow>
	chainList: Array<string>
	chainsGroupbyParent: Record<string, Record<string, Array<string>>>
	deprecatedChains: Record<string, true>
	change1d: string | null
	change7d: string | null
	change30d: string | null
	totalMcapCurrent: number | null
	change1d_nol: string | null
	change7d_nol: string | null
	change30d_nol: string | null
	dataTimestamp: number | null
	isDataStale: boolean
}

const CHAINS_CHART_MODE = { page: 'chains' } as const
const CHAINS_CHART_TYPE_OPTIONS = getStablecoinChartTypeOptions(CHAINS_CHART_MODE)
const getChainName = (chain: { name: string }) => chain.name

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
	change30d_nol,
	dataTimestamp,
	isDataStale
}: ChainsWithStablecoinsProps) {
	const router = useRouter()
	const chartState = parseStablecoinChartState(router.query, CHAINS_CHART_MODE)
	const chartType = chartState.type
	const chartView = chartState.view
	const seriesSelectorLabel =
		getStablecoinSeriesSelectorLabel(CHAINS_CHART_MODE, chartType, chartView) ??
		(chartType === 'marketCap' && (chartView === 'pie' || chartView === 'hbar' || chartView === 'treemap')
			? 'Chain'
			: null)
	const { selectionIntent, setSelectionIntent } = useStablecoinSelectionIntent(
		`chains-${chartType}-${seriesSelectorLabel ?? 'none'}`
	)
	const volumeGroupBy = parseStablecoinVolumeGroupBy(router.query.groupBy)
	const chartTypeOptions = CHAINS_CHART_TYPE_OPTIONS
	const chartViewOptions = useStablecoinChartViewOptions(chartState)
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
	const onChartViewChange = useStablecoinChartViewChange(CHAINS_CHART_MODE, chartType, handleChartReady, router)
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
		selectionIntent,
		enabled: volumeChartKind != null
	})

	const filteredPeggedAssets = chainCirculatings
	const includeUnreleased = isTruthyQueryParam(router.query[UNRELEASED_QUERY_KEY])
	const chainTotals = useCalcCirculating<Parameters<typeof useGroupChainsPegged>[0][number]>(
		filteredPeggedAssets,
		includeUnreleased
	)

	const mcapToDisplay = formatUsd(totalMcapCurrent, {
		compact: true,
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})

	let topChain = { name: 'Ethereum', mcap: 0 }
	const topChainData = chainTotals[0]
	if (topChainData) {
		topChain.name = topChainData.name
		topChain.mcap = topChainData.mcap ?? 0
	}

	const dominance = getStablecoinDominance(topChain, totalMcapCurrent)

	const groupedChains = useGroupChainsPegged(chainTotals, chainsGroupbyParent)

	const marketCapSeries = React.useMemo(() => {
		if (chartType !== 'marketCap' || (chartView !== 'pie' && chartView !== 'hbar' && chartView !== 'treemap')) {
			return null
		}
		return prepareStablecoinMarketCapSeries({
			rows: groupedChains,
			view: chartView,
			getName: getChainName,
			getValue: (row) => row.mcap ?? 0
		})
	}, [chartType, chartView, groupedChains])

	const selectedSeriesChart = getStablecoinChainsSeriesChart(chartType, chartView)
	const chartSeriesQuery = useStablecoinChartSeriesData({
		scope: 'chains',
		chart: selectedSeriesChart,
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
		selectionIntent,
		includeUnreleased: selectedSeriesChart === 'dominance' && includeUnreleased,
		enabled: selectedSeriesChart != null
	})
	const selectedChartData = chartSeriesQuery.data ?? null
	const deferredSelectedChartData = React.useDeferredValue(selectedChartData)
	const groupedVolumeChartData = React.useMemo(
		() => (volumeChartQuery.data ? groupStablecoinVolumeChartPayload(volumeChartQuery.data, volumeGroupBy) : null),
		[volumeChartQuery.data, volumeGroupBy]
	)
	// Deferred with its grouping, so labels never pair old rows with a new grouping.
	const volumeChartSnapshot = React.useMemo(
		() => ({ data: groupedVolumeChartData, groupBy: volumeGroupBy }),
		[groupedVolumeChartData, volumeGroupBy]
	)
	const deferredVolumeChart = React.useDeferredValue(volumeChartSnapshot)
	const deferredVolumeChartData = deferredVolumeChart.data
	const isSelectedChartLoading =
		deferredSelectedChartData == null &&
		(chartSeriesQuery.isLoading || chartSeriesQuery.isFetching || chartSeriesQuery.data != null)
	const isVolumeChartLoading =
		deferredVolumeChartData == null &&
		(volumeChartQuery.isLoading || volumeChartQuery.isFetching || volumeChartQuery.data != null)
	const showDefaultLegend =
		(chartType === 'marketCap' && (chartView === 'breakdown' || chartView === 'dominance')) ||
		(chartType === 'volume' && chartView !== 'total')
	const selectedPayload = chartType === 'volume' ? deferredVolumeChartData : deferredSelectedChartData
	const runtimeSeries = React.useMemo(
		() =>
			seriesSelectorLabel && !marketCapSeries && selectedPayload
				? getStablecoinRuntimeSeries(selectedPayload)
				: EMPTY_RUNTIME_SERIES,
		[marketCapSeries, selectedPayload, seriesSelectorLabel]
	)
	const { activeSeries, selectableSeries, renderedCharts, setSelectedSeries } = useStablecoinChartSelection({
		marketCapSeries,
		runtimeSeries,
		selectionIntent,
		setSelectionIntent
	})
	const marketCapPresentation = React.useMemo(
		() =>
			marketCapSeries
				? buildStablecoinMarketCapPresentation({ series: marketCapSeries, selectedSeries: renderedCharts })
				: null,
		[marketCapSeries, renderedCharts]
	)
	const selectedChartsWithHelpers = React.useMemo(
		() => new Set([...renderedCharts, ...runtimeSeries.alwaysVisibleSeries]),
		[renderedCharts, runtimeSeries.alwaysVisibleSeries]
	)
	const activeSelectedCharts =
		seriesSelectorLabel && selectableSeries.length > 1 ? selectedChartsWithHelpers : undefined

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
	const csvSource: ChartCsvSource | null = marketCapSeries
		? { type: 'dataset', prepare: () => buildStablecoinMarketCapCsvDataset(marketCapSeries) }
		: activeSelectedCharts && volumeChartKind != null
			? {
					type: 'dataset',
					prepare: () =>
						fetchCompleteStablecoinVolumeCsvDataset({ scope: 'global', chart: volumeChartKind }, volumeGroupBy)
				}
			: activeSelectedCharts && selectedSeriesChart != null
				? {
						type: 'dataset',
						prepare: () =>
							fetchCompleteStablecoinSeriesCsvDataset(
								{
									scope: 'chains',
									chart: selectedSeriesChart,
									includeUnreleased: selectedSeriesChart === 'dominance' && includeUnreleased
								},
								null
							)
					}
				: selectedPayload
					? { type: 'dataset', prepare: () => selectedPayload.dataset }
					: null

	return (
		<>
			<SummaryCardGrid>
				<SummaryStatsCard>
					<StatItem label="Total Stablecoins Market Cap" labelAs="h1" value={mcapToDisplay} />

					<StablecoinChangeStats
						stats={[
							{ days: 7, percent: change7d, absolute: change7d_nol },
							{ days: 1, percent: change1d, absolute: change1d_nol },
							{ days: 30, percent: change30d, absolute: change30d_nol }
						]}
					/>

					<StatItem label={<>{topChain.name} Dominance</>} value={formatPercent(dominance, { input: 'percent' })} />
					{isDataStale && dataTimestamp != null ? (
						<DataFreshness timestamp={dataTimestamp} label="Market cap data last updated" className="mt-auto" />
					) : null}
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar>
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
						{seriesSelectorLabel && selectableSeries.length > 1 ? (
							<SelectWithCombobox
								allValues={selectableSeries}
								selectedValues={activeSeries}
								setSelectedValues={setSelectedSeries}
								label={seriesSelectorLabel}
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
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
							csvSource={csvSource}
						/>
					</ChartPanelToolbar>
					{chartType === 'marketCap' && chartView === 'pie' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<PieChart
								chartData={marketCapPresentation?.kind === 'pie' ? marketCapPresentation.chartData : EMPTY_PIE_DATA}
								{...(marketCapPresentation?.kind === 'pie' ? { stackColors: marketCapPresentation.stackColors } : {})}
								onReady={handleChartReady}
							/>
						</React.Suspense>
					) : chartType === 'marketCap' && chartView === 'hbar' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<HBarChart
								categories={
									marketCapPresentation?.kind === 'hbar' ? marketCapPresentation.categories : EMPTY_HBAR_CATEGORIES
								}
								values={marketCapPresentation?.kind === 'hbar' ? marketCapPresentation.values : EMPTY_HBAR_VALUES}
								colors={marketCapPresentation?.kind === 'hbar' ? marketCapPresentation.colors : EMPTY_HBAR_CATEGORIES}
								valueSymbol="$"
								onReady={handleChartReady}
							/>
						</React.Suspense>
					) : chartType === 'marketCap' && chartView === 'treemap' ? (
						<React.Suspense fallback={<div className="min-h-[600px]" />}>
							<TreemapChart
								treeData={
									marketCapPresentation?.kind === 'treemap' ? marketCapPresentation.treeData : EMPTY_TREEMAP_DATA
								}
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
							{...(activeSelectedCharts === undefined ? {} : { selectedCharts: activeSelectedCharts })}
							groupBy={deferredVolumeChart.groupBy}
							onReady={handleChartReady}
						/>
					) : (
						<SelectedChainsChart
							data={deferredSelectedChartData}
							isLoading={isSelectedChartLoading}
							isError={!isSelectedChartLoading && chartSeriesQuery.error != null}
							hideDefaultLegend={!showDefaultLegend}
							{...(activeSelectedCharts === undefined ? {} : { selectedCharts: activeSelectedCharts })}
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
	selectedCharts,
	groupBy,
	onReady
}: {
	data: StablecoinChartSeriesPayload | null
	isLoading: boolean
	isError: boolean
	hideDefaultLegend: boolean
	selectedCharts?: Set<string>
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
			<MultiSeriesChart
				dataset={data.dataset}
				charts={data.charts}
				{...(selectedCharts === undefined ? {} : { selectedCharts })}
				stacked={data.stacked}
				{...(data.expandTo100Percent === undefined ? {} : { expandTo100Percent: data.expandTo100Percent })}
				valueSymbol={data.valueSymbol}
				showTotalInTooltip={data.showTotalInTooltip}
				hideDefaultLegend={hideDefaultLegend}
				{...(groupBy === undefined ? {} : { groupBy })}
				onReady={onReady}
			/>
		</React.Suspense>
	)
}
