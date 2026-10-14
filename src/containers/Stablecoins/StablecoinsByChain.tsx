import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { ChartExportHandle } from '~/components/ChartExport/types'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
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
import { rangeQuickPicks, USD_QUICK_PICK_LADDER } from '~/components/Filters/quickPicks'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { useSelectionIntent } from '~/components/Select/localSelection'
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
	useStablecoinChartViewChange,
	useStablecoinChartViewOptions,
	getStablecoinOverviewSeriesChart,
	getStablecoinOverviewVolumeChartKind,
	getStablecoinSeriesSelectorLabel,
	getStablecoinSummarySeriesChart,
	parseStablecoinChartState,
	parseStablecoinVolumeGroupBy,
	type StablecoinChartType as StablecoinChartCategory
} from '~/containers/Stablecoins/chartState'
import { filterStablecoinAssets, resolveStablecoinFilterState } from '~/containers/Stablecoins/filterPolicy'
import { PeggedFilters } from '~/containers/Stablecoins/Filters'
import { calcCirculating } from '~/containers/Stablecoins/hooks'
import { useStablecoinChartSeriesData, useStablecoinVolumeChartData } from '~/containers/Stablecoins/queries.client'
import type { FormattedStablecoinAsset } from '~/containers/Stablecoins/utils'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelBody, ChartPanelToolbar } from '~/ui/ChartPanel'
import { DataFreshness } from '~/ui/DataFreshness'
import { Panel } from '~/ui/Panel'
import { ScopeNote } from '~/ui/ScopeNote'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Select } from '~/ui/Select'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { queryReadFailed, type QueryRetry } from '~/utils/query'
import { isTruthyQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { stablecoinBrandColors } from './brandColors'
import { fetchStablecoinSeriesCsvDataset, fetchStablecoinVolumeCsvDataset } from './csvDataset'
import { stablecoinDominanceIntro, stablecoinHubQuestions } from './hubCopy'
import {
	buildStablecoinMarketCapCsvDataset,
	buildStablecoinMarketCapPresentation,
	prepareStablecoinMarketCapSeries
} from './marketCapPresentation'
import { StablecoinChangeStats } from './StablecoinChangeStats'
import { StablecoinsTable } from './StablecoinsAssetsTable'
import { useStablecoinChartSelection } from './useStablecoinChartSelection'
import { groupStablecoinVolumeChartPayload } from './volumeChart'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

const EMPTY_CHAINS: Array<string> = []
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
const getStablecoinSnapshotName = (asset: FormattedStablecoinAsset) => asset.chartLabel

type MultiSeriesChartState =
	| { status: 'error'; retry: QueryRetry }
	| { status: 'loading' }
	| { status: 'unavailable' }
	| { status: 'ready'; data: StablecoinChartSeriesPayload }

interface StablecoinsByChainProps {
	selectedChain?: string
	chains?: Array<string>
	filteredPeggedAssets: Array<FormattedStablecoinAsset>
	availableBackings: Array<string>
	availablePegTypes: Array<string>
	defaultChartData: StablecoinChartSeriesPayload
	entityQuestions?: Array<string>
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
	const { intent: selectionIntent, setIntent: setSelectionIntent } = useSelectionIntent(
		`${selectedChain}-${chartType}-${seriesSelectorLabel ?? 'none'}`
	)
	const volumeGroupBy = parseStablecoinVolumeGroupBy(router.query.groupBy)
	const chartTypeOptions = React.useMemo(() => getStablecoinChartTypeOptions(chartMode), [chartMode])
	const chartViewOptions = useStablecoinChartViewOptions(chartState)
	const exportChartExport = useGetChartInstance()
	const onChartTypeChange = React.useCallback(
		(nextChartType: StablecoinChartCategory) => {
			exportChartExport.handleChartReady(null)
			void pushShallowQuery(router, {
				chartType: getStablecoinChartTypeQueryValue(chartMode, nextChartType),
				chartView: undefined
			})
		},
		[chartMode, exportChartExport, router]
	)
	const onChartViewChange = useStablecoinChartViewChange(
		chartMode,
		chartType,
		exportChartExport.handleChartReady,
		router
	)
	const onVolumeGroupByChange = React.useCallback(
		(nextGroupBy: LowercaseDwmcGrouping) => {
			void pushShallowQuery(router, { groupBy: nextGroupBy === 'daily' ? undefined : nextGroupBy })
		},
		[router]
	)
	const volumeChartQuery = useStablecoinVolumeChartData(
		selectedChain === 'All'
			? {
					scope: 'global',
					chart: getStablecoinOverviewVolumeChartKind(chartType, chartView, 'All'),
					selectionIntent,
					enabled: chartType === 'volume'
				}
			: {
					scope: 'chain',
					chain: selectedChain,
					chart: getStablecoinOverviewVolumeChartKind(chartType, chartView, selectedChain),
					selectionIntent,
					enabled: chartType === 'volume'
				}
	)
	const volumeChartKind = getStablecoinOverviewVolumeChartKind(chartType, chartView, selectedChain)
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

	const peggedAssets = React.useMemo(
		() => filterStablecoinAssets(filteredPeggedAssets, stablecoinFilterState),
		[filteredPeggedAssets, stablecoinFilterState]
	)
	// Counted without the mcap range, so applying a chip leaves the other chips in place.
	const mcapQuickPicks = React.useMemo(() => {
		const mcaps: Array<number | null> = []
		for (const asset of filterStablecoinAssets(filteredPeggedAssets, {
			...stablecoinFilterState,
			minMcap: null,
			maxMcap: null
		})) {
			mcaps.push(asset.mcap)
		}
		return rangeQuickPicks(USD_QUICK_PICK_LADDER, mcaps)
	}, [filteredPeggedAssets, stablecoinFilterState])

	const chainOptions = React.useMemo(
		() => ['All', ...chains].map((label) => ({ label, to: handleRouting(label, router.query) })),
		[chains, router.query]
	)

	const peggedTotals = calcCirculating<FormattedStablecoinAsset>(peggedAssets, includeUnreleased)

	const marketCapSeries = React.useMemo(() => {
		if (chartType !== 'marketCap' || (chartView !== 'pie' && chartView !== 'hbar' && chartView !== 'treemap')) {
			return null
		}
		return prepareStablecoinMarketCapSeries({
			rows: peggedTotals,
			view: chartView,
			getName: getStablecoinSnapshotName,
			getValue: (row) => row.mcap ?? 0,
			isAggregateIncluded: (row) => !row.doublecounted
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
	const summarySeriesChart = getStablecoinSummarySeriesChart(chartType, chartView, hasActiveStablecoinUrlFilters)
	const summaryChartQuery = useStablecoinChartSeriesData({
		scope: 'overview',
		chain: selectedChain,
		chart: summarySeriesChart,
		filters: stablecoinFilterQuery
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
	const chartSummary = summarySeriesChart
		? (summaryChartQuery.data?.summary ?? null)
		: hasActiveStablecoinUrlFilters
			? (selectedChartData?.summary ?? null)
			: (selectedChartData?.summary ?? defaultChartData.summary)
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
	const [isDark] = useDarkModeManager()
	const groupedSelectedChartData = React.useMemo(() => {
		if (!selectedChartData) return selectedChartData
		const payload =
			chartType === 'inflows' ? groupStablecoinBarChartPayload(selectedChartData, volumeGroupBy) : selectedChartData
		// The payload colors series by rank; a stablecoin's brand color wins.
		const brandColors = stablecoinBrandColors(isDark)
		return {
			...payload,
			charts: payload.charts.map((chart) => ({ ...chart, color: brandColors[chart.name] ?? chart.color }))
		}
	}, [chartType, isDark, selectedChartData, volumeGroupBy])

	// Each grouping and export request is deferred with its rows, so labels and the CSV never pair old rows with a
	// new grouping or chart.
	const selectedChartSnapshot = React.useMemo(() => {
		const groupBy = chartType === 'inflows' ? volumeGroupBy : undefined
		return {
			data: groupedSelectedChartData,
			groupBy,
			selectionIntent,
			prepareCsv:
				overviewChartType == null
					? null
					: () =>
							fetchStablecoinSeriesCsvDataset(
								{
									scope: 'overview',
									chain: selectedChain,
									chart: overviewChartType,
									selectionIntent,
									filters: stablecoinFilterQuery
								},
								groupBy ?? null
							)
		}
	}, [
		chartType,
		groupedSelectedChartData,
		overviewChartType,
		selectedChain,
		selectionIntent,
		stablecoinFilterQuery,
		volumeGroupBy
	])
	const volumeChartSnapshot = React.useMemo(
		() => ({
			data: groupedVolumeChartData,
			groupBy: volumeGroupBy,
			selectionIntent,
			prepareCsv:
				volumeChartKind == null
					? null
					: () =>
							fetchStablecoinVolumeCsvDataset(
								selectedChain === 'All'
									? { scope: 'global', chart: volumeChartKind, selectionIntent }
									: { scope: 'chain', chain: selectedChain, chart: volumeChartKind, selectionIntent },
								volumeGroupBy
							)
		}),
		[groupedVolumeChartData, selectedChain, selectionIntent, volumeChartKind, volumeGroupBy]
	)
	const deferredSelectedChart = React.useDeferredValue(selectedChartSnapshot)
	const deferredVolumeChart = React.useDeferredValue(volumeChartSnapshot)
	const deferredSelectedChartData = deferredSelectedChart.data
	const deferredVolumeChartData = deferredVolumeChart.data
	const renderedChart = isVolumeChart ? deferredVolumeChart : deferredSelectedChart
	const renderedGroupBy = renderedChart.groupBy
	const isVolumeChartLoading =
		deferredVolumeChartData == null &&
		(volumeChartQuery.isLoading || volumeChartQuery.isFetching || volumeChartQuery.data != null)
	const showDefaultLegend =
		(chartType === 'marketCap' && (chartView === 'breakdown' || chartView === 'dominance')) ||
		(chartType === 'volume' && chartView !== 'total')
	let activeChartState: MultiSeriesChartState
	if (isVolumeChart) {
		if (queryReadFailed(volumeChartQuery)) activeChartState = { status: 'error', retry: volumeChartQuery }
		else if (isVolumeChartLoading) activeChartState = { status: 'loading' }
		else if (!deferredVolumeChartData) activeChartState = { status: 'unavailable' }
		else activeChartState = { status: 'ready', data: deferredVolumeChartData }
	} else if (shouldFetchOverviewChart && queryReadFailed(overviewChartQuery)) {
		activeChartState = { status: 'error', retry: overviewChartQuery }
	} else if (isSelectedChartLoading || (selectedChartData != null && deferredSelectedChartData == null)) {
		activeChartState = { status: 'loading' }
	} else if (!deferredSelectedChartData) {
		activeChartState = { status: 'unavailable' }
	} else {
		activeChartState = { status: 'ready', data: deferredSelectedChartData }
	}
	const activeChartData = activeChartState.status === 'ready' ? activeChartState.data : null

	const runtimeSeries = React.useMemo(
		() =>
			seriesSelectorLabel && !marketCapSeries && activeChartData
				? getStablecoinRuntimeSeries(activeChartData)
				: EMPTY_RUNTIME_SERIES,
		[activeChartData, marketCapSeries, seriesSelectorLabel]
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
	// The chart's rows were fetched for the rendered intent, so it draws that selection; the picker shows the live one.
	const { renderedCharts: chartRenderedCharts } = useStablecoinChartSelection({
		marketCapSeries,
		runtimeSeries,
		selectionIntent: renderedChart.selectionIntent,
		setSelectionIntent
	})
	const selectedChartsWithHelpers = React.useMemo(
		() => new Set([...chartRenderedCharts, ...runtimeSeries.alwaysVisibleSeries]),
		[chartRenderedCharts, runtimeSeries.alwaysVisibleSeries]
	)
	const activeSelectedCharts =
		seriesSelectorLabel && selectableSeries.length > 1 ? selectedChartsWithHelpers : undefined
	const inflowsTooltipFormatter = React.useMemo(
		() => createInflowsTooltipFormatter({ groupBy: renderedGroupBy ?? 'daily', valueSymbol: '$' }),
		[renderedGroupBy]
	)
	const chartOptions = React.useMemo<IMultiSeriesChartProps['chartOptions']>(
		() =>
			chartType === 'inflows' && chartView === 'token' && selectedChartsWithHelpers.size > 1
				? { tooltip: { formatter: inflowsTooltipFormatter } }
				: undefined,
		[chartType, chartView, inflowsTooltipFormatter, selectedChartsWithHelpers.size]
	)
	const isHub = selectedChain === 'All'
	const dominanceIntro = isHub
		? stablecoinDominanceIntro({
				dateSec: defaultChartData.summary?.dataTimestamp ?? null,
				totalMcap: defaultChartData.summary?.totalMcapCurrent ?? null,
				assets: filteredPeggedAssets
			})
		: null
	const hubQuestions = isHub ? stablecoinHubQuestions(dominanceIntro) : []
	const csvSource: ChartCsvSource | null = marketCapSeries
		? {
				type: 'dataset',
				prepare: () => buildStablecoinMarketCapCsvDataset({ series: marketCapSeries, selectedSeries: renderedCharts })
			}
		: activeSelectedCharts && renderedChart.prepareCsv
			? { type: 'dataset', prepare: renderedChart.prepareCsv }
			: activeChartData
				? { type: 'dataset', prepare: () => activeChartData.dataset }
				: null

	return (
		<>
			<RowLinksWithDropdown heading="Chains" links={chainOptions} activeLink={selectedChain} />
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
				mcapQuickPicks={mcapQuickPicks}
			/>

			{isHub ? (
				<div className="flex flex-col gap-1">
					<h1 className="heading-sm">Top stablecoins by market cap</h1>
					{dominanceIntro ? <p className="body-sm text-secondary">{dominanceIntro}</p> : null}
				</div>
			) : null}

			<SummaryCardGrid>
				<SummaryStatsCard>
					<StablecoinChangeStats
						label={
							<span className="flex items-center gap-2">
								<span>Total {title}</span>
								{deprecated ? <DeprecatedEntityText /> : null}
							</span>
						}
						labelAs={isHub ? 'span' : 'h1'}
						value={mcapToDisplay}
						changes={chartSummary}
					/>
					<StatItem label={<>{topTokenSymbol} Dominance</>} value={formatPercent(dominance, { input: 'percent' })} />
					{chartSummary?.isDataStale && chartSummary.dataTimestamp != null ? (
						<DataFreshness
							timestamp={chartSummary.dataTimestamp}
							label="Market cap data last updated"
							className="mt-auto"
						/>
					) : null}
				</SummaryStatsCard>
				<Panel className="col-span-2">
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
							heading="Chart view"
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
							<ChartRestoreButton chartInstance={exportChartExport.chartInstance} />
						) : null}
						<ChartExportButtons
							chart={exportChartExport}
							filename={getImageExportFilename()}
							title={getImageExportTitle()}
							{...(selectedChain !== 'All' ? { iconUrl: chainIconUrl(selectedChain) } : {})}
							csvSource={csvSource}
						/>
					</ChartPanelToolbar>
					{/* The volume API reports by symbol, so it cannot apply the stablecoin filters. */}
					{isVolumeChart && hasActiveStablecoinUrlFilters ? (
						<ScopeNote>This chart ignores the filters above and shows volume for every stablecoin.</ScopeNote>
					) : null}
					{chartType === 'marketCap' && chartView === 'pie' ? (
						<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<PieChart
								exportButtons={exportChartExport}
								chartData={marketCapPresentation?.kind === 'pie' ? marketCapPresentation.chartData : EMPTY_PIE_DATA}
								{...(marketCapPresentation?.kind === 'pie' ? { stackColors: marketCapPresentation.stackColors } : {})}
							/>
						</React.Suspense>
					) : chartType === 'marketCap' && chartView === 'hbar' ? (
						<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<HBarChart
								categories={
									marketCapPresentation?.kind === 'hbar' ? marketCapPresentation.categories : EMPTY_HBAR_CATEGORIES
								}
								values={marketCapPresentation?.kind === 'hbar' ? marketCapPresentation.values : EMPTY_HBAR_VALUES}
								colors={marketCapPresentation?.kind === 'hbar' ? marketCapPresentation.colors : EMPTY_HBAR_CATEGORIES}
								valueSymbol="$"
								exportButtons={exportChartExport}
							/>
						</React.Suspense>
					) : chartType === 'marketCap' && chartView === 'treemap' ? (
						<ChartPanelBody className="min-h-[600px]">
							<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[600px]" />}>
								<TreemapChart
									treeData={
										marketCapPresentation?.kind === 'treemap' ? marketCapPresentation.treeData : EMPTY_TREEMAP_DATA
									}
									variant="rwa"
									containerClassName="min-h-[600px]"
									exportButtons={exportChartExport}
									valueLabel="Market Cap"
								/>
							</React.Suspense>
						</ChartPanelBody>
					) : (
						<MultiSeriesChartPanel
							state={activeChartState}
							{...(activeSelectedCharts === undefined ? {} : { selectedCharts: activeSelectedCharts })}
							{...(chartOptions === undefined ? {} : { chartOptions })}
							showLegend={showDefaultLegend}
							{...(renderedGroupBy ? { groupBy: renderedGroupBy } : {})}
							exportButtons={exportChartExport}
						/>
					)}
				</Panel>
			</SummaryCardGrid>

			{hubQuestions.length > 0 ? (
				<div className="flex flex-col gap-3">
					{hubQuestions.map((item) => (
						<div key={item.question} className="flex flex-col gap-1">
							<h2 className="heading-xs">{item.question}</h2>
							<p className="body-sm text-secondary">{item.answer}</p>
						</div>
					))}
				</div>
			) : null}

			<NewsletterSignup layout="strip" />

			<StablecoinsTable data={peggedTotals} />
		</>
	)
}

function MultiSeriesChartPanel({
	state,
	selectedCharts,
	chartOptions,
	showLegend,
	groupBy,
	exportButtons
}: {
	state: MultiSeriesChartState
	selectedCharts?: Set<string>
	chartOptions?: IMultiSeriesChartProps['chartOptions']
	showLegend?: boolean
	groupBy?: IMultiSeriesChartProps['groupBy']
	exportButtons: ChartExportHandle
}) {
	if (state.status === 'error') {
		return (
			<SurfaceBodyStatus variant="error" retry={state.retry}>
				Couldn&apos;t load chart data.
			</SurfaceBodyStatus>
		)
	}
	if (state.status === 'loading') {
		return <SurfaceBodyLoadingStatus label="Loading chart" />
	}
	if (state.status === 'unavailable' || state.data.charts.length === 0 || state.data.dataset.source.length === 0) {
		return <SurfaceBodyStatus variant="empty">Chart unavailable.</SurfaceBodyStatus>
	}
	return (
		<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
			<MultiSeriesChart
				exportButtons={exportButtons}
				dataset={state.data.dataset}
				charts={state.data.charts}
				{...(selectedCharts === undefined ? {} : { selectedCharts })}
				stacked={state.data.stacked}
				{...(state.data.expandTo100Percent === undefined ? {} : { expandTo100Percent: state.data.expandTo100Percent })}
				valueSymbol={state.data.valueSymbol}
				showTotalInTooltip={state.data.showTotalInTooltip}
				{...(chartOptions === undefined ? {} : { chartOptions })}
				showLegend={showLegend}
				{...(groupBy === undefined ? {} : { groupBy })}
			/>
		</React.Suspense>
	)
}

function handleRouting(selectedChain: string, queryParams: Record<string, string | Array<string> | undefined>) {
	const { chain: _chain, ...filters } = queryParams
	const queryParts: Array<string> = []
	for (const filter in filters) {
		const value = filters[filter]
		if (Array.isArray(value)) {
			for (const item of value) {
				queryParts.push(`${encodeURIComponent(filter)}=${encodeURIComponent(item)}`)
			}
		} else if (typeof value === 'string') {
			queryParts.push(`${encodeURIComponent(filter)}=${encodeURIComponent(value)}`)
		}
	}
	const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

	if (selectedChain === 'All') return `/stablecoins${query}`
	return `/stablecoins/${slug(selectedChain)}${query}`
}
