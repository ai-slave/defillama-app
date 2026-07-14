import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { ChartGroupingSelector, DWMC_GROUPING_OPTIONS_LOWERCASE } from '~/components/ECharts/ChartGroupingSelector'
import type {
	IHBarChartProps,
	IMultiSeriesChart2Props,
	IPieChartProps,
	ITreemapChartProps,
	MultiSeriesChart2SeriesConfig
} from '~/components/ECharts/types'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Select } from '~/components/Select/Select'
import { CHART_COLORS } from '~/constants/colors'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum, slug } from '~/utils'
import { pushShallowQuery, readSingleQueryValue, toNonEmptyArrayParam, toQueryString } from '~/utils/routerQuery'
import type { IRWAAssetsOverview, RWAAssetChartTarget, RWAChartMetricKey, RWAFlowOverviewSplitBy } from './api.types'
import { RWAAssetsTable } from './AssetsTable'
import {
	emptyChartDatasets,
	getRwaChartTotalLabel,
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	sortRwaChartSeriesLabels,
	type RWAChartAggregationMode
} from './chartAggregation'
import { limitRwaHorizontalBarData, type RWAChartDataset } from './chartDataset'
import {
	createRwaChartModeState,
	getBreakdownLabel,
	getChartBreakdownOptions,
	getChartBreakdownQueryValue,
	getChartMetricLabel,
	getChartMetricOptions,
	getChartMetricQueryValue,
	getChartViewOptions,
	getChartViewQueryValue,
	getDefaultChartBreakdown,
	type RWAChartBreakdown,
	getTreemapNestedByLabel,
	getTreemapNestedByOptions,
	getTreemapNestedByQueryValue,
	getTreemapParentGrouping,
	parseRwaChartState,
	setChartBreakdown,
	setTreemapNestedBy,
	type RWAChartState
} from './chartState'
import { type RWAOverviewMode } from './constants'
import { definitions } from './definitions'
import { RWAOverviewFilters } from './Filters'
import { RWAFlowVsPriceStrip } from './FlowPanelParts'
import {
	aggregateRWAFlowRows,
	buildRWAFilteredFlowBreakdown,
	getRWAFlowOverlayQueryValue,
	getRWAFlowVsPriceSummary,
	parseRWAFlowGrouping,
	parseRWAFlowMode,
	parseRWAFlowOverlayMetrics,
	RWA_FLOW_MODE_OPTIONS,
	RWA_FLOW_OVERLAY_OPTIONS,
	type RWAFlowChartMode,
	type RWAFlowGrouping,
	type RWAFlowOverlay
} from './flows'
import { type RWAFlowScope, useRWAFlowAssetBreakdown, useRWAFlowOverviewSplitWithFilters } from './flows.hooks'
import {
	useFilteredRwaAssets,
	useRWATableQueryParams,
	useRWAAssetCategoryPieChartData,
	useRwaAssetGroupPieChartData,
	useRwaAssetNamePieChartData,
	useRwaAssetPlatformPieChartData,
	useRwaCategoryAssetClassPieChartData,
	useRwaChainBreakdownPieChartData,
	useRwaChartDataset,
	hasActiveChartFilters
} from './hooks'
import { perpsDefinitions } from './Perps/definitions'
import { rwaSlug } from './rwaSlug'
import { buildRwaNestedTreemapTreeData, buildRwaTreemapTreeData, canBuildRwaNestedTreemap } from './treemap'

const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<ITreemapChartProps>
const RWAFlowsChart = lazy(() => import('./FlowsChart').then((module) => ({ default: module.RWAFlowsChart })))
const RWAFlowRotationChart = lazy(() =>
	import('./FlowRotationChart').then((module) => ({ default: module.RWAFlowRotationChart }))
)
const EMPTY_INITIAL_CHART_DATASET = emptyChartDatasets()

type RWAOverviewChartMetric = RWAChartState['metric'] | 'flows'

const RWA_NON_PLATFORM_FLOW_MODE_OPTIONS = RWA_FLOW_MODE_OPTIONS.filter((option) => option.value !== 'flowVsPrice')

const RWA_FLOW_ROTATION_SPLIT_OPTIONS: Array<{
	value: RWAFlowOverviewSplitBy
	label: string
	tooltip: string
}> = [
	{ value: 'assetGroup', label: 'Asset Groups', tooltip: definitions.flows.rotationGrouping.description },
	{ value: 'category', label: 'Categories', tooltip: definitions.flows.rotationGrouping.description },
	{
		value: 'chain',
		label: definitions.flows.rotationChains.label,
		tooltip: definitions.flows.rotationChains.description
	}
]

function getRwaFlowRotationSplitBy(value: string | undefined): RWAFlowOverviewSplitBy {
	if (value === 'category' || value === 'chain') return value
	if (value === 'platform') return value
	return 'assetGroup'
}

function getRwaFlowRotationFrequency(value: string | undefined): RWAFlowGrouping {
	if (value == null) return 'monthly'
	const groupBy = parseRWAFlowGrouping(value)
	return groupBy === value ? groupBy : 'monthly'
}

