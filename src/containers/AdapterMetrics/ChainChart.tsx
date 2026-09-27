import { skipToken, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { readSelectionFromQuery } from '~/components/Select/query'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CHART_COLORS } from '~/constants/colors'
import type { MultiChartConfig } from '~/containers/ProDashboard/types'
import { getAdapterDashboardType } from '~/containers/ProDashboard/utils/adapterChartMapping'
import { generateItemId } from '~/containers/ProDashboard/utils/dashboardUtils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { ScopeNote } from '~/ui/ScopeNote'
import { LoadingIndicator } from '~/ui/Status'
import { slug } from '~/utils'
import { getErrorMessage } from '~/utils/error'
import { chainIconUrl } from '~/utils/icons'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { fetchAdapterChainChartDataByProtocolBreakdown, fetchChainsByAdapterPageChartData } from './api'
import { buildAdapterByChainCombinedChartPresentation, type CombinedChartPresentation } from './combinedChart'
import { LINE_DIMENSIONS, type ADAPTER_TYPES } from './constants'
import type { IAdapterByChainPageData, IChainsByAdapterPageData } from './types'
import {
	buildAdapterByChainBreakdownPresentation,
	buildAdapterByChainLatestValuePresentation,
	buildChainsByAdapterChartPresentation,
	buildProtocolBreakdownNormalization,
	normalizeProtocolBreakdownChartData,
	normalizeChainsByAdapterChartState,
	type ChainsByAdapterChartPresentation,
	type ChainsByAdapterChartState
} from './utils'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart'))
const BuilderTreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart/Builder'))
const PRIMARY_CHART_COLOR = CHART_COLORS[0]
if (PRIMARY_CHART_COLOR === undefined) throw new Error('Chart palette must include a primary color')

const CHART_VIEW_MODES_ADAPTER_BY_CHAIN = ['Combined', 'Breakdown'] as const
type AdapterByChainViewMode = (typeof CHART_VIEW_MODES_ADAPTER_BY_CHAIN)[number]
const CHART_KINDS_CHAINS_BY_ADAPTER = ['Bar', 'Dominance', 'Treemap', 'HBar'] as const
type ChainsByAdapterChartKind = (typeof CHART_KINDS_CHAINS_BY_ADAPTER)[number]
const BAR_VALUE_MODES_CHAINS_BY_ADAPTER = ['Absolute', 'Relative'] as const
type ChainsByAdapterValueMode = (typeof BAR_VALUE_MODES_CHAINS_BY_ADAPTER)[number]
const BAR_LAYOUTS_CHAINS_BY_ADAPTER = ['Stacked', 'Separate'] as const
type ChainsByAdapterBarLayout = (typeof BAR_LAYOUTS_CHAINS_BY_ADAPTER)[number]
const CHAINS_BY_ADAPTER_CHART_HEIGHT = '420px'
const CHAINS_BY_ADAPTER_TREEMAP_HEIGHT = '520px'
const CHART_KIND_OPTIONS = [
	{ key: 'Bar', name: 'Bar Chart' },
	{ key: 'Dominance', name: 'Dominance Chart' },
	{ key: 'Treemap', name: 'Treemap Chart' },
	{ key: 'HBar', name: 'HBar Chart' }
] as const
const BAR_VALUE_MODE_OPTIONS = [
	{ key: 'Absolute', name: 'Absolute ($)' },
	{ key: 'Relative', name: 'Relative (%)' }
] as const
const BAR_LAYOUT_OPTIONS = [
	{ key: 'Stacked', name: 'Stacked' },
	{ key: 'Separate', name: 'Separate' }
] as const
const CHART_VIEW_MODE_OPTIONS = [
	{ key: 'Combined', name: 'Combined' },
	{ key: 'Breakdown', name: 'Breakdown' }
] as const
const EMPTY_DATASET: MultiSeriesTimeSeriesDataset = { source: [], dimensions: ['timestamp'] }
const EMPTY_COMBINED_CHART_PRESENTATION: CombinedChartPresentation = { dataset: EMPTY_DATASET, charts: [] }
type BreakdownChartDataState =
	| { kind: 'loading' }
	| { kind: 'error'; message: string }
	| {
			kind: 'ready'
			chartData: MultiSeriesTimeSeriesDataset
			protocolDimensions: Array<string>
	  }

function assertNever(value: never): never {
	throw new Error(`Unhandled chains by adapter chart state: ${JSON.stringify(value)}`)
}

function normalizeChartStateFromQueryValues({
	chartKindParam,
	valueModeParam,
	barLayoutParam,
	groupByParam,
	legacyChartTypeParam
}: {
	chartKindParam: string | undefined
	valueModeParam: string | undefined
	barLayoutParam: string | undefined
	groupByParam: string | undefined
	legacyChartTypeParam: string | undefined
}): ChainsByAdapterChartState {
	return normalizeChainsByAdapterChartState({
		...(chartKindParam !== undefined ? { chartKindParam } : {}),
		...(valueModeParam !== undefined ? { valueModeParam } : {}),
		...(barLayoutParam !== undefined ? { barLayoutParam } : {}),
		...(groupByParam !== undefined ? { groupByParam } : {}),
		...(legacyChartTypeParam !== undefined ? { legacyChartTypeParam } : {})
	})
}

