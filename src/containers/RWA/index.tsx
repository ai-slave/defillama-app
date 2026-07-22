import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { buildCsvFromDataset, ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { ChartGroupingSelector } from '~/components/ECharts/shared/ChartGroupingSelector'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
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
	getRwaChartTotalLabel,
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	sortRwaChartSeriesLabels,
	type RWAChartAggregationMode
} from './chartAggregation'
import {
	limitRwaHorizontalBarData,
	materializeRwaIndependentChartDataset,
	type RWAPositionalChartDataset
} from './chartDataset'
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
	buildRWAFlowChart,
	buildRWAFilteredFlowBreakdown,
	getRWAFlowDefaultStartTimestamp,
	getRWAFlowOverlayQueryValue,
	getRWAFlowVsPriceAssetSummaries,
	getRWAFlowVsPriceSummary,
	parseRWAFlowGrouping,
	parseRWAFlowQueryState,
	parseRWAFlowOverlayMetrics,
	RWA_FLOW_GROUPING_OPTIONS,
	RWA_FLOW_OVERLAY_OPTIONS,
	type RWAFlowChartSelection,
	type RWAFlowGrouping,
	type RWAFlowOverlay,
	type RWAFlowVisibleRange
} from './flows'
import { type RWAFlowScope, useRWAFlowAssetBreakdown, useRWAFlowOverviewSplitWithFilters } from './flows.hooks'
import {
	aggregateRWAFlowTreemapWindow,
	buildRWAFlowTreemap,
	buildRWAFlowTreemapSizeRowsFromAssets,
	getRWAFlowTreemapPeriodLabel,
	getRWAFlowTreemapSizeLabel,
	parseRWAFlowTreemapSizeMetric,
	parseRWAFlowTreemapView,
	prepareRWAFlowTreemapCsv,
	RWA_FLOW_TREEMAP_SIZE_OPTIONS,
	RWA_FLOW_TREEMAP_VIEW_OPTIONS
} from './flowTreemap'
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
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>
const RWAFlowsChart = lazy(() => import('./FlowsChart').then((module) => ({ default: module.RWAFlowsChart })))
const RWAFlowRotationChart = lazy(() =>
	import('./FlowRotationChart').then((module) => ({ default: module.RWAFlowRotationChart }))
)
const RWAFlowTreemapChart = lazy(() =>
	import('./FlowTreemapChart').then((module) => ({ default: module.RWAFlowTreemapChart }))
)
type RWAOverviewChartMetric = RWAChartState['metric'] | 'flows' | 'flowVsPrice'

const RWA_FLOW_ROTATION_SPLIT_OPTIONS: Array<{
	key: RWAFlowOverviewSplitBy
	name: string
	help: string
}> = [
	{ key: 'assetGroup', name: 'Asset Groups', help: definitions.flows.rotationGrouping.description },
	{ key: 'category', name: 'Categories', help: definitions.flows.rotationGrouping.description },
	{ key: 'platform', name: 'Asset Platforms', help: definitions.flows.rotationGrouping.description },
	{
		key: 'chain',
		name: definitions.flows.rotationChains.label,
		help: definitions.flows.rotationChains.description
	}
]