export const RWAOverview = (props: IRWAAssetsOverview) => {
	const router = useRouter()
	const getSelectedFilterValue = (value: string | string[]) => (Array.isArray(value) ? value[0] : value)

	const mode = getRWAOverviewMode(props)
	const isChainMode = mode === 'chain'
	const isCategoryMode = mode === 'category'
	const isPlatformMode = mode === 'platform'
	const isAssetGroupMode = mode === 'assetGroup'
	const canBreakdownByChain = isCategoryMode || isPlatformMode || isAssetGroupMode || props.selectedChain === 'All'
	const chartMode = createRwaChartModeState(mode, canBreakdownByChain)
	const chartState = parseRwaChartState(router.query, chartMode)
	const isFlowMetric = readSingleQueryValue(router.query.chartType) === 'flows'
	const chartTypeKey = chartState.metric
	const chartView = isFlowMetric ? 'timeSeries' : chartState.view
	const rawTimeSeriesBreakdownQuery = router.query.timeSeriesChartBreakdown
	const isTotalTimeSeriesSelected =
		chartView === 'timeSeries' &&
		(Array.isArray(rawTimeSeriesBreakdownQuery) ? rawTimeSeriesBreakdownQuery[0] : rawTimeSeriesBreakdownQuery) ===
			'total'
	const timeSeriesBreakdown = isFlowMetric
		? getDefaultChartBreakdown(chartMode, 'timeSeries')
		: chartView === 'timeSeries'
			? isTotalTimeSeriesSelected
				? 'total'
				: chartState.breakdown
			: getDefaultChartBreakdown(chartMode, 'timeSeries')
	const nonTimeSeriesBreakdown =
		chartView === 'timeSeries' ? getDefaultChartBreakdown(chartMode, 'pie') : chartState.breakdown

	const {
		selectedAssetNames,
		selectedTypes,
		selectedCategories,
		selectedPlatforms,
		selectedAssetGroups,
		selectedAssetClasses,
		selectedRwaClassifications,
		selectedAccessModels,
		selectedIssuers,
		selectedRedeemableStates,
		selectedAttestationsStates,
		selectedCexListedStates,
		selectedKycForMintRedeemStates,
		selectedKycAllowlistedWhitelistedToTransferHoldStates,
		selectedTransferableStates,
		selectedSelfCustodyStates,
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps,
		hasPerpsOverlayBlockingFilters,
		setDefiActiveTvlToOnChainMcapPctRange,
		setActiveMcapToOnChainMcapPctRange,
		setDefiActiveTvlToActiveMcapPctRange,
		setIncludeStablecoins,
		setIncludeGovernance,
		setIncludeRwaPerps,
		setRedeemableStates,
		setAttestationsStates,
		setCexListedStates,
		setKycForMintRedeemStates,
		setKycAllowlistedWhitelistedToTransferHoldStates,
		setTransferableStates,
		setSelfCustodyStates
	} = useRWATableQueryParams({
		assetNames: props.assetNames,
		types: props.types,
		categories: props.categories,
		platforms: props.platforms,
		assetClasses: props.assetClasses,
		rwaClassifications: props.rwaClassifications,
		accessModels: props.accessModels,
		issuers: props.issuers,
		assetGroups: props.assetGroups,
		chainSlug: props.chainSlug,
		categorySlug: props.categorySlug,
		platformSlug: props.platformSlug,
		assetGroupSlug: props.assetGroupSlug,
		mode
	})

	const {
		filteredAssets,
		totalOnChainMcap,
		totalActiveMcap,
		totalOnChainDeFiActiveTvl,
		totalOpenInterest,
		totalIssuersCount
	} = useFilteredRwaAssets({
		assets: props.assets,
		isPlatformMode,
		selectedAssetNames,
		selectedCategories,
		selectedPlatforms,
		selectedAssetGroups,
		selectedAssetClasses,
		selectedRwaClassifications,
		selectedAccessModels,
		selectedIssuers,
		selectedTypes,
		selectedRedeemableStates,
		selectedAttestationsStates,
		selectedCexListedStates,
		selectedKycForMintRedeemStates,
		selectedKycAllowlistedWhitelistedToTransferHoldStates,
		selectedTransferableStates,
		selectedSelfCustodyStates,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps,
		hasPerpsOverlayBlockingFilters,
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct
	})

	const activeFilters = hasActiveChartFilters(router.query, {
		mode,
		chainSlug: props.chainSlug,
		categorySlug: props.categorySlug,
		platformSlug: props.platformSlug,
		assetGroupSlug: props.assetGroupSlug
	})
	const initialChartDataset = props.initialChartDataset ?? EMPTY_INITIAL_CHART_DATASET
	const chartTarget = getAssetChartTarget(props)
	const flowScope = getRwaFlowScope(chartTarget)
	const showFlowRotation = chartTarget.kind === 'all'
	const flowRotationSplitBy = getRwaFlowRotationSplitBy(readSingleQueryValue(router.query.flowRotationBy))
	const flowRotationFrequency = getRwaFlowRotationFrequency(readSingleQueryValue(router.query.flowRotationFrequency))
	const {
		data: flowAssetRows,
		isLoading: isFlowLoading,
		error: flowError
	} = useRWAFlowAssetBreakdown(flowScope, isFlowMetric || (showFlowRotation && activeFilters))
	const flowData = useMemo(
		() => (flowAssetRows ? { series: aggregateRWAFlowRows(flowAssetRows, filteredAssets) } : null),
		[flowAssetRows, filteredAssets]
	)
	const {
		data: routeFlowRotationData,
		isLoading: isFlowRotationLoading,
		error: flowRotationError
	} = useRWAFlowOverviewSplitWithFilters(
		flowRotationSplitBy,
		includeStablecoins,
		includeGovernance,
		showFlowRotation && !activeFilters
	)
	const flowRotationData = useMemo(
		() =>
			activeFilters && flowAssetRows
				? buildRWAFilteredFlowBreakdown(flowAssetRows, filteredAssets, flowRotationSplitBy)
				: routeFlowRotationData,
		[activeFilters, filteredAssets, flowAssetRows, flowRotationSplitBy, routeFlowRotationData]
	)
	const effectiveFlowRotationError = flowRotationError ?? (activeFilters ? flowError : null)
	const effectiveFlowRotationLoading = isFlowRotationLoading || (activeFilters && isFlowLoading)
	const flowModeQuery = readSingleQueryValue(router.query.flowMode)
	const selectedFlowOverlayMetrics = useMemo(
		() => parseRWAFlowOverlayMetrics(toNonEmptyArrayParam(router.query.flowOverlays)),
		[router.query.flowOverlays]
	)
	const { chartDataset, isChartLoading, chartError } = useRwaChartDataset({
		selectedMetric: chartTypeKey,
		initialDataset: initialChartDataset[chartTypeKey],
		initialOpenInterestDataset: props.initialOpenInterestChartDataset,
		filteredAssets,
		mode: getRwaChartAggregationMode(timeSeriesBreakdown),
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps,
		enabled: !isFlowMetric,
		useInitialDataset:
			!activeFilters &&
			(timeSeriesBreakdown === getDefaultChartBreakdown(chartMode, 'timeSeries') || timeSeriesBreakdown === 'total')
	})
	const { chartDataset: flowOnChainMcapDataset } = useRwaChartDataset({
		selectedMetric: 'onChainMcap',
		initialDataset: initialChartDataset.onChainMcap,
		initialOpenInterestDataset: null,
		filteredAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps: false,
		enabled:
			isFlowMetric &&
			(selectedFlowOverlayMetrics.includes('onChainMcap') || (isPlatformMode && flowModeQuery === 'flowVsPrice')),
		useInitialDataset: !activeFilters
	})
	const { chartDataset: flowActiveMcapDataset } = useRwaChartDataset({
		selectedMetric: 'activeMcap',
		initialDataset: initialChartDataset.activeMcap,
		initialOpenInterestDataset: null,
		filteredAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps: false,
		enabled: isFlowMetric && selectedFlowOverlayMetrics.includes('activeMcap'),
		useInitialDataset: !activeFilters
	})
	const { chartDataset: flowDefiActiveTvlDataset } = useRwaChartDataset({
		selectedMetric: 'defiActiveTvl',
		initialDataset: initialChartDataset.defiActiveTvl,
		initialOpenInterestDataset: null,
		filteredAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps: false,
		enabled: isFlowMetric && selectedFlowOverlayMetrics.includes('defiActiveTvl'),
		useInitialDataset: !activeFilters
	})
	const flowOnChainMcapByTimestamp = useMemo(
		() => getRwaTotalMetricByTimestamp(flowOnChainMcapDataset, 'onChainMcap'),
		[flowOnChainMcapDataset]
	)
	const flowActiveMcapByTimestamp = useMemo(
		() => getRwaTotalMetricByTimestamp(flowActiveMcapDataset, 'activeMcap'),
		[flowActiveMcapDataset]
	)
	const flowDefiActiveTvlByTimestamp = useMemo(
		() => getRwaTotalMetricByTimestamp(flowDefiActiveTvlDataset, 'defiActiveTvl'),
		[flowDefiActiveTvlDataset]
	)
	const flowOverlays = useMemo<RWAFlowOverlay[]>(
		() =>
			selectedFlowOverlayMetrics.map((metric) => ({
				metric,
				values:
					metric === 'onChainMcap'
						? flowOnChainMcapByTimestamp
						: metric === 'activeMcap'
							? flowActiveMcapByTimestamp
							: flowDefiActiveTvlByTimestamp
			})),
		[selectedFlowOverlayMetrics, flowOnChainMcapByTimestamp, flowActiveMcapByTimestamp, flowDefiActiveTvlByTimestamp]
	)
	const hasFlowMcap = flowOnChainMcapByTimestamp.size > 0
	const flowMode = parseRWAFlowMode(flowModeQuery, isPlatformMode && hasFlowMcap)

	const {
		assetCategoryOnChainMcapPieChartData,
		assetCategoryActiveMcapPieChartData,
		assetCategoryDefiActiveTvlPieChartData,
		pieChartStackColors: assetCategoryPieChartStackColors
	} = useRWAAssetCategoryPieChartData({
		enabled: nonTimeSeriesBreakdown === 'category',
		assets: filteredAssets,
		categories: props.categories,
		selectedCategories
	})

	const {
		assetClassOnChainMcapPieChartData,
		assetClassActiveMcapPieChartData,
		assetClassDefiActiveTvlPieChartData,
		assetClassPieChartStackColors
	} = useRwaCategoryAssetClassPieChartData({
		enabled: nonTimeSeriesBreakdown === 'assetClass',
		assets: filteredAssets,
		assetClasses: props.assetClasses,
		selectedAssetClasses
	})

	const {
		assetNameOnChainMcapPieChartData,
		assetNameActiveMcapPieChartData,
		assetNameDefiActiveTvlPieChartData,
		assetNamePieChartStackColors
	} = useRwaAssetNamePieChartData({
		enabled: nonTimeSeriesBreakdown === 'assetName',
		assets: filteredAssets,
		selectedAssetNames: isAssetGroupMode
			? filteredAssets.map((asset) => asset.assetName || asset.ticker)
			: selectedAssetNames
	})

	const {
		assetGroupOnChainMcapPieChartData,
		assetGroupActiveMcapPieChartData,
		assetGroupDefiActiveTvlPieChartData,
		assetGroupPieChartStackColors
	} = useRwaAssetGroupPieChartData({
		enabled: nonTimeSeriesBreakdown === 'assetGroup',
		assets: filteredAssets
	})

	const {
		assetPlatformOnChainMcapPieChartData,
		assetPlatformActiveMcapPieChartData,
		assetPlatformDefiActiveTvlPieChartData,
		assetPlatformPieChartStackColors
	} = useRwaAssetPlatformPieChartData({
		enabled: nonTimeSeriesBreakdown === 'platform',
		assets: filteredAssets
	})
	const {
		chainOnChainMcapPieChartData,
		chainActiveMcapPieChartData,
		chainDefiActiveTvlPieChartData,
		chainPieChartStackColors
	} = useRwaChainBreakdownPieChartData({
		enabled: canBreakdownByChain,
		assets: filteredAssets
	})

	// Select pie chart breakdown based on route mode (same precedence as nav links).
	const { onChainPieChartData, activeMcapPieChartData, defiActiveTvlPieChartData, pieChartStackColors } =
		useMemo(() => {
			switch (nonTimeSeriesBreakdown) {
				case 'chain':
					return {
						onChainPieChartData: chainOnChainMcapPieChartData,
						activeMcapPieChartData: chainActiveMcapPieChartData,
						defiActiveTvlPieChartData: chainDefiActiveTvlPieChartData,
						pieChartStackColors: chainPieChartStackColors
					}
				case 'assetGroup':
					return {
						onChainPieChartData: assetGroupOnChainMcapPieChartData,
						activeMcapPieChartData: assetGroupActiveMcapPieChartData,
						defiActiveTvlPieChartData: assetGroupDefiActiveTvlPieChartData,
						pieChartStackColors: assetGroupPieChartStackColors
					}
				case 'platform':
					return {
						onChainPieChartData: assetPlatformOnChainMcapPieChartData,
						activeMcapPieChartData: assetPlatformActiveMcapPieChartData,
						defiActiveTvlPieChartData: assetPlatformDefiActiveTvlPieChartData,
						pieChartStackColors: assetPlatformPieChartStackColors
					}
				case 'assetClass':
					return {
						onChainPieChartData: assetClassOnChainMcapPieChartData,
						activeMcapPieChartData: assetClassActiveMcapPieChartData,
						defiActiveTvlPieChartData: assetClassDefiActiveTvlPieChartData,
						pieChartStackColors: assetClassPieChartStackColors
					}
				case 'assetName':
					return {
						onChainPieChartData: assetNameOnChainMcapPieChartData,
						activeMcapPieChartData: assetNameActiveMcapPieChartData,
						defiActiveTvlPieChartData: assetNameDefiActiveTvlPieChartData,
						pieChartStackColors: assetNamePieChartStackColors
					}
				case 'category':
					return {
						onChainPieChartData: assetCategoryOnChainMcapPieChartData,
						activeMcapPieChartData: assetCategoryActiveMcapPieChartData,
						defiActiveTvlPieChartData: assetCategoryDefiActiveTvlPieChartData,
						pieChartStackColors: assetCategoryPieChartStackColors
					}
				default:
					return assertNever(nonTimeSeriesBreakdown)
			}
		}, [
			assetGroupActiveMcapPieChartData,
			assetGroupDefiActiveTvlPieChartData,
			assetGroupOnChainMcapPieChartData,
			assetGroupPieChartStackColors,
			assetClassActiveMcapPieChartData,
			assetClassDefiActiveTvlPieChartData,
			assetClassOnChainMcapPieChartData,
			assetClassPieChartStackColors,
			assetNameActiveMcapPieChartData,
			assetNameDefiActiveTvlPieChartData,
			assetNameOnChainMcapPieChartData,
			assetNamePieChartStackColors,
			assetPlatformOnChainMcapPieChartData,
			assetPlatformActiveMcapPieChartData,
			assetPlatformDefiActiveTvlPieChartData,
			assetPlatformPieChartStackColors,
			assetCategoryActiveMcapPieChartData,
			assetCategoryDefiActiveTvlPieChartData,
			assetCategoryOnChainMcapPieChartData,
			assetCategoryPieChartStackColors,
			nonTimeSeriesBreakdown,
			chainOnChainMcapPieChartData,
			chainActiveMcapPieChartData,
			chainDefiActiveTvlPieChartData,
			chainPieChartStackColors
		])

	// Preserve filter/toggle query params only in chain mode.
	// (The chain/category/platform itself is in the pathname, so we strip the dynamic param from the query object.)
	const navLinks = useMemo(() => {
		const baseLinks = getModeLinks(
			mode,
			props.chainLinks,
			props.categoryLinks,
			props.platformLinks,
			props.assetGroupLinks
		)

		// Only preserve query filters/toggles on chain mode. In category/platform mode, links should be "clean".
		const shouldPreserveQuery = isChainMode
		if (!shouldPreserveQuery) return baseLinks

		const { chain: _chain, category: _category, platform: _platform, ...restQuery } = router.query
		const qs = toQueryString(restQuery as Record<string, string | string[] | undefined>)
		if (!qs) return baseLinks
		return baseLinks.map((link) => ({ ...link, to: `${link.to}${qs}` }))
	}, [
		isChainMode,
		mode,
		props.assetGroupLinks,
		props.categoryLinks,
		props.platformLinks,
		props.chainLinks,
		router.query
	])

	const showFilters = props.assets.length > 1

	const showCharts = props.assets.length > 1 || isPlatformMode || isFlowMetric

	const { chartInstance: multiSeriesChart2Instance, handleChartReady: handleMultiSeriesChart2Ready } =
		useChartImageExport()
	const { chartInstance: flowRotationChartInstance, handleChartReady: handleFlowRotationChartReady } =
		useChartImageExport()
	const hasFlowRotationData = useMemo(
		() =>
			flowRotationData?.some((point) =>
				Object.entries(point).some(
					([key, value]) => key !== 'timestamp' && typeof value === 'number' && Number.isFinite(value)
				)
			) ?? false,
		[flowRotationData]
	)
	const chartMetricLabel = isFlowMetric ? 'Net Flows' : getChartMetricLabel(chartTypeKey)
	const chartMetricOptions = [
		...getChartMetricOptions(),
		{ key: 'flows' as const, label: definitions.flows.overviewNetFlows.label }
	]
	const selectedChartMetric: RWAOverviewChartMetric = isFlowMetric ? 'flows' : chartTypeKey
	const flowModeOptions = isPlatformMode && hasFlowMcap ? RWA_FLOW_MODE_OPTIONS : RWA_NON_PLATFORM_FLOW_MODE_OPTIONS
	const chartViewOptions = getChartViewOptions()
	const selectedModeLabel = getSelectedModeLabel(mode, props)
	const exportChartTitle = getRwaExportChartTitle({
		mode,
		metricLabel: chartMetricLabel,
		selectedModeLabel
	})
	const timeSeriesChartFilename = `rwa-time-series-chart-${slug(chartMetricLabel)}-${rwaSlug(selectedModeLabel)}`
	const { chartInstance: pieChartInstance, handleChartReady: handlePieChartReady } = useChartImageExport()
	const pieChartFilename = `rwa-pie-${slug(chartMetricLabel)}-${rwaSlug(selectedModeLabel)}`
	const { chartInstance: barChartInstance, handleChartReady: handleBarChartReady } = useChartImageExport()
	const barChartFilename = `rwa-bar-${slug(chartMetricLabel)}-${rwaSlug(selectedModeLabel)}`
	const { chartInstance: treemapChartInstance, handleChartReady: handleTreemapChartReady } = useChartImageExport()
	const treemapChartFilename = `rwa-treemap-${slug(chartMetricLabel)}-${rwaSlug(selectedModeLabel)}`
	const flowVsPriceSummary = useMemo(
		() => (flowData ? getRWAFlowVsPriceSummary(flowData.series, 'monthly', flowOnChainMcapByTimestamp) : null),
		[flowData, flowOnChainMcapByTimestamp]
	)

	const selectedTimeSeriesDataset = chartDataset
	const timeSeriesCharts = useMemo<Array<MultiSeriesChart2SeriesConfig>>(
		() => buildRwaTimeSeriesCharts(selectedTimeSeriesDataset.dimensions),
		[selectedTimeSeriesDataset.dimensions]
	)
	const selectedPieChartData =
		chartTypeKey === 'onChainMcap'
			? onChainPieChartData
			: chartTypeKey === 'activeMcap'
				? activeMcapPieChartData
				: defiActiveTvlPieChartData
	const deferredSelectedTimeSeriesDataset = useDeferredValue(selectedTimeSeriesDataset)
	const deferredSelectedPieChartData = useDeferredValue(selectedPieChartData)
	const valueSortedPieChartStackColors = useMemo(() => {
		const stackColors = { ...pieChartStackColors }
		const sortedData: Array<{ name: string; value: number }> = []
		for (const item of deferredSelectedPieChartData) {
			if (item.value > 0) sortedData.push(item)
		}
		sortedData.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))

		for (const [index, item] of sortedData.entries()) {
			stackColors[item.name] = CHART_COLORS[index % CHART_COLORS.length]
		}

		return stackColors
	}, [pieChartStackColors, deferredSelectedPieChartData])
	const selectedBarChartData = useMemo(
		() => limitRwaHorizontalBarData(deferredSelectedPieChartData, { sort: true }),
		[deferredSelectedPieChartData]
	)
	const selectedBarChartCategories = useMemo(
		() => selectedBarChartData.map((item) => item.name),
		[selectedBarChartData]
	)
	const selectedBarChartValues = useMemo(() => selectedBarChartData.map((item) => item.value), [selectedBarChartData])
	const selectedBarChartColors = useMemo(
		() => selectedBarChartData.map((item) => valueSortedPieChartStackColors[item.name] ?? '#1f77b4'),
		[selectedBarChartData, valueSortedPieChartStackColors]
	)

	const chartTypeSwitch = (
		<SegmentedControl<RWAOverviewChartMetric>
			value={selectedChartMetric}
			onValueChange={(key) => {
				if (key === 'flows') {
					void pushShallowQuery(router, {
						chartType: 'flows',
						flowMode: flowMode === 'daily' ? undefined : flowMode
					})
					return
				}
				void pushShallowQuery(router, {
					chartType: getChartMetricQueryValue(key),
					flowMode: undefined
				})
			}}
			options={chartMetricOptions.map(({ key, label }) => ({
				value: key,
				label,
				tooltip: key === 'flows' ? definitions.flows.overviewNetFlows.description : undefined
			}))}
			label="Chart type"
			variant="default"
			size="md"
			className="mr-auto"
		/>
	)
	const flowOverlaySelect = (
		<Select
			allValues={RWA_FLOW_OVERLAY_OPTIONS}
			selectedValues={selectedFlowOverlayMetrics}
			setSelectedValues={(values) => {
				void pushShallowQuery(router, { flowOverlays: getRWAFlowOverlayQueryValue(values) })
			}}
			label="Overlays"
			labelType="smol"
			variant="filter"
			size="md"
		/>
	)

	const chartViewSwitch = (
		<Select
			allValues={chartViewOptions}
			selectedValues={chartView}
			setSelectedValues={(value) => {
				const selectedView = getSelectedFilterValue(value) as RWAChartState['view']
				void pushShallowQuery(router, { chartView: getChartViewQueryValue(selectedView) })
			}}
			label={chartViewOptions.find(({ key }) => key === chartView)?.name ?? chartViewOptions[0].name}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)
	const chartBreakdownOptions = getChartBreakdownOptions(chartState)
	const timeSeriesChartBreakdownOptions =
		chartView === 'timeSeries'
			? ([{ key: 'total', name: 'Total' }, ...chartBreakdownOptions] as const)
			: chartBreakdownOptions
	const chartBreakdownLabel =
		chartView === 'timeSeries' && isTotalTimeSeriesSelected ? 'Total' : getBreakdownLabel(chartState.breakdown)
	const timeSeriesChartBreakdownSwitch = (
		<Select
			allValues={timeSeriesChartBreakdownOptions}
			selectedValues={isTotalTimeSeriesSelected ? 'total' : chartState.breakdown}
			setSelectedValues={(value) => {
				const nextBreakdown = getSelectedFilterValue(value)
				if (nextBreakdown === 'total') {
					void pushShallowQuery(router, {
						timeSeriesChartBreakdown: 'total'
					})
					return
				}

				const nextState = setChartBreakdown(chartState, nextBreakdown as RWAChartState['breakdown'])
				void pushShallowQuery(router, {
					timeSeriesChartBreakdown: getChartBreakdownQueryValue(nextState)
				})
			}}
			label={chartBreakdownLabel}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)

	const treemapParentGrouping = getTreemapParentGrouping(nonTimeSeriesBreakdown)
	const treemapNestedBy = chartState.treemapNestedBy
	const treemapNestedByOptions = getTreemapNestedByOptions(treemapParentGrouping)
	const isNestedTreemapSupported = canBuildRwaNestedTreemap({
		parentGrouping: treemapParentGrouping,
		childGrouping: treemapNestedBy
	})
	const pieChartBreakdownSwitch = (
		<Select
			allValues={chartBreakdownOptions}
			selectedValues={chartState.breakdown}
			setSelectedValues={(value) => {
				const nextBreakdown = getSelectedFilterValue(value) as RWAChartState['breakdown']
				const nextState = setChartBreakdown(chartState, nextBreakdown)
				void pushShallowQuery(router, {
					nonTimeSeriesChartBreakdown: getChartBreakdownQueryValue(nextState),
					treemapNestedBy: getTreemapNestedByQueryValue(nextState)
				})
			}}
			label={chartBreakdownLabel}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)
	const treemapNestedByLabel = getTreemapNestedByLabel(treemapNestedBy)
	const treemapNestedBySwitch = (
		<Select
			allValues={treemapNestedByOptions}
			selectedValues={treemapNestedBy}
			setSelectedValues={(value) => {
				const selectedNestedBy = getSelectedFilterValue(value) as RWAChartState['treemapNestedBy']
				const nextState = setTreemapNestedBy(chartState, selectedNestedBy)
				void pushShallowQuery(router, { treemapNestedBy: getTreemapNestedByQueryValue(nextState) })
			}}
			label={`Nested by: ${treemapNestedByLabel}`}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)

	const treemapTreeData = useMemo(() => {
		if (chartView !== 'treemap') return []
		if (isNestedTreemapSupported) {
			const nestedTreeData = buildRwaNestedTreemapTreeData({
				assets: filteredAssets,
				metric: chartTypeKey,
				rootLabel: chartBreakdownLabel,
				parentGrouping: treemapParentGrouping,
				childGrouping: treemapNestedBy
			})
			if (nestedTreeData.length > 0) return nestedTreeData
		}
		return buildRwaTreemapTreeData(selectedPieChartData, chartBreakdownLabel)
	}, [
		chartView,
		chartTypeKey,
		filteredAssets,
		chartBreakdownLabel,
		isNestedTreemapSupported,
		selectedPieChartData,
		treemapNestedBy,
		treemapParentGrouping
	])
	const nonTimeSeriesChartInstance =
		chartView === 'treemap' ? treemapChartInstance : chartView === 'hbar' ? barChartInstance : pieChartInstance
	const nonTimeSeriesChartFilename =
		chartView === 'treemap' ? treemapChartFilename : chartView === 'hbar' ? barChartFilename : pieChartFilename

	return (
		<>
			{/* <Announcement>
				Stablecoins, Governance are not included by default. To include them, toggle the corresponding filters.
			</Announcement> */}
			<RowLinksWithDropdown links={navLinks} activeLink={selectedModeLabel} />
			<RWAOverviewFilters
				enabled={showFilters}
				modes={{
					mode,
					isChainMode,
					isCategoryMode,
					isPlatformMode,
					isAssetGroupMode
				}}
				options={{
					assetNames: props.assetNames,
					typeOptions: props.typeOptions,
					categoriesOptions: props.categoriesOptions,
					platforms: props.platforms,
					assetGroups: props.assetGroups,
					assetClassOptions: props.assetClassOptions,
					rwaClassificationOptions: props.rwaClassificationOptions,
					accessModelOptions: props.accessModelOptions,
					issuers: props.issuers,
					chainSlug: props.chainSlug,
					categorySlug: props.categorySlug,
					platformSlug: props.platformSlug,
					assetGroupSlug: props.assetGroupSlug
				}}
				selections={{
					selectedAssetNames,
					selectedTypes,
					selectedCategories,
					selectedPlatforms,
					selectedAssetGroups,
					selectedAssetClasses,
					selectedRwaClassifications,
					selectedAccessModels,
					selectedIssuers,
					selectedRedeemableStates,
					selectedAttestationsStates,
					selectedCexListedStates,
					selectedKycForMintRedeemStates,
					selectedKycAllowlistedWhitelistedToTransferHoldStates,
					selectedTransferableStates,
					selectedSelfCustodyStates,
					minDefiActiveTvlToOnChainMcapPct,
					maxDefiActiveTvlToOnChainMcapPct,
					minActiveMcapToOnChainMcapPct,
					maxActiveMcapToOnChainMcapPct,
					minDefiActiveTvlToActiveMcapPct,
					maxDefiActiveTvlToActiveMcapPct,
					includeStablecoins,
					includeGovernance,
					includeRwaPerps
				}}
				actions={{
					setDefiActiveTvlToOnChainMcapPctRange,
					setActiveMcapToOnChainMcapPctRange,
					setDefiActiveTvlToActiveMcapPctRange,
					setIncludeStablecoins,
					setIncludeGovernance,
					setIncludeRwaPerps,
					setRedeemableStates,
					setAttestationsStates,
					setCexListedStates,
					setKycForMintRedeemStates,
					setKycAllowlistedWhitelistedToTransferHoldStates,
					setTransferableStates,
					setSelfCustodyStates
				}}
			/>
			<div className="flex flex-col gap-2 md:flex-row md:items-center">
				<Card padding="sm" className="flex-1">
					<StatItem
						className="gap-1"
						label={definitions.totalActiveMcap.label}
						tooltip={definitions.totalActiveMcap.description}
						value={formattedNum(totalActiveMcap, true)}
					/>
				</Card>
				<Card padding="sm" className="flex-1">
					<StatItem
						className="gap-1"
						label={definitions.totalOnChainMcap.label}
						tooltip={definitions.totalOnChainMcap.description}
						value={formattedNum(totalOnChainMcap, true)}
					/>
				</Card>
				<Card padding="sm" className="flex-1">
					<StatItem
						className="gap-1"
						label={definitions.totalDefiActiveTvl.label}
						tooltip={definitions.totalDefiActiveTvl.description}
						value={formattedNum(totalOnChainDeFiActiveTvl, true)}
					/>
				</Card>
				{includeRwaPerps ? (
					<Card padding="sm" className="flex-1">
						<StatItem
							className="gap-1"
							label="RWA Perps OI"
							tooltip={perpsDefinitions.totalOpenInterest.description}
							value={formattedNum(totalOpenInterest, true)}
						/>
					</Card>
				) : null}
				<Card padding="sm" className="flex-1">
					<StatItem
						className="gap-1"
						label={definitions.totalAssetIssuers.label}
						tooltip={definitions.totalAssetIssuers.description}
						value={formattedNum(totalIssuersCount, false)}
					/>
				</Card>
			</div>
			{showCharts ? (
				<>
					{chartView === 'timeSeries' ? (
						<ChartPanel>
							<ChartPanelToolbar className="justify-end">
								{chartTypeSwitch}
								{isFlowMetric ? (
									<SegmentedControl<RWAFlowChartMode>
										value={flowMode}
										onValueChange={(nextFlowMode) => {
											void pushShallowQuery(router, {
												flowMode: nextFlowMode === 'daily' ? undefined : nextFlowMode
											})
										}}
										options={flowModeOptions}
										label="Flow view"
										variant="default"
										size="md"
									/>
								) : (
									<>
										{chartViewSwitch}
										{timeSeriesChartBreakdownSwitch}
									</>
								)}
								{isFlowMetric && flowMode !== 'flowVsPrice' ? flowOverlaySelect : null}
								<ChartCsvExportButton chartInstance={multiSeriesChart2Instance} filename={timeSeriesChartFilename} />
								<ChartPngExportButton
									chartInstance={multiSeriesChart2Instance}
									filename={timeSeriesChartFilename}
									title={exportChartTitle}
								/>
							</ChartPanelToolbar>
							{isFlowMetric && flowMode === 'flowVsPrice' && flowVsPriceSummary ? (
								<RWAFlowVsPriceStrip summary={flowVsPriceSummary} />
							) : null}
							{isFlowMetric ? (
								isFlowLoading ? (
									<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
										Loading
										<LoadingDots />
									</ChartPanelBodyFallback>
								) : flowError ? (
									<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
										{flowError instanceof Error ? flowError.message : 'Failed to load flow data.'}
									</ChartPanelBodyFallback>
								) : flowData ? (
									<Suspense fallback={<ChartPanelBodyFallback />}>
										<RWAFlowsChart
											points={flowData.series}
											selection={
												flowMode === 'flowVsPrice'
													? {
															view: 'flowVsPrice',
															groupBy: 'monthly',
															mcapByTimestamp: flowOnChainMcapByTimestamp
														}
													: { view: 'netFlows', groupBy: flowMode, overlays: flowOverlays }
											}
											defaultRangeDays={flowMode === 'daily' ? 365 : undefined}
											onReady={handleMultiSeriesChart2Ready}
										/>
									</Suspense>
								) : (
									<ChartPanelBodyFallback className="body-sm text-secondary">
										No flow data available.
									</ChartPanelBodyFallback>
								)
							) : chartError ? (
								<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
									{chartError}
								</ChartPanelBodyFallback>
							) : isChartLoading ? (
								<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
									Loading
									<LoadingDots />
								</ChartPanelBodyFallback>
							) : (
								<Suspense fallback={<ChartPanelBodyFallback />}>
									<MultiSeriesChart2
										dataset={deferredSelectedTimeSeriesDataset}
										charts={timeSeriesCharts}
										hideDefaultLegend={false}
										showTotalInTooltip={!deferredSelectedTimeSeriesDataset.dimensions.includes('Total')}
										onReady={handleMultiSeriesChart2Ready}
									/>
								</Suspense>
							)}
						</ChartPanel>
					) : null}
					{chartView === 'pie' || chartView === 'treemap' || chartView === 'hbar' ? (
						<ChartPanel className={chartView === 'treemap' ? undefined : 'min-h-[420px]'}>
							<ChartPanelToolbar className="justify-end">
								{chartTypeSwitch}
								{chartViewSwitch}
								{pieChartBreakdownSwitch}
								{chartView === 'treemap' ? treemapNestedBySwitch : null}
								{chartView === 'treemap' ? <ChartRestoreButton chartInstance={treemapChartInstance} /> : null}
								<ChartCsvExportButton
									chartInstance={nonTimeSeriesChartInstance}
									filename={nonTimeSeriesChartFilename}
								/>
								<ChartPngExportButton
									chartInstance={nonTimeSeriesChartInstance}
									filename={nonTimeSeriesChartFilename}
									title={exportChartTitle}
								/>
							</ChartPanelToolbar>
							<Suspense
								fallback={chartView === 'treemap' ? <div className="min-h-[600px]" /> : <ChartPanelBodyFallback />}
							>
								{chartView === 'pie' ? (
									<PieChart
										chartData={deferredSelectedPieChartData}
										stackColors={valueSortedPieChartStackColors}
										radius={pieChartRadius}
										legendPosition={pieChartLegendPosition}
										legendTextStyle={pieChartLegendTextStyle}
										onReady={handlePieChartReady}
									/>
								) : chartView === 'hbar' ? (
									<HBarChart
										categories={selectedBarChartCategories}
										values={selectedBarChartValues}
										colors={selectedBarChartColors}
										valueSymbol="$"
										onReady={handleBarChartReady}
									/>
								) : (
									<TreemapChart
										treeData={treemapTreeData}
										variant="rwa"
										height="600px"
										onReady={handleTreemapChartReady}
										valueLabel={chartMetricLabel}
									/>
								)}
							</Suspense>
						</ChartPanel>
					) : null}
				</>
			) : null}
			{showFlowRotation ? (
				<ChartPanel>
					<ChartPanelToolbar className="justify-end">
						<Tooltip
							content={definitions.flows.capitalRotation.description}
							render={<h2 />}
							className="mr-auto heading-xs underline decoration-dotted"
						>
							{definitions.flows.capitalRotation.label}
						</Tooltip>
						<SegmentedControl<RWAFlowOverviewSplitBy>
							value={flowRotationSplitBy}
							onValueChange={(nextSplitBy) => {
								void pushShallowQuery(router, {
									flowRotationBy: nextSplitBy === 'assetGroup' ? undefined : nextSplitBy
								})
							}}
							options={RWA_FLOW_ROTATION_SPLIT_OPTIONS}
							label="Net flow breakdown"
							variant="default"
							size="md"
						/>
						<ChartGroupingSelector
							value={flowRotationFrequency}
							onValueChange={(nextFrequency) => {
								void pushShallowQuery(router, {
									flowRotationFrequency: nextFrequency === 'monthly' ? undefined : nextFrequency
								})
							}}
							options={DWMC_GROUPING_OPTIONS_LOWERCASE}
						/>
						<ChartCsvExportButton
							chartInstance={flowRotationChartInstance}
							filename={`rwa-net-flow-${flowRotationSplitBy}-${flowRotationFrequency}`}
						/>
						<ChartPngExportButton
							chartInstance={flowRotationChartInstance}
							filename={`rwa-net-flow-${flowRotationSplitBy}-${flowRotationFrequency}`}
							title="RWA Net Flow"
						/>
					</ChartPanelToolbar>
					{effectiveFlowRotationError ? (
						<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
							{effectiveFlowRotationError instanceof Error
								? effectiveFlowRotationError.message
								: 'Failed to load net flow data.'}
						</ChartPanelBodyFallback>
					) : effectiveFlowRotationLoading ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
							Loading
							<LoadingDots />
						</ChartPanelBodyFallback>
					) : hasFlowRotationData && flowRotationData ? (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<RWAFlowRotationChart
								points={flowRotationData}
								groupBy={flowRotationFrequency}
								onReady={handleFlowRotationChartReady}
							/>
						</Suspense>
					) : (
						<ChartPanelBodyFallback className="body-sm text-secondary">No flow data available.</ChartPanelBodyFallback>
					)}
				</ChartPanel>
			) : null}
			<RWAAssetsTable assets={filteredAssets} selectedChain={props.selectedChain} includeRwaPerps={includeRwaPerps} />
		</>
	)
}