function getChartKindQueryUpdate(
	nextChartKind: ChainsByAdapterChartKind,
	currentGroupByParam: string | undefined
): Record<string, string | undefined> {
	const normalizedGroupBy = currentGroupByParam?.toLowerCase()
	const nextGroupBy = normalizedGroupBy === 'daily' ? undefined : normalizedGroupBy

	switch (nextChartKind) {
		case 'Bar':
			return {
				chartKind: undefined,
				chartType: undefined,
				valueMode: undefined,
				barLayout: undefined,
				groupBy: nextGroupBy
			}
		case 'Dominance':
			return {
				chartKind: 'dominance',
				chartType: undefined,
				valueMode: undefined,
				barLayout: undefined,
				groupBy: nextGroupBy
			}
		case 'Treemap':
			return {
				chartKind: 'treemap',
				chartType: undefined,
				valueMode: undefined,
				barLayout: undefined,
				groupBy: nextGroupBy
			}
		case 'HBar':
			return {
				chartKind: 'hbar',
				chartType: undefined,
				valueMode: undefined,
				barLayout: undefined,
				groupBy: nextGroupBy
			}
		default:
			return assertNever(nextChartKind)
	}
}

function getChartHeight(chartState: ChainsByAdapterChartState): string {
	switch (chartState.chartKind) {
		case 'bar':
		case 'dominance':
			return CHAINS_BY_ADAPTER_CHART_HEIGHT
		case 'treemap':
		case 'hbar':
			return CHAINS_BY_ADAPTER_TREEMAP_HEIGHT
		default:
			return assertNever(chartState)
	}
}

function getAdapterByChainChartKindQueryUpdate({
	nextChartKind,
	currentGroupByParam
}: {
	nextChartKind: ChainsByAdapterChartKind
	currentGroupByParam: string | undefined
}): Record<string, string | Array<string> | undefined> {
	return getChartKindQueryUpdate(nextChartKind, currentGroupByParam)
}

function applyBarLayoutToPresentation(
	presentation: ChainsByAdapterChartPresentation,
	chartState: ChainsByAdapterChartState
): ChainsByAdapterChartPresentation {
	if (
		presentation.kind !== 'bar' ||
		chartState.chartKind !== 'bar' ||
		presentation.barLayout === chartState.barLayout
	) {
		return presentation
	}

	const charts = presentation.charts.map((chart) => {
		if (chartState.barLayout === 'stacked') {
			return { ...chart, stack: 'chain' as const, large: false }
		}

		const { stack: _stack, large: _large, ...rest } = chart
		return rest
	})

	return {
		...presentation,
		charts,
		barLayout: chartState.barLayout,
		showTotalInTooltip: chartState.valueMode === 'absolute' && chartState.barLayout === 'stacked'
	}
}