const EMPTY_FLOW_TREEMAP = { nodes: [], excludedSizeCount: 0 }
const EMPTY_CHART_STACK_COLORS: Record<string, string> = {}
const EMPTY_HBAR_PRESENTATION = { categories: [] as string[], values: [] as number[], colors: [] as string[] }

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
	const chartTypeQuery = readSingleQueryValue(router.query.chartType)
	const flowModeQuery = readSingleQueryValue(router.query.flowMode)
	const flowQueryState = parseRWAFlowQueryState(chartTypeQuery, flowModeQuery, isPlatformMode)
	const isFlowVsPrice = flowQueryState.view === 'flowVsPrice'
	const [flowVisibleRange, setFlowVisibleRange] = useState<RWAFlowVisibleRange | null>(null)
	const handleFlowVisibleRangeChange = useCallback((range: RWAFlowVisibleRange | null) => {
		setFlowVisibleRange((previous) =>
			previous?.start === range?.start && previous?.end === range?.end ? previous : range
		)
	}, [])
	const canBreakdownByChain = isCategoryMode || isPlatformMode || isAssetGroupMode || props.selectedChain === 'All'
	const chartMode = createRwaChartModeState(mode, canBreakdownByChain)
	const chartState = parseRwaChartState(router.query, chartMode)
	const isFlowMetric = flowQueryState.view != null
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
	const shouldBuildNonTimeSeriesData = chartView !== 'timeSeries'

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
		categorySlug: props.categorySlug,
		defaultInclusion: props.defaultInclusion,
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

	const activeFilters = hasActiveChartFilters(router.query, props.defaultInclusion)
	const initialChartDataset = props.initialChartDataset
	const getInitialMetricDataset = (metric: RWAChartMetricKey) =>
		initialChartDataset?.metric === metric ? initialChartDataset.dataset : null
	const chartTarget = getAssetChartTarget(props)
	const flowScope = getRwaFlowScope(chartTarget)
	const showFlowRotation = chartTarget.kind === 'all'
	const flowRotationSplitBy = getRwaFlowRotationSplitBy(readSingleQueryValue(router.query.flowRotationBy))
	const flowRotationFrequency = getRwaFlowRotationFrequency(readSingleQueryValue(router.query.flowRotationFrequency))
	const flowRotationView = parseRWAFlowTreemapView(readSingleQueryValue(router.query.flowRotationView))
	const flowTreemapSizeMetric = parseRWAFlowTreemapSizeMetric(
		readSingleQueryValue(router.query.flowHeatmapSize) ?? readSingleQueryValue(router.query.flowTreemapSize)
	)
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
	const flowRotationData = useMemo(() => {
		if (!showFlowRotation) return null
		return activeFilters && flowAssetRows
			? buildRWAFilteredFlowBreakdown(flowAssetRows, filteredAssets, flowRotationSplitBy)
			: routeFlowRotationData
	}, [activeFilters, filteredAssets, flowAssetRows, flowRotationSplitBy, routeFlowRotationData, showFlowRotation])
	const effectiveFlowRotationError = flowRotationError ?? (activeFilters ? flowError : null)
	const effectiveFlowRotationLoading = isFlowRotationLoading || (activeFilters && isFlowLoading)
	const flowTreemapSizeRows = useMemo(
		() =>
			showFlowRotation && flowRotationView === 'heatmap'
				? buildRWAFlowTreemapSizeRowsFromAssets(filteredAssets, flowRotationSplitBy)
				: [],
		[filteredAssets, flowRotationSplitBy, flowRotationView, showFlowRotation]
	)
	const flowTreemapFlows = useMemo(
		() =>
			showFlowRotation && flowRotationView === 'heatmap'
				? aggregateRWAFlowTreemapWindow(flowRotationData ?? [], flowRotationFrequency)
				: null,
		[flowRotationData, flowRotationFrequency, flowRotationView, showFlowRotation]
	)
	const flowTreemap = useMemo(
		() =>
			flowTreemapFlows
				? buildRWAFlowTreemap({
						flows: flowTreemapFlows,
						sizeRows: flowTreemapSizeRows,
						sizeMetric: flowTreemapSizeMetric
					})
				: EMPTY_FLOW_TREEMAP,
		[flowTreemapFlows, flowTreemapSizeMetric, flowTreemapSizeRows]
	)
	const flowGroupBy = flowQueryState.groupBy
	const selectedFlowOverlayMetrics = useMemo(
		() => parseRWAFlowOverlayMetrics(toNonEmptyArrayParam(router.query.flowOverlays)),
		[router.query.flowOverlays]
	)
	const { chartDataset, isChartLoading, chartError } = useRwaChartDataset({
		selectedMetric: chartTypeKey,
		initialDataset: getInitialMetricDataset(chartTypeKey),
		initialOpenInterestDataset: props.initialOpenInterestChartDataset,
		filteredAssets,
		mode: getRwaChartAggregationMode(timeSeriesBreakdown),
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps,
		enabled: !isFlowMetric && chartView === 'timeSeries',
		useInitialDataset:
			initialChartDataset?.metric === chartTypeKey &&
			!activeFilters &&
			(timeSeriesBreakdown === getDefaultChartBreakdown(chartMode, 'timeSeries') || timeSeriesBreakdown === 'total')
	})
	const {
		chartDataset: flowOnChainMcapDataset,
		assetRows: flowOnChainMcapAssetRows,
		isChartLoading: isFlowMcapLoading,
		chartError: flowMcapError
	} = useRwaChartDataset({
		selectedMetric: 'onChainMcap',
		initialDataset: getInitialMetricDataset('onChainMcap'),
		initialOpenInterestDataset: null,
		filteredAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps: false,
		enabled: isFlowMetric && (selectedFlowOverlayMetrics.includes('onChainMcap') || isFlowVsPrice),
		useInitialDataset: initialChartDataset?.metric === 'onChainMcap' && !activeFilters && !isFlowVsPrice
	})
	const { chartDataset: flowActiveMcapDataset } = useRwaChartDataset({
		selectedMetric: 'activeMcap',
		initialDataset: getInitialMetricDataset('activeMcap'),
		initialOpenInterestDataset: null,
		filteredAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps: false,
		enabled: isFlowMetric && !isFlowVsPrice && selectedFlowOverlayMetrics.includes('activeMcap'),
		useInitialDataset: initialChartDataset?.metric === 'activeMcap' && !activeFilters
	})
	const { chartDataset: flowDefiActiveTvlDataset } = useRwaChartDataset({
		selectedMetric: 'defiActiveTvl',
		initialDataset: getInitialMetricDataset('defiActiveTvl'),
		initialOpenInterestDataset: null,
		filteredAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps: false,
		enabled: isFlowMetric && !isFlowVsPrice && selectedFlowOverlayMetrics.includes('defiActiveTvl'),
		useInitialDataset: initialChartDataset?.metric === 'defiActiveTvl' && !activeFilters
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
	const { pieChartData: assetCategoryPieChartData, pieChartStackColors: assetCategoryPieChartStackColors } =
		useRWAAssetCategoryPieChartData({
			enabled: shouldBuildNonTimeSeriesData && nonTimeSeriesBreakdown === 'category',
			assets: filteredAssets,
			categories: props.categories,
			selectedCategories,
			metric: chartTypeKey
		})

	const { pieChartData: assetClassPieChartData, pieChartStackColors: assetClassPieChartStackColors } =
		useRwaCategoryAssetClassPieChartData({
			enabled: shouldBuildNonTimeSeriesData && nonTimeSeriesBreakdown === 'assetClass',
			assets: filteredAssets,
			assetClasses: props.assetClasses,
			selectedAssetClasses,
			metric: chartTypeKey
		})

	const shouldBuildAssetNamePieChartData = shouldBuildNonTimeSeriesData && nonTimeSeriesBreakdown === 'assetName'
	const { pieChartData: assetNamePieChartData, pieChartStackColors: assetNamePieChartStackColors } =
		useRwaAssetNamePieChartData({
			enabled: shouldBuildAssetNamePieChartData,
			assets: filteredAssets,
			selectedAssetNames:
				isAssetGroupMode && shouldBuildAssetNamePieChartData
					? filteredAssets.map((asset) => asset.assetName || asset.ticker)
					: selectedAssetNames,
			metric: chartTypeKey
		})

	const { pieChartData: assetGroupPieChartData, pieChartStackColors: assetGroupPieChartStackColors } =
		useRwaAssetGroupPieChartData({
			enabled: shouldBuildNonTimeSeriesData && nonTimeSeriesBreakdown === 'assetGroup',
			assets: filteredAssets,
			metric: chartTypeKey
		})

	const { pieChartData: assetPlatformPieChartData, pieChartStackColors: assetPlatformPieChartStackColors } =
		useRwaAssetPlatformPieChartData({
			enabled: shouldBuildNonTimeSeriesData && nonTimeSeriesBreakdown === 'platform',
			assets: filteredAssets,
			metric: chartTypeKey
		})
	const { pieChartData: chainPieChartData, pieChartStackColors: chainPieChartStackColors } =
		useRwaChainBreakdownPieChartData({
			enabled: shouldBuildNonTimeSeriesData && nonTimeSeriesBreakdown === 'chain' && canBreakdownByChain,
			assets: filteredAssets,
			metric: chartTypeKey
		})

	// Select pie chart breakdown based on route mode (same precedence as nav links).
	const { selectedPieChartData, pieChartStackColors } = useMemo(() => {
		switch (nonTimeSeriesBreakdown) {
			case 'chain':
				return {
					selectedPieChartData: chainPieChartData,
					pieChartStackColors: chainPieChartStackColors
				}
			case 'assetGroup':
				return {
					selectedPieChartData: assetGroupPieChartData,
					pieChartStackColors: assetGroupPieChartStackColors
				}
			case 'platform':
				return {
					selectedPieChartData: assetPlatformPieChartData,
					pieChartStackColors: assetPlatformPieChartStackColors
				}
			case 'assetClass':
				return {
					selectedPieChartData: assetClassPieChartData,
					pieChartStackColors: assetClassPieChartStackColors
				}
			case 'assetName':
				return {
					selectedPieChartData: assetNamePieChartData,
					pieChartStackColors: assetNamePieChartStackColors
				}
			case 'category':
				return {
					selectedPieChartData: assetCategoryPieChartData,
					pieChartStackColors: assetCategoryPieChartStackColors
				}
			default:
				return assertNever(nonTimeSeriesBreakdown)
		}
	}, [
		assetGroupPieChartData,
		assetGroupPieChartStackColors,
		assetClassPieChartData,
		assetClassPieChartStackColors,
		assetNamePieChartData,
		assetNamePieChartStackColors,
		assetPlatformPieChartData,
		assetPlatformPieChartStackColors,
		assetCategoryPieChartData,
		assetCategoryPieChartStackColors,
		nonTimeSeriesBreakdown,
		chainPieChartData,
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

	const showFilters = props.assets.length > 0

	const showCharts = props.assets.length > 1 || isPlatformMode || isFlowMetric

	const { chartInstance: multiSeriesChart2Instance, handleChartReady: handleMultiSeriesChartReady } =
		useChartImageExport()
	const { chartInstance: flowRotationChartInstance, handleChartReady: handleFlowRotationChartReady } =
		useChartImageExport()
	const hasFlowRotationData = useMemo(() => {
		if (!showFlowRotation) return false
		for (const point of flowRotationData ?? []) {
			for (const key in point) {
				if (key !== 'timestamp') return true
			}
		}
		return false
	}, [flowRotationData, showFlowRotation])
	const flowTreemapSizeLabel = getRWAFlowTreemapSizeLabel(flowTreemapSizeMetric)
	const flowRotationFilename = `rwa-net-flow-${flowRotationSplitBy}-${flowRotationFrequency}-${flowRotationView}`
	const chartMetricLabel = isFlowVsPrice
		? 'Flow vs Price'
		: isFlowMetric
			? 'Net Flows'
			: getChartMetricLabel(chartTypeKey)
	const chartMetricOptions = [
		...getChartMetricOptions(),
		{ key: 'flows' as const, label: definitions.flows.overviewNetFlows.label },
		...(isPlatformMode ? [{ key: 'flowVsPrice' as const, label: definitions.flows.flowVsPrice.label }] : [])
	]
	const selectedChartMetric: RWAOverviewChartMetric = isFlowVsPrice
		? 'flowVsPrice'
		: isFlowMetric
			? 'flows'
			: chartTypeKey
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
	const flowChartSelection = useMemo<RWAFlowChartSelection>(
		() =>
			isFlowVsPrice
				? {
						view: 'flowVsPrice',
						groupBy: flowGroupBy,
						mcapByTimestamp: flowOnChainMcapByTimestamp
					}
				: { view: 'netFlows', groupBy: flowGroupBy, overlays: flowOverlays },
		[flowGroupBy, flowOnChainMcapByTimestamp, flowOverlays, isFlowVsPrice]
	)
	const flowChart = useMemo(
		() =>
			isFlowMetric && flowData ? buildRWAFlowChart({ points: flowData.series, selection: flowChartSelection }) : null,
		[flowChartSelection, flowData, isFlowMetric]
	)
	const flowDefaultStartTimestamp =
		flowGroupBy === 'daily' && flowData ? getRWAFlowDefaultStartTimestamp(flowData.series, 365) : undefined
	const flowVsPriceSummary = useMemo(
		() => (isFlowVsPrice && flowChart ? getRWAFlowVsPriceSummary(flowChart, flowVisibleRange) : null),
		[flowChart, flowVisibleRange, isFlowVsPrice]
	)
	const flowVsPriceBreakdown = useMemo(
		() =>
			isFlowVsPrice && flowAssetRows && flowOnChainMcapAssetRows
				? getRWAFlowVsPriceAssetSummaries(
						flowAssetRows,
						flowOnChainMcapAssetRows,
						filteredAssets,
						flowGroupBy,
						flowVisibleRange
					)
				: undefined,
		[filteredAssets, flowAssetRows, flowGroupBy, flowOnChainMcapAssetRows, flowVisibleRange, isFlowVsPrice]
	)
	const selectedTimeSeriesDataset = chartDataset
	const timeSeriesCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() => (chartView === 'timeSeries' ? buildRwaTimeSeriesCharts(selectedTimeSeriesDataset) : []),
		[chartView, selectedTimeSeriesDataset]
	)
	const deferredSelectedTimeSeriesDataset = useDeferredValue(selectedTimeSeriesDataset)
	const deferredSelectedPieChartData = useDeferredValue(selectedPieChartData)
	const valueSortedPieChartStackColors = useMemo(() => {
		if (chartView !== 'pie' && chartView !== 'hbar') return EMPTY_CHART_STACK_COLORS
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
	}, [chartView, pieChartStackColors, deferredSelectedPieChartData])
	const selectedBarChartPresentation = useMemo(() => {
		if (chartView !== 'hbar') return EMPTY_HBAR_PRESENTATION
		const rows = limitRwaHorizontalBarData(deferredSelectedPieChartData, { sort: true })
		const categories = new Array<string>(rows.length)
		const values = new Array<number>(rows.length)
		const colors = new Array<string>(rows.length)
		for (let index = 0; index < rows.length; index++) {
			const row = rows[index]
			categories[index] = row.name
			values[index] = row.value
			colors[index] = valueSortedPieChartStackColors[row.name] ?? '#1f77b4'
		}
		return { categories, values, colors }
	}, [chartView, deferredSelectedPieChartData, valueSortedPieChartStackColors])

	const chartTypeSwitch = (
		<SegmentedControl<RWAOverviewChartMetric>
			value={selectedChartMetric}
			onValueChange={(key) => {
				if (key === 'flows' || key === 'flowVsPrice') {
					void pushShallowQuery(router, {
						chartType: key,
						flowMode: flowGroupBy === 'daily' ? undefined : flowGroupBy,
						flowOverlays: key === 'flowVsPrice' ? undefined : getRWAFlowOverlayQueryValue(selectedFlowOverlayMetrics)
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
				tooltip:
					key === 'flows'
						? definitions.flows.overviewNetFlows.description
						: key === 'flowVsPrice'
							? definitions.flows.flowVsPrice.description
							: undefined
			}))}
			label="Chart type"
			variant="default"
			size="md"
			className="mr-auto"
		/>
	)
	const flowOverlaySelect = (
		<Tooltip content={definitions.flows.marketcapOverlay.description}>
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
		</Tooltip>
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
				defaultInclusion={props.defaultInclusion}
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
									<SegmentedControl<RWAFlowGrouping>
										value={flowGroupBy}
										onValueChange={(nextFlowMode) => {
											void pushShallowQuery(router, {
												flowMode: nextFlowMode === 'daily' ? undefined : nextFlowMode
											})
										}}
										options={RWA_FLOW_GROUPING_OPTIONS}
										label="Flow period"
										variant="default"
										size="md"
									/>
								) : (
									<>
										{chartViewSwitch}
										{timeSeriesChartBreakdownSwitch}
									</>
								)}
								{isFlowMetric && !isFlowVsPrice ? flowOverlaySelect : null}
								<ChartCsvExportButton
									chartInstance={multiSeriesChart2Instance}
									filename={timeSeriesChartFilename}
									prepareCsvDirect={() => {
										const exportDataset =
											isFlowMetric && flowChart
												? flowChart.dataset
												: materializeRwaIndependentChartDataset(deferredSelectedTimeSeriesDataset)
										return buildCsvFromDataset({
											dimensions: exportDataset.dimensions,
											source: exportDataset.source,
											filenameBase: timeSeriesChartFilename
										})
									}}
								/>
								<ChartPngExportButton
									chartInstance={multiSeriesChart2Instance}
									filename={timeSeriesChartFilename}
									title={exportChartTitle}
								/>
							</ChartPanelToolbar>
							{isFlowVsPrice && flowVsPriceSummary ? (
								<RWAFlowVsPriceStrip summary={flowVsPriceSummary} breakdown={flowVsPriceBreakdown} />
							) : null}
							{isFlowMetric ? (
								isFlowLoading || (isFlowVsPrice && isFlowMcapLoading) ? (
									<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
										Loading
										<LoadingDots />
									</ChartPanelBodyFallback>
								) : flowError || (isFlowVsPrice && flowMcapError) ? (
									<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
										{flowError instanceof Error
											? flowError.message
											: isFlowVsPrice && flowMcapError
												? flowMcapError
												: 'Failed to load flow data.'}
									</ChartPanelBodyFallback>
								) : flowChart ? (
									<Suspense fallback={<ChartPanelBodyFallback />}>
										<RWAFlowsChart
											chart={flowChart}
											defaultStartTimestamp={flowDefaultStartTimestamp}
											onVisibleRangeChange={handleFlowVisibleRangeChange}
											onReady={handleMultiSeriesChartReady}
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
									<MultiSeriesChart
										dataset={deferredSelectedTimeSeriesDataset}
										charts={timeSeriesCharts}
										hideDefaultLegend={false}
										showTotalInTooltip={!deferredSelectedTimeSeriesDataset.dimensions.includes('Total')}
										onReady={handleMultiSeriesChartReady}
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
										categories={selectedBarChartPresentation.categories}
										values={selectedBarChartPresentation.values}
										colors={selectedBarChartPresentation.colors}
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
						<Select
							allValues={RWA_FLOW_TREEMAP_VIEW_OPTIONS}
							selectedValues={flowRotationView}
							setSelectedValues={(nextView) => {
								void pushShallowQuery(router, {
									flowRotationView: nextView === 'bar' ? undefined : nextView
								})
							}}
							label={flowRotationView === 'heatmap' ? 'Heatmap Chart' : 'Bar Chart'}
							labelType="none"
							variant="filter"
							size="md"
						/>
						<Select
							allValues={RWA_FLOW_ROTATION_SPLIT_OPTIONS}
							selectedValues={flowRotationSplitBy}
							setSelectedValues={(nextSplitBy) => {
								void pushShallowQuery(router, {
									flowRotationBy: nextSplitBy === 'assetGroup' ? undefined : nextSplitBy
								})
							}}
							label={
								RWA_FLOW_ROTATION_SPLIT_OPTIONS.find((option) => option.key === flowRotationSplitBy)?.name ??
								'Asset Groups'
							}
							labelType="none"
							variant="filter"
							size="md"
						/>
						{flowRotationView === 'heatmap' ? (
							<Select
								allValues={RWA_FLOW_TREEMAP_SIZE_OPTIONS}
								selectedValues={flowTreemapSizeMetric}
								setSelectedValues={(metric) => {
									void pushShallowQuery(router, {
										flowHeatmapSize: metric === 'onChainMcap' ? undefined : metric,
										flowTreemapSize: undefined
									})
								}}
								label={`Size: ${flowTreemapSizeLabel}`}
								labelType="none"
								variant="filter"
								size="md"
							/>
						) : null}
						<ChartGroupingSelector
							value={flowRotationFrequency}
							onValueChange={(nextFrequency) => {
								void pushShallowQuery(router, {
									flowRotationFrequency: nextFrequency === 'monthly' ? undefined : nextFrequency
								})
							}}
							options={RWA_FLOW_GROUPING_OPTIONS}
						/>
						{flowRotationView === 'heatmap' ? <ChartRestoreButton chartInstance={flowRotationChartInstance} /> : null}
						<ChartCsvExportButton
							chartInstance={flowRotationChartInstance}
							filename={flowRotationFilename}
							prepareCsvDirect={
								flowRotationView === 'heatmap'
									? () =>
											prepareRWAFlowTreemapCsv({
												nodes: flowTreemap.nodes,
												sizeMetric: flowTreemapSizeMetric,
												groupBy: flowRotationFrequency,
												filename: flowRotationFilename
											})
									: undefined
							}
						/>
						<ChartPngExportButton
							chartInstance={flowRotationChartInstance}
							filename={flowRotationFilename}
							title="RWA Net Flow"
							pngProfile={flowRotationView === 'heatmap' ? 'treemapNormalized' : undefined}
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
					) : flowRotationView === 'heatmap' && hasFlowRotationData && flowTreemap.nodes.length === 0 ? (
						<ChartPanelBodyFallback className="body-sm text-secondary">
							No sized net-flow data available.
						</ChartPanelBodyFallback>
					) : hasFlowRotationData && flowRotationData ? (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							{flowRotationView === 'heatmap' ? (
								<>
									<RWAFlowTreemapChart
										nodes={flowTreemap.nodes}
										sizeLabel={flowTreemapSizeLabel}
										periodLabel={getRWAFlowTreemapPeriodLabel(flowRotationFrequency)}
										excludedSizeCount={flowTreemap.excludedSizeCount}
										onReady={handleFlowRotationChartReady}
									/>
								</>
							) : (
								<RWAFlowRotationChart
									points={flowRotationData}
									groupBy={flowRotationFrequency}
									onReady={handleFlowRotationChartReady}
								/>
							)}
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

export function buildRwaTimeSeriesCharts(dataset: RWAPositionalChartDataset): Array<MultiSeriesChartSeriesConfig> {
	const seriesDimensions = sortRwaChartSeriesLabels(dataset.dimensions.filter((dimension) => dimension !== 'timestamp'))
	const colorSlots = getRwaChartSeriesColorSlots(seriesDimensions)
	const independentSeries = new Map(dataset.independentSeries?.map((series) => [series.name, series.data]) ?? [])

	return seriesDimensions.map((name) => {
		const reservedColorSlot = getRwaReservedSeriesColorSlot(name)
		const colorSlot = colorSlots[name]
		const isReservedSeries = reservedColorSlot !== null
		const isTotalSeries = isRwaTotalSeriesLabel(name)
		const data = independentSeries.get(name)

		return {
			type: 'line',
			name,
			encode: data ? { x: 0, y: 1 } : { x: 'timestamp', y: name },
			...(data ? { data } : {}),
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
	dataset: RWAPositionalChartDataset,
	metric: RWAChartMetricKey
): Map<number, number | null> => {
	const totalLabel = getRwaChartTotalLabel(metric)
	const totalIndex = dataset.dimensions.indexOf(totalLabel)
	if (totalIndex === -1) return new Map()

	const values = new Map<number, number | null>()
	for (const row of dataset.source) {
		const value = row[totalIndex] as number | null | undefined
		values.set(row[0] as number, value ?? null)
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
