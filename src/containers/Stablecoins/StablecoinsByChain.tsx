import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { buildSelectedSeriesCsv } from '~/components/ECharts/MultiSeriesChart/selection'
import { createInflowsTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { StablecoinsChartConfig } from '~/containers/ProDashboard/types'
import {
	groupStablecoinBarChartPayload,
	getStablecoinRuntimeSeries,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
	type StablecoinChartSeriesPayload
} from '~/containers/Stablecoins/chartSeries'
import {
	createStablecoinOverviewChartMode,
	getStablecoinDashboardChartType,
	getStablecoinChartTypeOptions,
	getStablecoinChartTypeQueryValue,
	getStablecoinChartViewLabel,
	getStablecoinChartViewOptions,
	getStablecoinChartViewQueryValue,
	getStablecoinOverviewSeriesChart,
	getStablecoinOverviewVolumeChartKind,
	getStablecoinSeriesSelectorLabel,
	parseStablecoinChartState,
	parseStablecoinVolumeGroupBy,
	type StablecoinChartType as StablecoinChartCategory,
	type StablecoinChartView
} from '~/containers/Stablecoins/chartState'
import { filterStablecoinAssets, resolveStablecoinFilterState } from '~/containers/Stablecoins/filterPolicy'
import { PeggedFilters } from '~/containers/Stablecoins/Filters'
import { useCalcCirculating } from '~/containers/Stablecoins/hooks'
import { useStablecoinChartSeriesData, useStablecoinVolumeChartData } from '~/containers/Stablecoins/queries.client'
import { type FormattedStablecoinAsset } from '~/containers/Stablecoins/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { DataFreshness } from '~/ui/DataFreshness'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { isTruthyQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import type { StablecoinVolumeChainChartKind, StablecoinVolumeGlobalChartKind } from './api.types'
import {
	buildStablecoinMarketCapPresentation,
	prepareStablecoinMarketCapSeries,
	prepareStablecoinMarketCapTreemapCsv
} from './marketCapPresentation'
import { StablecoinChangeStats, type StablecoinChangeStat } from './StablecoinChangeStats'
import { StablecoinsTable } from './StablecoinsAssetsTable'
import { useStablecoinChartSelection, useStablecoinSelectionIntent } from './useStablecoinChartSelection'
import { groupStablecoinVolumeChartPayload } from './volumeChart'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

const EMPTY_CHAINS: string[] = []
const UNRELEASED_QUERY_KEY = 'unreleased'
const EMPTY_PIE_DATA: IPieChartProps['chartData'] = []
const EMPTY_HBAR_CATEGORIES: string[] = []
const EMPTY_HBAR_VALUES: number[] = []
const EMPTY_TREEMAP_DATA: TreemapChartProps['treeData'] = []
const EMPTY_SERIES: string[] = []
const EMPTY_RUNTIME_SERIES = {
	selectableSeries: EMPTY_SERIES,
	renderedSelectableSeries: EMPTY_SERIES,
	fixedRemainderSeries: EMPTY_SERIES,
	alwaysVisibleSeries: EMPTY_SERIES
}
const getStablecoinSnapshotName = (asset: FormattedStablecoinAsset) => asset.symbol || asset.name

type MultiSeriesChartState =
	| { status: 'loading' }
	| { status: 'unavailable' }
	| { status: 'ready'; data: StablecoinChartSeriesPayload }

interface StablecoinsByChainProps {
	selectedChain?: string
	chains?: string[]
	filteredPeggedAssets: FormattedStablecoinAsset[]
	availableBackings: string[]
	availablePegTypes: string[]
	defaultChartData: StablecoinChartSeriesPayload
	entityQuestions?: string[]
	deprecated?: boolean
}

export function StablecoinsByChain({
	selectedChain = 'All',
	chains = EMPTY_CHAINS,
	filteredPeggedAssets,
	availableBackings,
	availablePegTypes,
	defaultChartData,
	entityQuestions,
	deprecated
}: StablecoinsByChainProps) {
	const router = useRouter()
	const chartMode = React.useMemo(() => createStablecoinOverviewChartMode(selectedChain), [selectedChain])
	const chartState = parseStablecoinChartState(router.query, chartMode)
	const chartType = chartState.type
	const chartView = chartState.view
	const seriesSelectorLabel =
		getStablecoinSeriesSelectorLabel(chartMode, chartType, chartView) ??
		(chartType === 'marketCap' && (chartView === 'pie' || chartView === 'hbar' || chartView === 'treemap')
			? 'Token'
			: null)
	const { selectionIntent, setSelectionIntent } = useStablecoinSelectionIntent(
		`${selectedChain}-${chartType}-${seriesSelectorLabel ?? 'none'}`
	)
	const volumeGroupBy = parseStablecoinVolumeGroupBy(router.query.groupBy)
	const chartTypeOptions = React.useMemo(() => getStablecoinChartTypeOptions(chartMode), [chartMode])
	const chartViewOptions = React.useMemo(() => getStablecoinChartViewOptions(chartState), [chartState])
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()
	const onChartTypeChange = React.useCallback(
		(nextChartType: StablecoinChartCategory) => {
			handleChartReady(null)
			void pushShallowQuery(router, {
				chartType: getStablecoinChartTypeQueryValue(chartMode, nextChartType),
				chartView: undefined
			})
		},
		[chartMode, handleChartReady, router]
	)
	const onChartViewChange = React.useCallback(
		(nextChartView: string) => {
			const view = nextChartView as StablecoinChartView
			handleChartReady(null)
			void pushShallowQuery(router, {
				chartView: getStablecoinChartViewQueryValue(chartMode, chartType, view)
			})
		},
		[chartMode, chartType, handleChartReady, router]
	)
	const onVolumeGroupByChange = React.useCallback(
		(nextGroupBy: LowercaseDwmcGrouping) => {
			void pushShallowQuery(router, { groupBy: nextGroupBy === 'daily' ? undefined : nextGroupBy })
		},
		[router]
	)
	const volumeChartKind = getStablecoinOverviewVolumeChartKind(chartType, chartView, selectedChain)
	const volumeChartQuery = useStablecoinVolumeChartData(
		selectedChain === 'All'
			? {
					scope: 'global',
					chart: volumeChartKind as StablecoinVolumeGlobalChartKind | null,
					selectionIntent,
					enabled: volumeChartKind != null
				}
			: {
					scope: 'chain',
					chain: selectedChain,
					chart: volumeChartKind as StablecoinVolumeChainChartKind | null,
					selectionIntent,
					enabled: volumeChartKind != null
				}
	)
	const unreleasedQueryParam = router.query[UNRELEASED_QUERY_KEY]

	const includeUnreleased = isTruthyQueryParam(unreleasedQueryParam)
	const stablecoinFilterQuery = React.useMemo(
		() => ({
			attribute: router.query.attribute,
			excludeAttribute: router.query.excludeAttribute,
			pegtype: router.query.pegtype,
			excludePegtype: router.query.excludePegtype,
			backing: router.query.backing,
			excludeBacking: router.query.excludeBacking,
			minMcap: router.query.minMcap,
			maxMcap: router.query.maxMcap
		}),
		[
			router.query.attribute,
			router.query.excludeAttribute,
			router.query.pegtype,
			router.query.excludePegtype,
			router.query.backing,
			router.query.excludeBacking,
			router.query.minMcap,
			router.query.maxMcap
		]
	)
	const stablecoinFilterState = React.useMemo(
		() => resolveStablecoinFilterState(stablecoinFilterQuery),
		[stablecoinFilterQuery]
	)
	const hasActiveStablecoinUrlFilters = stablecoinFilterState.hasActiveFilters

	// `handleChartReady` is passed to charts' `onReady` prop to share
	// a single ECharts instance across CSV + PNG exports.

	const peggedAssets = React.useMemo(
		() => filterStablecoinAssets(filteredPeggedAssets, stablecoinFilterState),
		[filteredPeggedAssets, stablecoinFilterState]
	)

	const chainOptions = React.useMemo(
		() => ['All', ...chains].map((label) => ({ label, to: handleRouting(label, router.query) })),
		[chains, router.query]
	)

	const peggedTotals = useCalcCirculating<FormattedStablecoinAsset>(peggedAssets, includeUnreleased)

	const marketCapSeries = React.useMemo(() => {
		if (chartType !== 'marketCap' || (chartView !== 'pie' && chartView !== 'hbar' && chartView !== 'treemap')) {
			return null
		}
		return prepareStablecoinMarketCapSeries({
			rows: peggedTotals,
			view: chartView,
			getName: getStablecoinSnapshotName,
			getValue: (row) => row.mcap ?? 0
		})
	}, [chartType, chartView, peggedTotals])

	let title = `Stablecoins Market Cap`
	if (selectedChain !== 'All') {
		title = `${selectedChain} Stablecoins Market Cap`
	}

	const dashboardChartType = getStablecoinDashboardChartType(chartType, chartView)
	const isVolumeChart = volumeChartKind != null
	const isGroupedBarChart = isVolumeChart || chartType === 'inflows'
	const overviewChartType = getStablecoinOverviewSeriesChart(chartType, chartView)
	const isMarketCapTableChart =
		chartType === 'marketCap' && (chartView === 'pie' || chartView === 'hbar' || chartView === 'treemap')
	const shouldFetchOverviewChart =
		overviewChartType != null && (chartType !== 'marketCap' || chartView !== 'total' || hasActiveStablecoinUrlFilters)
	const overviewChartQuery = useStablecoinChartSeriesData({
		scope: 'overview',
		chain: selectedChain,
		chart: overviewChartType,
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
		selectionIntent,
		filters: stablecoinFilterQuery,
		enabled: shouldFetchOverviewChart
	})
	const summaryChartQuery = useStablecoinChartSeriesData({
		scope: 'overview',
		chain: selectedChain,
		chart: 'totalMcap',
		filters: stablecoinFilterQuery,
		enabled: isMarketCapTableChart && hasActiveStablecoinUrlFilters
	})
	const selectedChartData =
		shouldFetchOverviewChart && overviewChartType
			? (overviewChartQuery.data ?? null)
			: overviewChartType
				? defaultChartData
				: null
	const isSelectedChartLoading =
		shouldFetchOverviewChart &&
		(overviewChartQuery.isLoading ||
			(selectedChartData == null && (overviewChartQuery.isFetching || overviewChartQuery.data != null)))
	const isSelectedChartUnavailable =
		shouldFetchOverviewChart && !isSelectedChartLoading && (overviewChartQuery.error != null || !selectedChartData)
	const chartSummary =
		(isMarketCapTableChart && hasActiveStablecoinUrlFilters
			? summaryChartQuery.data?.summary
			: selectedChartData?.summary) ?? defaultChartData.summary
	const toChangeStat = (
		days: StablecoinChangeStat['days'],
		percent: string | null | undefined,
		absolute: number | null | undefined
	): StablecoinChangeStat => {
		const absoluteLabel =
			absolute == null
				? null
				: formatUsd(String(absolute), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		return {
			days,
			percent: percent == null ? null : percent.startsWith('-') ? percent : `+${percent}`,
			absolute: absoluteLabel == null ? null : absoluteLabel.startsWith('-') ? absoluteLabel : `+${absoluteLabel}`
		}
	}
	const changeStats = [
		toChangeStat(7, chartSummary?.change7d, chartSummary?.change7dUsd),
		toChangeStat(1, chartSummary?.change1d, chartSummary?.change1dUsd),
		toChangeStat(30, chartSummary?.change30d, chartSummary?.change30dUsd)
	]
	const totalMcapCurrent = chartSummary?.totalMcapCurrent ?? null
	const mcapToDisplay = formatUsd(totalMcapCurrent, {
		compact: true,
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})
	const dominance = chartSummary?.dominance ?? null
	const topTokenSymbol = chartSummary?.topToken.symbol ?? 'USDT'

	const stablecoinsChartConfig: StablecoinsChartConfig | null = dashboardChartType
		? {
				id: `stablecoins-${selectedChain}-${dashboardChartType}`,
				kind: 'stablecoins',
				chain: selectedChain,
				chartType: dashboardChartType
			}
		: null

	const getImageExportTitle = () => {
		const baseTitle = selectedChain !== 'All' ? `${selectedChain} Stablecoins` : 'Stablecoins'

		if (chartType === 'marketCap') {
			return chartView === 'total' ? baseTitle : `${baseTitle} Market Cap`
		}
		if (chartType === 'volume') {
			return chartView === 'total' ? baseTitle : `${baseTitle} Volume`
		}
		if (chartType === 'inflows') {
			return chartView === 'usd' ? baseTitle : `${baseTitle} Inflows`
		}

		return baseTitle
	}

	const getImageExportFilename = () => {
		const chainSlug = selectedChain !== 'All' ? `${slug(selectedChain)}-` : ''
		const chartSlug = `${chartType}-${chartView}`.toLowerCase()
		return `stablecoins-${chainSlug}${chartSlug}`
	}

	const groupedVolumeChartData = React.useMemo(
		() => (volumeChartQuery.data ? groupStablecoinVolumeChartPayload(volumeChartQuery.data, volumeGroupBy) : null),
		[volumeChartQuery.data, volumeGroupBy]
	)
	const groupedSelectedChartData = React.useMemo(
		() =>
			chartType === 'inflows' && selectedChartData
				? groupStablecoinBarChartPayload(selectedChartData, volumeGroupBy)
				: selectedChartData,
		[chartType, selectedChartData, volumeGroupBy]
	)

	const deferredSelectedChartData = React.useDeferredValue(groupedSelectedChartData)
	const deferredVolumeChartData = React.useDeferredValue(groupedVolumeChartData)
	const isVolumeChartLoading =
		deferredVolumeChartData == null &&
		(volumeChartQuery.isLoading || volumeChartQuery.isFetching || volumeChartQuery.data != null)
	const showDefaultLegend =
		(chartType === 'marketCap' && (chartView === 'breakdown' || chartView === 'dominance')) ||
		(chartType === 'volume' && chartView !== 'total')
	let activeChartState: MultiSeriesChartState
	if (isVolumeChart) {
		if (isVolumeChartLoading) activeChartState = { status: 'loading' }
		else if (volumeChartQuery.error || !deferredVolumeChartData) activeChartState = { status: 'unavailable' }
		else activeChartState = { status: 'ready', data: deferredVolumeChartData }
	} else if (isSelectedChartLoading || (selectedChartData != null && deferredSelectedChartData == null)) {
		activeChartState = { status: 'loading' }
	} else if (isSelectedChartUnavailable || !deferredSelectedChartData) {
		activeChartState = { status: 'unavailable' }
	} else {
		activeChartState = { status: 'ready', data: deferredSelectedChartData }
	}

	const runtimeSeries = React.useMemo(
		() =>
			seriesSelectorLabel && !marketCapSeries && activeChartState.status === 'ready'
				? getStablecoinRuntimeSeries(activeChartState.data)
				: EMPTY_RUNTIME_SERIES,
		[activeChartState, marketCapSeries, seriesSelectorLabel]
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
	const inflowsTooltipFormatter = React.useMemo(
		() => createInflowsTooltipFormatter({ groupBy: volumeGroupBy, valueSymbol: '$' }),
		[volumeGroupBy]
	)
	const chartOptions = React.useMemo<IMultiSeriesChartProps['chartOptions']>(
		() =>
			chartType === 'inflows' && chartView === 'token' && selectedChartsWithHelpers.size > 1
				? { tooltip: { formatter: inflowsTooltipFormatter } }
				: undefined,
		[chartType, chartView, inflowsTooltipFormatter, selectedChartsWithHelpers.size]
	)
	const prepareCsvDirect =
		marketCapPresentation?.kind === 'treemap'
			? () =>
					prepareStablecoinMarketCapTreemapCsv({
						treeData: marketCapPresentation.treeData,
						filename: getImageExportFilename()
					})
			: activeSelectedCharts && activeChartState.status === 'ready'
				? () =>
						buildSelectedSeriesCsv({
							dataset: activeChartState.data.dataset,
							charts: activeChartState.data.charts,
							selectedCharts: activeSelectedCharts,
							filename: getImageExportFilename()
						})
				: undefined

	return (
		<>
			<RowLinksWithDropdown links={chainOptions} activeLink={selectedChain} />
			{entityQuestions != null && entityQuestions.length > 0 ? (
				<EntityQuestionsStrip
					questions={entityQuestions}
					entitySlug="stablecoins"
					entityType="page"
					entityName="Stablecoins"
				/>
			) : null}

			<PeggedFilters
				pathname={selectedChain === 'All' ? '/stablecoins' : `/stablecoins/${selectedChain}`}
				availableBackings={availableBackings}
				availablePegTypes={availablePegTypes}
			/>

			<SummaryCardGrid>
				<SummaryStatsCard>
					<StatItem
						label={
							<span className="flex items-center gap-2">
								<span>Total {title}</span>
								{deprecated ? <DeprecatedEntityText /> : null}
							</span>
						}
						labelAs="h1"
						value={mcapToDisplay}
					/>
					<StablecoinChangeStats stats={changeStats} />
					<StatItem label={<>{topTokenSymbol} Dominance</>} value={formatPercent(dominance, { input: 'percent' })} />
					{chartSummary?.isDataStale && chartSummary.dataTimestamp != null ? (
						<DataFreshness
							timestamp={chartSummary.dataTimestamp}
							label="Market cap data last updated"
							className="mt-auto"
						/>
					) : null}
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
						isVolumeChart ||
						chartView === 'hbar' ||
						chartView === 'treemap' ? null : (
							<AddToDashboardButton chartConfig={stablecoinsChartConfig} smol />
						)}
						{isGroupedBarChart ? (
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
							filename={getImageExportFilename()}
							title={getImageExportTitle()}
							iconUrl={selectedChain !== 'All' ? chainIconUrl(selectedChain) : undefined}
							prepareCsvDirect={prepareCsvDirect}
						/>
					</ChartPanelToolbar>
					{chartType === 'marketCap' && chartView === 'pie' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<PieChart
								chartData={marketCapPresentation?.kind === 'pie' ? marketCapPresentation.chartData : EMPTY_PIE_DATA}
								stackColors={marketCapPresentation?.kind === 'pie' ? marketCapPresentation.stackColors : undefined}
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
					) : (
						<MultiSeriesChartPanel
							state={activeChartState}
							selectedCharts={activeSelectedCharts}
							chartOptions={chartOptions}
							hideDefaultLegend={!showDefaultLegend}
							groupBy={isGroupedBarChart ? volumeGroupBy : undefined}
							onReady={handleChartReady}
						/>
					)}
				</ChartPanel>
			</SummaryCardGrid>

			<NewsletterSignup layout="strip" />

			<StablecoinsTable data={peggedTotals} />
		</>
	)
}

function MultiSeriesChartPanel({
	state,
	selectedCharts,
	chartOptions,
	hideDefaultLegend,
	groupBy,
	onReady
}: {
	state: MultiSeriesChartState
	selectedCharts?: Set<string>
	chartOptions?: IMultiSeriesChartProps['chartOptions']
	hideDefaultLegend?: boolean
	groupBy?: IMultiSeriesChartProps['groupBy']
	onReady: (instance: echarts.ECharts | null) => void
}) {
	if (state.status === 'loading') {
		return (
			<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
				Loading chart...
			</ChartPanelBodyFallback>
		)
	}
	if (state.status === 'unavailable') {
		return (
			<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
				Chart unavailable
			</ChartPanelBodyFallback>
		)
	}
	if (state.data.charts.length === 0 || state.data.dataset.source.length === 0) {
		return (
			<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
				Chart unavailable
			</ChartPanelBodyFallback>
		)
	}
	return (
		<React.Suspense fallback={<ChartPanelBodyFallback />}>
			<MultiSeriesChart
				dataset={state.data.dataset}
				charts={state.data.charts}
				selectedCharts={selectedCharts}
				stacked={state.data.stacked}
				expandTo100Percent={state.data.expandTo100Percent}
				valueSymbol={state.data.valueSymbol}
				showTotalInTooltip={state.data.showTotalInTooltip}
				chartOptions={chartOptions}
				hideDefaultLegend={hideDefaultLegend}
				groupBy={groupBy}
				onReady={onReady}
			/>
		</React.Suspense>
	)
}

function handleRouting(selectedChain: string, queryParams: Record<string, string | string[] | undefined>) {
	const { chain: _chain, ...filters } = queryParams

	let params = ''

	const filterKeys: string[] = []
	for (const filterKey in filters) {
		filterKeys.push(filterKey)
	}
	for (let index = 0; index < filterKeys.length; index++) {
		const filter = filterKeys[index]
		// append '?' before all query params and '&' bertween diff params
		if (index === 0) {
			params += '?'
		} else params += '&'

		// query params of same query like pegType will return in array form - pegType=['USD','EUR'], expected output is pegType=USD&pegType=EUR
		if (Array.isArray(filters[filter])) {
			for (let i = 0; i < filters[filter].length; i++) {
				const f = filters[filter][i]
				if (i > 0) {
					params += '&'
				}

				params += `${encodeURIComponent(filter)}=${encodeURIComponent(f)}`
			}
		} else {
			const value = filters[filter]
			if (typeof value !== 'string') continue
			params += `${encodeURIComponent(filter)}=${encodeURIComponent(value)}`
		}
	}

	if (selectedChain === 'All') return `/stablecoins${params}`
	return `/stablecoins/${slug(selectedChain)}${params}`
}