const getRWAOverviewMode = (props: IRWAAssetsOverview): RWAOverviewMode => {
	if (props.assetGroupLinks.length > 0) return 'assetGroup'
	if (props.categoryLinks.length > 0) return 'category'
	if (props.platformLinks.length > 0) return 'platform'
	return 'chain'
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

export function buildRwaTimeSeriesCharts(dimensions: string[]): Array<MultiSeriesChart2SeriesConfig> {
	const seriesDimensions = sortRwaChartSeriesLabels(dimensions.filter((dimension) => dimension !== 'timestamp'))
	const colorSlots = getRwaChartSeriesColorSlots(seriesDimensions)

	return seriesDimensions.map((name) => {
		const reservedColorSlot = getRwaReservedSeriesColorSlot(name)
		const colorSlot = colorSlots[name]
		const isReservedSeries = reservedColorSlot !== null
		const isTotalSeries = isRwaTotalSeriesLabel(name)

		return {
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
			color: CHART_COLORS[colorSlot % CHART_COLORS.length],
			...(isReservedSeries
				? {
						hideAreaStyle: true,
						...(isTotalSeries ? { excludeFromTooltipTotal: true } : {})
					}
				: {})
		}
	})
}

const getRwaChartAggregationMode = (state: RWAChartBreakdown | 'total'): RWAChartAggregationMode => {
	switch (state) {
		case 'total':
			return state
		case 'assetGroup':
		case 'category':
		case 'assetClass':
		case 'assetName':
		case 'platform':
			return state
		case 'chain':
			throw new Error('Chain breakdown is not valid for time-series charts')
		default:
			return assertNever(state)
	}
}

const getAssetChartTarget = (props: IRWAAssetsOverview): RWAAssetChartTarget => {
	if (props.assetGroupSlug) return { kind: 'assetGroup', slug: props.assetGroupSlug }
	if (props.categorySlug) return { kind: 'category', slug: props.categorySlug }
	if (props.platformSlug) return { kind: 'platform', slug: props.platformSlug }
	if (props.chainSlug) return { kind: 'chain', slug: props.chainSlug }
	return { kind: 'all' }
}

const getRwaFlowScope = (target: RWAAssetChartTarget): RWAFlowScope => {
	switch (target.kind) {
		case 'all':
			return { kind: 'overview' }
		case 'assetGroup':
			return { kind: 'assetGroup', slug: target.slug }
		case 'category':
			return { kind: 'category', slug: target.slug }
		case 'platform':
			return { kind: 'platform', slug: target.slug }
		case 'chain':
			return { kind: 'chain', slug: target.slug }
		default:
			return assertNever(target)
	}
}

const getRwaTotalMetricByTimestamp = (
	dataset: RWAChartDataset,
	metric: RWAChartMetricKey
): Map<number, number | null> => {
	const totalLabel = dataset.dimensions.includes('Total') ? 'Total' : getRwaChartTotalLabel(metric)
	if (!dataset.dimensions.includes(totalLabel)) return new Map()

	const values = new Map<number, number | null>()
	for (const row of dataset.source) {
		const value = row[totalLabel]
		values.set(row.timestamp, typeof value === 'number' && Number.isFinite(value) ? value : null)
	}
	return values
}

const getModeLinks = (
	mode: RWAOverviewMode,
	chainLinks: IRWAAssetsOverview['chainLinks'],
	categoryLinks: IRWAAssetsOverview['categoryLinks'],
	platformLinks: IRWAAssetsOverview['platformLinks'],
	assetGroupLinks: IRWAAssetsOverview['assetGroupLinks']
) => {
	if (mode === 'assetGroup') return assetGroupLinks
	if (mode === 'category') return categoryLinks
	if (mode === 'platform') return platformLinks
	return chainLinks
}

const getSelectedModeLabel = (mode: RWAOverviewMode, props: IRWAAssetsOverview) => {
	if (mode === 'assetGroup') return props.selectedAssetGroup
	if (mode === 'category') return props.selectedCategory
	if (mode === 'platform') return props.selectedPlatform
	return props.selectedChain
}

const getRwaExportChartTitle = ({
	mode,
	metricLabel,
	selectedModeLabel
}: {
	mode: RWAOverviewMode
	metricLabel: string
	selectedModeLabel: string
}) => {
	if (mode === 'assetGroup') return `RWA ${metricLabel} in ${selectedModeLabel}`
	if (mode === 'category') return `RWA ${metricLabel} by Category`
	if (!selectedModeLabel || selectedModeLabel === 'All') return `RWA ${metricLabel}`
	return `RWA ${metricLabel} on ${selectedModeLabel}`
}

const pieChartRadius = ['50%', '70%'] as [string, string]
const pieChartLegendPosition = {
	left: 'center',
	top: 'bottom',
	orient: 'horizontal',
	formatter: function (name: string) {
		return name
	}
} as const
const pieChartLegendTextStyle = { fontSize: 14 }