export function AdapterByChainChart({
	chartData,
	adapterType,
	chain,
	chartName,
	dataType,
	tableProtocols,
	isCategoryFiltered
}: Pick<IAdapterByChainPageData, 'chartData' | 'adapterType' | 'chain' | 'dataType'> & {
	chartName: string
	tableProtocols: IAdapterByChainPageData['protocols']
	isCategoryFiltered: boolean
}) {
	const router = useRouter()
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const combinedGroupByParam = readSingleQueryValue(router.query.groupBy)?.toLowerCase()
	const combinedInterval = DWMC_GROUPING_OPTIONS_LOWERCASE.find((option) => option.value === combinedGroupByParam)
	const combinedChartInterval: LowercaseDwmcGrouping = combinedInterval?.value ?? 'daily'
	const chartViewParam = readSingleQueryValue(router.query.chartView)?.toLowerCase()
	const chartViewMode: AdapterByChainViewMode = chartViewParam === 'breakdown' ? 'Breakdown' : 'Combined'
	const breakdownChartState = React.useMemo(
		() =>
			normalizeChartStateFromQueryValues({
				chartKindParam: readSingleQueryValue(router.query.chartKind),
				valueModeParam: readSingleQueryValue(router.query.valueMode),
				barLayoutParam: readSingleQueryValue(router.query.barLayout),
				groupByParam: readSingleQueryValue(router.query.groupBy),
				legacyChartTypeParam: readSingleQueryValue(router.query.chartType)
			}),
		[
			router.query.barLayout,
			router.query.chartKind,
			router.query.chartType,
			router.query.groupBy,
			router.query.valueMode
		]
	)

	const breakdownChartDataState = useAdapterByChainBreakdownChartData({
		adapterType,
		chain,
		dataType,
		enabled: chartViewMode === 'Breakdown',
		tableProtocols
	})

	const combinedChartData = chartData

	const protocolOptions = React.useMemo(() => {
		if (breakdownChartDataState.kind !== 'ready') return []
		return breakdownChartDataState.protocolDimensions
	}, [breakdownChartDataState])

	const selectedProtocols = React.useMemo(() => {
		if (chartViewMode !== 'Breakdown' || protocolOptions.length === 0) return []

		return readSelectionFromQuery(router.query, 'protocol', 'excludeProtocol', protocolOptions)
	}, [chartViewMode, protocolOptions, router.query])

	const onChangeCombinedChartInterval = (nextInterval: LowercaseDwmcGrouping) => {
		void pushShallowQuery(router, { groupBy: nextInterval === 'daily' ? undefined : nextInterval })
	}
	const onChangeChartViewMode = (nextChartViewMode: AdapterByChainViewMode) => {
		void pushShallowQuery(router, {
			chartView: nextChartViewMode === 'Combined' ? undefined : nextChartViewMode,
			...(nextChartViewMode === 'Combined'
				? {
						protocol: undefined,
						excludeProtocol: undefined,
						chartKind: undefined,
						chartType: undefined,
						valueMode: undefined,
						barLayout: undefined
					}
				: {})
		})
	}
	const onChangeBreakdownChartInterval = (nextInterval: LowercaseDwmcGrouping) => {
		void pushShallowQuery(router, { groupBy: nextInterval === 'daily' ? undefined : nextInterval })
	}
	const onChangeChartKind = (nextChartKind: ChainsByAdapterChartKind) => {
		void pushShallowQuery(
			router,
			getAdapterByChainChartKindQueryUpdate({
				nextChartKind,
				currentGroupByParam: readSingleQueryValue(router.query.groupBy)
			})
		)
	}
	const onChangeValueMode = (nextValueMode: ChainsByAdapterValueMode) => {
		void pushShallowQuery(router, {
			chartKind: undefined,
			chartType: undefined,
			valueMode: nextValueMode === 'Absolute' ? undefined : nextValueMode.toLowerCase()
		})
	}
	const onChangeBarLayout = (nextBarLayout: ChainsByAdapterBarLayout) => {
		void pushShallowQuery(router, {
			chartKind: undefined,
			chartType: undefined,
			barLayout: nextBarLayout === 'Stacked' ? undefined : nextBarLayout.toLowerCase()
		})
	}

	const combinedFinalCharts = React.useMemo(() => {
		if (chartViewMode !== 'Combined') {
			return { ...EMPTY_COMBINED_CHART_PRESENTATION, groupBy: combinedChartInterval }
		}

		return {
			...buildAdapterByChainCombinedChartPresentation({
				chartData: combinedChartData,
				chartName,
				groupBy: combinedChartInterval
			}),
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			groupBy: combinedChartInterval
		}
	}, [chartViewMode, combinedChartData, chartName, combinedChartInterval])
	const deferredCombinedFinalCharts = React.useDeferredValue(combinedFinalCharts)

	const breakdownChartData =
		breakdownChartDataState.kind === 'ready' ? breakdownChartDataState.chartData : EMPTY_DATASET
	const breakdownChartKind = breakdownChartState.chartKind
	const breakdownGroupBy = breakdownChartState.groupBy
	const breakdownBarValueMode = breakdownChartState.chartKind === 'bar' ? breakdownChartState.valueMode : 'absolute'
	const breakdownChartDataBuildState = React.useMemo<ChainsByAdapterChartState>(() => {
		switch (breakdownChartKind) {
			case 'bar':
				return {
					chartKind: 'bar',
					valueMode: breakdownBarValueMode,
					barLayout: 'stacked',
					groupBy: breakdownGroupBy
				}
			case 'dominance':
				return { chartKind: 'dominance', groupBy: breakdownGroupBy }
			case 'treemap':
				return { chartKind: 'treemap', groupBy: breakdownGroupBy }
			case 'hbar':
				return { chartKind: 'hbar', groupBy: breakdownGroupBy }
			default:
				return assertNever(breakdownChartKind)
		}
	}, [breakdownChartKind, breakdownGroupBy, breakdownBarValueMode])
	const baseBreakdownPresentation = React.useMemo(() => {
		switch (breakdownChartDataBuildState.chartKind) {
			case 'treemap':
			case 'hbar':
				return buildAdapterByChainLatestValuePresentation({
					chartKind: breakdownChartDataBuildState.chartKind,
					selectedProtocols,
					groupBy: breakdownChartDataBuildState.groupBy,
					chartData: breakdownChartData
				})
			case 'dominance':
			case 'bar':
				return buildAdapterByChainBreakdownPresentation({
					chartData: breakdownChartData,
					state: breakdownChartDataBuildState,
					selectedProtocols
				})
			default:
				return assertNever(breakdownChartDataBuildState)
		}
	}, [breakdownChartData, breakdownChartDataBuildState, selectedProtocols])
	const breakdownPresentation = React.useMemo(
		() => applyBarLayoutToPresentation(baseBreakdownPresentation, breakdownChartState),
		[baseBreakdownPresentation, breakdownChartState]
	)
	const deferredBreakdownPresentation = React.useDeferredValue(breakdownPresentation)

	const dashboardChartType = getAdapterDashboardType(adapterType)
	const multiChart = React.useMemo<MultiChartConfig | null>(() => {
		if (!dashboardChartType) return null

		let grouping: MultiChartConfig['grouping']
		switch (combinedChartInterval) {
			case 'weekly':
				grouping = 'week'
				break
			case 'monthly':
				grouping = 'month'
				break
			case 'quarterly':
				grouping = 'quarter'
				break
			case 'yearly':
				grouping = 'year'
				break
			default:
				grouping = 'day'
				break
		}

		return {
			id: generateItemId('multi', `${chain}-${adapterType}`),
			kind: 'multi',
			name: `${chain} – ${chartName}`,
			items: [
				{
					id: generateItemId('chart', `${chain}-${dashboardChartType}`),
					kind: 'chart',
					subjectType: 'chain',
					chain,
					type: dashboardChartType,
					grouping,
					color: PRIMARY_CHART_COLOR
				}
			],
			grouping,
			showCumulative: combinedChartInterval === 'cumulative'
		}
	}, [chain, adapterType, dashboardChartType, combinedChartInterval, chartName])

	const breakdownChartKindLabel =
		breakdownChartState.chartKind === 'treemap'
			? 'Treemap Chart'
			: breakdownChartState.chartKind === 'hbar'
				? 'HBar Chart'
				: breakdownChartState.chartKind === 'dominance'
					? 'Dominance Chart'
					: 'Bar Chart'
	const breakdownBarValueModeLabel =
		breakdownChartState.chartKind === 'bar'
			? breakdownChartState.valueMode === 'relative'
				? 'Relative (%)'
				: 'Absolute ($)'
			: null
	const breakdownBarLayoutLabel =
		breakdownChartState.chartKind === 'bar'
			? breakdownChartState.barLayout === 'separate'
				? 'Separate'
				: 'Stacked'
			: null
	const breakdownChartHeight = getChartHeight(breakdownChartState)
	const breakdownMultiSeriesChartOptions = React.useMemo(() => {
		switch (deferredBreakdownPresentation.kind) {
			case 'treemap':
			case 'hbar':
				return undefined
			case 'bar':
				return deferredBreakdownPresentation.valueMode === 'relative'
					? {
							yAxis: {
								min: 0,
								max: 100
							}
						}
					: undefined
			case 'dominance':
				return {
					yAxis: {
						min: 0,
						max: 100
					}
				}
			default:
				return assertNever(deferredBreakdownPresentation)
		}
	}, [deferredBreakdownPresentation])
	const canExportBreakdownChart =
		(deferredBreakdownPresentation.kind !== 'treemap' && deferredBreakdownPresentation.kind !== 'hbar') ||
		deferredBreakdownPresentation.data.length > 0
	const breakdownExportConfig = React.useMemo(() => {
		const chartBaseTitle = `${chain === 'All' ? 'All Chains' : chain} ${chartName}`
		const chainSlug = slug(chain === 'All' ? 'all-chains' : chain)

		if (breakdownChartState.chartKind === 'dominance') {
			return {
				filename: `${chainSlug}-${slug(chartName)}-by-protocol-dominance-${breakdownChartState.groupBy}`,
				title: chartBaseTitle
			}
		}
		if (breakdownChartState.chartKind === 'treemap') {
			return {
				filename: `${chainSlug}-${slug(chartName)}-by-protocol-treemap-${breakdownChartState.groupBy}`,
				title: chartBaseTitle
			}
		}
		if (breakdownChartState.chartKind === 'hbar') {
			return {
				filename: `${chainSlug}-${slug(chartName)}-by-protocol-hbar-${breakdownChartState.groupBy}`,
				title: chartBaseTitle
			}
		}

		return {
			filename: `${chainSlug}-${slug(chartName)}-by-protocol-bar-${breakdownChartState.valueMode}-${breakdownChartState.barLayout}-${breakdownChartState.groupBy}`,
			title: chartBaseTitle
		}
	}, [breakdownChartState, chain, chartName])
	return (
		<ChartPanel className="col-span-2">
			<ChartPanelToolbar>
				<Select
					allValues={CHART_VIEW_MODE_OPTIONS}
					selectedValues={chartViewMode}
					setSelectedValues={(value: string) => onChangeChartViewMode(value as AdapterByChainViewMode)}
					label={chartViewMode}
					labelType="none"
					variant="filter"
					size="md"
				/>
				{chartViewMode === 'Breakdown' ? (
					<Select
						allValues={CHART_KIND_OPTIONS}
						selectedValues={
							breakdownChartState.chartKind === 'treemap'
								? 'Treemap'
								: breakdownChartState.chartKind === 'hbar'
									? 'HBar'
									: breakdownChartState.chartKind === 'dominance'
										? 'Dominance'
										: 'Bar'
						}
						setSelectedValues={(value: string) => onChangeChartKind(value as ChainsByAdapterChartKind)}
						label={breakdownChartKindLabel}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				{chartViewMode === 'Breakdown' && breakdownChartState.chartKind === 'bar' ? (
					<Select
						allValues={BAR_VALUE_MODE_OPTIONS}
						selectedValues={breakdownChartState.valueMode === 'relative' ? 'Relative' : 'Absolute'}
						setSelectedValues={(value: string) => onChangeValueMode(value as ChainsByAdapterValueMode)}
						label={breakdownBarValueModeLabel ?? 'Absolute'}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				{chartViewMode === 'Breakdown' && breakdownChartState.chartKind === 'bar' ? (
					<Select
						allValues={BAR_LAYOUT_OPTIONS}
						selectedValues={breakdownChartState.barLayout === 'separate' ? 'Separate' : 'Stacked'}
						setSelectedValues={(value: string) => onChangeBarLayout(value as ChainsByAdapterBarLayout)}
						label={breakdownBarLayoutLabel ?? 'Stacked'}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				{chartViewMode === 'Breakdown' ? (
					<ChartGroupingSelector
						value={breakdownChartState.groupBy}
						onValueChange={onChangeBreakdownChartInterval}
						options={DWMC_GROUPING_OPTIONS_LOWERCASE}
					/>
				) : null}
				{chartViewMode === 'Combined' && !LINE_DIMENSIONS.has(chartName) ? (
					<ChartGroupingSelector
						value={combinedChartInterval}
						onValueChange={onChangeCombinedChartInterval}
						options={DWMC_GROUPING_OPTIONS_LOWERCASE}
					/>
				) : null}
				{chartViewMode === 'Combined' && chain ? <AddToDashboardButton chartConfig={multiChart} smol /> : null}
				<div className="ml-auto flex items-center justify-end gap-1.5">
					{chartViewMode === 'Breakdown' && protocolOptions.length > 0 ? (
						<SelectWithCombobox
							allValues={protocolOptions}
							includeQueryKey="protocol"
							excludeQueryKey="excludeProtocol"
							defaultSelectedValues={protocolOptions}
							label="Protocols"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					{chartViewMode === 'Breakdown' ? (
						breakdownChartState.chartKind === 'treemap' ? (
							<ChartRestoreButton chartInstance={exportChartInstance} />
						) : null
					) : null}
					{chartViewMode === 'Breakdown' ? (
						canExportBreakdownChart ? (
							<ChartExportButtons
								chartInstance={exportChartInstance}
								filename={breakdownExportConfig.filename}
								title={breakdownExportConfig.title}
								iconUrl={chain !== 'All' ? chainIconUrl(chain) : undefined}
								csvSource={deferredBreakdownPresentation.csvSource}
								pngProfile={breakdownChartState.chartKind === 'treemap' ? 'treemapNormalized' : undefined}
							/>
						) : null
					) : (
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename={`${chain}-${adapterType}-${chartName}`}
							title={chain === 'All' ? 'All Chains' : chain}
							iconUrl={chain !== 'All' ? chainIconUrl(chain) : undefined}
							csvSource={{
								type: 'dataset',
								prepare: () => ({
									...deferredCombinedFinalCharts.dataset,
									groupBy: deferredCombinedFinalCharts.groupBy
								})
							}}
						/>
					)}
				</div>
			</ChartPanelToolbar>
			{/* The API totals do not add up by category, so the header and combined chart stay unfiltered. */}
			{isCategoryFiltered ? (
				<ScopeNote>
					{chartViewMode === 'Combined'
						? 'The totals and this chart ignore the category filter and show every protocol.'
						: 'The totals ignore the category filter and show every protocol.'}
				</ScopeNote>
			) : null}
			{chartViewMode === 'Breakdown' && breakdownChartDataState.kind === 'error' ? (
				<ChartPanelBodyFallback className="body-sm text-data-down" role="alert">
					{breakdownChartDataState.message}
				</ChartPanelBodyFallback>
			) : chartViewMode === 'Breakdown' && breakdownChartDataState.kind === 'loading' ? (
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator />
					<span className="sr-only">Loading chart data</span>
				</ChartPanelBodyFallback>
			) : chartViewMode === 'Breakdown' ? (
				<React.Suspense
					fallback={
						<div
							style={{
								height: breakdownChartHeight
							}}
						/>
					}
				>
					{deferredBreakdownPresentation.kind === 'treemap' ? (
						<BuilderTreemapChart
							data={deferredBreakdownPresentation.data}
							height={breakdownChartHeight}
							onReady={handleChartReady}
						/>
					) : deferredBreakdownPresentation.kind === 'hbar' ? (
						<HBarChart
							categories={deferredBreakdownPresentation.data.map((item) => item.name)}
							values={deferredBreakdownPresentation.data.map((item) => item.value)}
							colors={deferredBreakdownPresentation.data.map((item) => item.itemStyle.color)}
							height={breakdownChartHeight}
							valueSymbol="$"
							onReady={handleChartReady}
						/>
					) : (
						<MultiSeriesChart
							dataset={deferredBreakdownPresentation.dataset}
							charts={deferredBreakdownPresentation.charts}
							csvSource={deferredBreakdownPresentation.csvSource}
							height={breakdownChartHeight}
							valueSymbol={
								deferredBreakdownPresentation.kind === 'bar' && deferredBreakdownPresentation.valueMode === 'absolute'
									? '$'
									: '%'
							}
							solidChartAreaStyle={deferredBreakdownPresentation.kind === 'dominance'}
							{...(breakdownMultiSeriesChartOptions ? { chartOptions: breakdownMultiSeriesChartOptions } : {})}
							groupBy={deferredBreakdownPresentation.groupBy}
							hideDefaultLegend={deferredBreakdownPresentation.charts.length === 1}
							showTotalInTooltip={
								deferredBreakdownPresentation.kind === 'bar' ? deferredBreakdownPresentation.showTotalInTooltip : false
							}
							onReady={handleChartReady}
						/>
					)}
				</React.Suspense>
			) : (
				<React.Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={deferredCombinedFinalCharts.dataset}
						charts={deferredCombinedFinalCharts.charts}
						csvSource={{
							type: 'dataset',
							prepare: () => ({ ...deferredCombinedFinalCharts.dataset, groupBy: deferredCombinedFinalCharts.groupBy })
						}}
						hideDefaultLegend={deferredCombinedFinalCharts.charts.length === 1}
						groupBy={deferredCombinedFinalCharts.groupBy}
						onReady={handleChartReady}
					/>
				</React.Suspense>
			)}
		</ChartPanel>
	)
}

function useAdapterByChainBreakdownChartData({
	adapterType,
	chain,
	dataType,
	enabled,
	tableProtocols
}: {
	adapterType: `${ADAPTER_TYPES}`
	chain: string
	dataType: IAdapterByChainPageData['dataType']
	enabled: boolean
	tableProtocols: IAdapterByChainPageData['protocols']
}): BreakdownChartDataState {
	const safeDataType = dataType === 'dailyEarnings' ? undefined : (dataType ?? undefined)
	const breakdownNormalization = React.useMemo(
		() => buildProtocolBreakdownNormalization(tableProtocols),
		[tableProtocols]
	)

	const { data, isLoading, error } = useQuery({
		queryKey: ['adapter-breakdown-chart', adapterType, chain, safeDataType, breakdownNormalization.signature],
		queryFn: async () => {
			const chart = await fetchAdapterChainChartDataByProtocolBreakdown({
				adapterType,
				chain,
				...(safeDataType !== undefined ? { dataType: safeDataType } : {})
			})
			const normalized = normalizeProtocolBreakdownChartData({
				chart,
				normalization: breakdownNormalization
			})

			return {
				chartData: normalized.chartData,
				protocolDimensions: normalized.protocolDimensions
			}
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled
	})

	return React.useMemo(() => {
		if (!enabled) {
			return { kind: 'ready', chartData: EMPTY_DATASET, protocolDimensions: [] }
		}

		if (isLoading) {
			return { kind: 'loading' }
		}

		if (error) {
			return { kind: 'error', message: getErrorMessage(error) }
		}

		return {
			kind: 'ready',
			chartData: data?.chartData ?? EMPTY_DATASET,
			protocolDimensions: data?.protocolDimensions ?? []
		}
	}, [data, enabled, error, isLoading])
}

export function ChainsByAdapterChart({
	adapterType,
	dataType,
	chartData,
	allChains,
	chartName
}: Pick<IChainsByAdapterPageData, 'adapterType' | 'dataType' | 'chartData' | 'allChains'> & {
	chartName: string
}) {
	const router = useRouter()
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()
	const chartState = React.useMemo(
		() =>
			normalizeChartStateFromQueryValues({
				chartKindParam: readSingleQueryValue(router.query.chartKind),
				valueModeParam: readSingleQueryValue(router.query.valueMode),
				barLayoutParam: readSingleQueryValue(router.query.barLayout),
				groupByParam: readSingleQueryValue(router.query.groupBy),
				legacyChartTypeParam: readSingleQueryValue(router.query.chartType)
			}),
		[
			router.query.barLayout,
			router.query.chartKind,
			router.query.chartType,
			router.query.groupBy,
			router.query.valueMode
		]
	)
	const selectedChains = React.useMemo(
		() => readSelectionFromQuery(router.query, 'chain', 'excludeChain', allChains),
		[allChains, router.query]
	)
	const shouldFetchBaseChartData = chartData.source.length === 0 && dataType != null
	const {
		data: baseChartData,
		error: baseChartError,
		isLoading: isBaseChartLoading
	} = useQuery({
		queryKey: ['page-data', 'dimension-adapters', 'chains-chart', adapterType, dataType],
		queryFn: dataType === null ? skipToken : () => fetchChainsByAdapterPageChartData({ adapterType, dataType }),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: shouldFetchBaseChartData
	})
	const currentChartData = baseChartData ?? chartData

	const chartKind = chartState.chartKind
	const chartGroupBy = chartState.groupBy
	const chartBarValueMode = chartState.chartKind === 'bar' ? chartState.valueMode : 'absolute'
	const chartDataBuildState = React.useMemo<ChainsByAdapterChartState>(() => {
		switch (chartKind) {
			case 'bar':
				return {
					chartKind: 'bar',
					valueMode: chartBarValueMode,
					barLayout: 'stacked',
					groupBy: chartGroupBy
				}
			case 'dominance':
				return { chartKind: 'dominance', groupBy: chartGroupBy }
			case 'treemap':
				return { chartKind: 'treemap', groupBy: chartGroupBy }
			case 'hbar':
				return { chartKind: 'hbar', groupBy: chartGroupBy }
			default:
				return assertNever(chartKind)
		}
	}, [chartKind, chartGroupBy, chartBarValueMode])
	const baseChartPresentation = React.useMemo(
		() =>
			buildChainsByAdapterChartPresentation({
				chartData: currentChartData,
				selectedChains,
				state: chartDataBuildState
			}),
		[currentChartData, selectedChains, chartDataBuildState]
	)
	const chartPresentation = React.useMemo(
		() => applyBarLayoutToPresentation(baseChartPresentation, chartState),
		[baseChartPresentation, chartState]
	)
	const deferredChartPresentation = React.useDeferredValue(chartPresentation)

	const onChangeChartInterval = (nextInterval: LowercaseDwmcGrouping) => {
		void pushShallowQuery(router, { groupBy: nextInterval === 'daily' ? undefined : nextInterval })
	}

	const onChangeChartKind = (nextChartKind: ChainsByAdapterChartKind) => {
		void pushShallowQuery(router, getChartKindQueryUpdate(nextChartKind, readSingleQueryValue(router.query.groupBy)))
	}

	const onChangeValueMode = (nextValueMode: ChainsByAdapterValueMode) => {
		void pushShallowQuery(router, {
			chartKind: undefined,
			chartType: undefined,
			valueMode: nextValueMode === 'Absolute' ? undefined : nextValueMode.toLowerCase()
		})
	}

	const onChangeBarLayout = (nextBarLayout: ChainsByAdapterBarLayout) => {
		void pushShallowQuery(router, {
			chartKind: undefined,
			chartType: undefined,
			barLayout: nextBarLayout === 'Stacked' ? undefined : nextBarLayout.toLowerCase()
		})
	}

	const exportConfig = React.useMemo(() => {
		if (chartState.chartKind === 'dominance') {
			return {
				filename: `${slug(chartName)}-by-chain-dominance-${chartState.groupBy}`,
				title: chartName
			}
		}

		if (chartState.chartKind === 'treemap') {
			return {
				filename: `${slug(chartName)}-by-chain-treemap-${chartState.groupBy}`,
				title: chartName
			}
		}
		if (chartState.chartKind === 'hbar') {
			return {
				filename: `${slug(chartName)}-by-chain-hbar-${chartState.groupBy}`,
				title: chartName
			}
		}

		return {
			filename: `${slug(chartName)}-by-chain-bar-${chartState.valueMode}-${chartState.barLayout}-${chartState.groupBy}`,
			title: chartName
		}
	}, [chartName, chartState])

	const chartKindLabel =
		chartState.chartKind === 'treemap'
			? 'Treemap Chart'
			: chartState.chartKind === 'hbar'
				? 'HBar Chart'
				: chartState.chartKind === 'dominance'
					? 'Dominance Chart'
					: 'Bar Chart'
	const barValueModeLabel =
		chartState.chartKind === 'bar' ? (chartState.valueMode === 'relative' ? 'Relative (%)' : 'Absolute ($)') : null
	const barLayoutLabel =
		chartState.chartKind === 'bar' ? (chartState.barLayout === 'separate' ? 'Separate' : 'Stacked') : null
	const chartHeight = getChartHeight(chartState)
	const multiSeriesChartOptions = React.useMemo(() => {
		switch (deferredChartPresentation.kind) {
			case 'treemap':
			case 'hbar':
				return undefined
			case 'bar':
				return deferredChartPresentation.valueMode === 'relative'
					? {
							yAxis: {
								min: 0,
								max: 100
							}
						}
					: undefined
			case 'dominance':
				return {
					yAxis: {
						min: 0,
						max: 100
					}
				}
			default:
				return assertNever(deferredChartPresentation)
		}
	}, [deferredChartPresentation])
	const baseChartErrorMessage = baseChartError ? getErrorMessage(baseChartError) : null
	const canExportChart =
		(deferredChartPresentation.kind !== 'treemap' && deferredChartPresentation.kind !== 'hbar') ||
		deferredChartPresentation.data.length > 0
	return (
		<ChartPanel className="col-span-2">
			<ChartPanelToolbar>
				<Select
					allValues={CHART_KIND_OPTIONS}
					selectedValues={
						chartState.chartKind === 'treemap'
							? 'Treemap'
							: chartState.chartKind === 'hbar'
								? 'HBar'
								: chartState.chartKind === 'dominance'
									? 'Dominance'
									: 'Bar'
					}
					setSelectedValues={(value: string) => onChangeChartKind(value as ChainsByAdapterChartKind)}
					label={chartKindLabel}
					labelType="none"
					variant="filter"
					size="md"
				/>
				{chartState.chartKind === 'bar' ? (
					<Select
						allValues={BAR_VALUE_MODE_OPTIONS}
						selectedValues={chartState.valueMode === 'relative' ? 'Relative' : 'Absolute'}
						setSelectedValues={(value: string) => onChangeValueMode(value as ChainsByAdapterValueMode)}
						label={barValueModeLabel ?? 'Absolute'}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				{chartState.chartKind === 'bar' ? (
					<Select
						allValues={BAR_LAYOUT_OPTIONS}
						selectedValues={chartState.barLayout === 'separate' ? 'Separate' : 'Stacked'}
						setSelectedValues={(value: string) => onChangeBarLayout(value as ChainsByAdapterBarLayout)}
						label={barLayoutLabel ?? 'Stacked'}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartGroupingSelector
					value={chartState.groupBy}
					onValueChange={onChangeChartInterval}
					options={DWMC_GROUPING_OPTIONS_LOWERCASE}
				/>
				<div className="ml-auto flex items-center justify-end gap-1.5">
					<SelectWithCombobox
						allValues={allChains}
						includeQueryKey="chain"
						excludeQueryKey="excludeChain"
						defaultSelectedValues={allChains}
						label="Chains"
						labelType="smol"
						variant="filter"
						size="md"
					/>
					{chartState.chartKind === 'treemap' ? <ChartRestoreButton chartInstance={exportChartInstance} /> : null}
					{canExportChart ? (
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename={exportConfig.filename}
							title={exportConfig.title}
							csvSource={deferredChartPresentation.csvSource}
							pngProfile={chartState.chartKind === 'treemap' ? 'treemapNormalized' : undefined}
						/>
					) : null}
				</div>
			</ChartPanelToolbar>
			<React.Suspense
				fallback={
					<div
						style={{
							height: chartHeight
						}}
					/>
				}
			>
				{isBaseChartLoading ? (
					<div
						role="status"
						aria-live="polite"
						className="flex items-center justify-center text-tertiary"
						style={{ height: chartHeight }}
					>
						<LoadingIndicator />
						<span className="sr-only">Loading chart data</span>
					</div>
				) : baseChartErrorMessage ? (
					<div
						role="alert"
						className="flex items-center justify-center p-4 text-center body-sm text-tertiary"
						style={{ height: chartHeight }}
					>
						Failed to load chart data: {baseChartErrorMessage}
					</div>
				) : deferredChartPresentation.kind === 'treemap' ? (
					<BuilderTreemapChart data={deferredChartPresentation.data} height={chartHeight} onReady={handleChartReady} />
				) : deferredChartPresentation.kind === 'hbar' ? (
					<HBarChart
						categories={deferredChartPresentation.data.map((item) => item.name)}
						values={deferredChartPresentation.data.map((item) => item.value)}
						colors={deferredChartPresentation.data.map((item) => item.itemStyle.color)}
						height={chartHeight}
						valueSymbol="$"
						onReady={handleChartReady}
					/>
				) : (
					<MultiSeriesChart
						dataset={deferredChartPresentation.dataset}
						charts={deferredChartPresentation.charts}
						csvSource={deferredChartPresentation.csvSource}
						height={chartHeight}
						valueSymbol={
							deferredChartPresentation.kind === 'bar' && deferredChartPresentation.valueMode === 'absolute' ? '$' : '%'
						}
						solidChartAreaStyle={deferredChartPresentation.kind === 'dominance'}
						{...(multiSeriesChartOptions ? { chartOptions: multiSeriesChartOptions } : {})}
						groupBy={deferredChartPresentation.groupBy}
						hideDefaultLegend={deferredChartPresentation.charts.length === 1}
						showTotalInTooltip={
							deferredChartPresentation.kind === 'bar' ? deferredChartPresentation.showTotalInTooltip : false
						}
						onReady={handleChartReady}
					/>
				)}
			</React.Suspense>
		</ChartPanel>
	)
}
