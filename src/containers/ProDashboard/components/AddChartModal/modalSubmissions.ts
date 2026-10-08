import { isChainTokenChartType } from '../../chartSource'
import { createChartConfig, createMetricConfig } from '../../dashboardConfig/classicChartConfig'
import { createDatasetTableConfig, type NewDatasetTableSelection } from '../../dashboardConfig/datasetTableConfig'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { getDashboardItemLayout } from '../../dashboardLayout/cardHeight'
import { sanitizeDashboardItemBindings } from '../../dashboardVariables/bindableFields'
import { setDashboardItemBinding } from '../../dashboardVariables/resolve'
import {
	type Chain,
	CHART_TYPES,
	type ChartConfig,
	type DashboardBindableField,
	type DashboardGrouping,
	type DashboardItemBindings,
	type DashboardItemLayout,
	type DatasetTableConfig,
	type MetricConfig,
	type MetricSubject,
	type Protocol,
	isProDashboardChartType,
	limitMultiChartItems,
	normalizeYieldChartType
} from '../../types'
import type { UnifiedTableConfig } from '../../unifiedTable/config/current'
import type { ModalState } from './types'

export function applyUnifiedTableBinding<Config extends Partial<UnifiedTableConfig>>(
	config: Config,
	variableId: string | null
): Config {
	const { bindings: previous, ...rest } = config
	const bindings: DashboardItemBindings = { ...previous }
	if (variableId) bindings.chains = variableId
	else delete bindings.chains
	return (Object.keys(bindings).length > 0 ? { ...rest, bindings } : rest) as Config
}

export function buildDatasetTableSelections(
	state: ModalState,
	previous: DatasetTableConfig | null
): Array<NewDatasetTableSelection> {
	switch (state.selectedTableType) {
		case null:
		case 'protocols':
			return []
		case 'cex':
			return [{ datasetType: 'cex-analytics', cexAnalyticsView: 'comparison' }]
		case 'cex-analytics':
			if (state.selectedCexAnalyticsView === 'starter') {
				if (previous) return [{ datasetType: 'cex-analytics', cexAnalyticsView: 'comparison' }]
				return [
					{ datasetType: 'cex-analytics', cexAnalyticsView: 'summary' },
					{ datasetType: 'cex-analytics', cexAnalyticsView: 'comparison' },
					{ datasetType: 'cex-analytics', cexAnalyticsView: 'spot-vs-derivatives' }
				]
			}
			return state.selectedCexAnalyticsView === 'market-share'
				? [
						{
							datasetType: 'cex-analytics',
							cexAnalyticsView: state.selectedCexAnalyticsView,
							cexAnalyticsMetric: state.selectedCexAnalyticsMetric,
							cexAnalyticsTopN: state.selectedCexAnalyticsTopN
						}
					]
				: [{ datasetType: 'cex-analytics', cexAnalyticsView: state.selectedCexAnalyticsView }]
		case 'stablecoins':
			return state.selectedDatasetChain ? [{ datasetType: 'stablecoins', chain: state.selectedDatasetChain }] : []
		case 'token-usage':
			return state.selectedTokens.length > 0
				? [
						{
							datasetType: 'token-usage',
							tokenSymbols: state.selectedTokens,
							includeCex: state.includeCex
						}
					]
				: []
		case 'yields': {
			const previousYields = previous?.datasetType === 'yields' ? previous : null
			return [
				{
					datasetType: 'yields',
					chains: state.selectedChains,
					...(previousYields?.filters === undefined ? {} : { filters: previousYields.filters }),
					...(previousYields?.columnOrder === undefined ? {} : { columnOrder: previousYields.columnOrder }),
					...(previousYields?.columnVisibility === undefined
						? {}
						: { columnVisibility: previousYields.columnVisibility })
				}
			]
		}
		case 'chains': {
			const previousChains = previous?.datasetType === 'chains' ? previous : null
			return [
				{
					datasetType: 'chains',
					...(state.selectedDatasetChain === null ? {} : { category: state.selectedDatasetChain }),
					...(previousChains?.columnOrder === undefined ? {} : { columnOrder: previousChains.columnOrder }),
					...(previousChains?.columnVisibility === undefined
						? {}
						: { columnVisibility: previousChains.columnVisibility })
				}
			]
		}
		case 'rwa':
		case 'rwa-chains':
		case 'equities':
			return [{ datasetType: state.selectedTableType }]
		case 'rwa-selected-chain':
			return state.selectedDatasetChain
				? [{ datasetType: 'rwa-selected-chain', chain: state.selectedDatasetChain }]
				: []
		case 'equities-financials':
		case 'equities-filings':
			return state.selectedDatasetChain
				? [{ datasetType: state.selectedTableType, ticker: state.selectedDatasetChain }]
				: []
		default:
			return state.selectedTableType satisfies never
	}
}

export type DashboardItemIdFactory = (kind: string, identity: string) => string

const CUSTOM_DATA_COL_SPAN = 2

function withModalBindings(item: DashboardItemConfig, bindings: DashboardItemBindings): DashboardItemConfig {
	const sanitized = sanitizeDashboardItemBindings(item, bindings)
	if (!sanitized) return item
	let bound: DashboardItemConfig = item
	for (const [field, variableId] of Object.entries(sanitized)) {
		bound = setDashboardItemBinding(bound, field as DashboardBindableField, variableId)
	}
	if (bound.kind === 'chart' && sanitized.subject !== undefined && bound.geckoId !== undefined) {
		const { geckoId: _boundGeckoId, ...withoutGeckoId } = bound
		return withoutGeckoId
	}
	return bound
}

interface BuildNewDashboardItemsInput {
	state: ModalState
	protocols: ReadonlyArray<Protocol>
	chains: ReadonlyArray<Chain>
	existingItems: ReadonlyArray<DashboardItemConfig>
	idFactory: DashboardItemIdFactory
}

function getDatasetTableIdentifier(selection: NewDatasetTableSelection): string {
	switch (selection.datasetType) {
		case 'yields':
			return `${selection.datasetType}-${selection.chains.join('-') || 'all'}`
		case 'stablecoins':
		case 'rwa-selected-chain':
			return `${selection.datasetType}-${selection.chain}`
		case 'chains':
			return `${selection.datasetType}-${selection.category ?? 'all'}`
		case 'equities-financials':
		case 'equities-filings':
			return `${selection.datasetType}-${selection.ticker}`
		case 'cex-analytics':
			return selection.cexAnalyticsView === 'market-share'
				? `${selection.datasetType}-${selection.cexAnalyticsView}-${selection.cexAnalyticsMetric}-${selection.cexAnalyticsTopN}`
				: `${selection.datasetType}-${selection.cexAnalyticsView}`
		case 'token-usage':
			return `${selection.datasetType}-${selection.tokenSymbols.join('-')}`
		case 'rwa':
		case 'rwa-chains':
		case 'equities':
			return selection.datasetType
	}
}

function buildNewChart({
	item,
	itemType,
	chartType,
	idFactory,
	geckoId,
	color,
	dataType,
	grouping: requestedGrouping,
	showCumulative
}: {
	item: string
	itemType: 'chain' | 'protocol'
	chartType: string
	idFactory: DashboardItemIdFactory
	geckoId?: string | null
	color?: string
	dataType?: 'documented' | 'realtime'
	grouping?: ChartConfig['grouping']
	showCumulative?: boolean
}): ChartConfig | null {
	const id = idFactory(chartType, item)
	const chartTypeDetails = isProDashboardChartType(chartType) ? CHART_TYPES[chartType] : null
	const groupable = chartTypeDetails !== null && 'groupable' in chartTypeDetails && chartTypeDetails.groupable === true
	const grouping: ChartConfig['grouping'] = groupable ? (requestedGrouping ?? 'day') : undefined
	const cumulative = showCumulative === true ? { showCumulative: true } : {}
	if (itemType === 'chain') {
		return createChartConfig({
			id,
			kind: 'chart',
			subjectType: 'chain',
			chain: item,
			type: chartType,
			...(grouping === undefined ? {} : { grouping }),
			...(geckoId === undefined ? {} : { geckoId }),
			...(color === undefined ? {} : { color }),
			...(dataType === undefined ? {} : { dataType }),
			...cumulative,
			colSpan: 1
		})
	}
	return createChartConfig({
		id,
		kind: 'chart',
		subjectType: 'protocol',
		protocol: item,
		type: chartType,
		...(grouping === undefined ? {} : { grouping }),
		...(geckoId === undefined ? {} : { geckoId }),
		...(color === undefined ? {} : { color }),
		...(dataType === undefined ? {} : { dataType }),
		...cumulative,
		colSpan: 1
	})
}

function buildNewComparisonItems({
	state,
	existingItems,
	idFactory
}: BuildNewDashboardItemsInput): Array<DashboardItemConfig> {
	if (state.composerItems.length > 0) {
		if (state.chartCreationMode === 'combined' && state.composerItems.length > 1) {
			let existingMultiCount = 0
			for (const item of existingItems) if (item.kind === 'multi') existingMultiCount++
			const defaultGrouping = 'day'
			return [
				{
					id: idFactory('multi', ''),
					kind: 'multi',
					name: state.unifiedChartName.trim() || `Multi-Chart ${existingMultiCount + 1}`,
					items: limitMultiChartItems(state.composerItems).map((chart) => ({
						...chart,
						grouping: chart.grouping || defaultGrouping
					})),
					grouping: defaultGrouping,
					colSpan: 1
				}
			]
		}

		const items: Array<DashboardItemConfig> = []
		for (const chart of state.composerItems) {
			const item = buildNewChart({
				...(chart.subjectType === 'chain'
					? { item: chart.chain, itemType: 'chain' as const }
					: { item: chart.protocol, itemType: 'protocol' as const }),
				chartType: chart.type,
				idFactory,
				...(chart.geckoId === undefined ? {} : { geckoId: chart.geckoId }),
				...(chart.color === undefined ? {} : { color: chart.color }),
				...(chart.dataType === undefined ? {} : { dataType: chart.dataType }),
				...(chart.grouping === undefined ? {} : { grouping: chart.grouping }),
				...(chart.showCumulative === undefined ? {} : { showCumulative: chart.showCumulative })
			})
			if (item) items.push(item)
		}
		return items
	}

	// The subject tabs submit only once a series is picked (resolveSubmitGate, resolveSubmitError), so there is nothing
	// else to add.
	return []
}

function buildNewManualChart(input: BuildNewDashboardItemsInput): Array<DashboardItemConfig> {
	const { state, protocols, idFactory } = input
	switch (state.selectedChartTab) {
		case 'yields':
			return state.selectedYieldPool
				? [
						{
							id: idFactory('yields', state.selectedYieldPool.configID),
							kind: 'yields',
							poolConfigId: state.selectedYieldPool.configID,
							poolName: state.selectedYieldPool.name,
							project: state.selectedYieldPool.project,
							chain: state.selectedYieldPool.chain,
							chartType: normalizeYieldChartType(state.selectedYieldChartType),
							colSpan: 1
						}
					]
				: []
		case 'stablecoins':
			return state.stablecoinMode === 'asset' && state.selectedStablecoinAsset && state.selectedStablecoinAssetId
				? [
						{
							id: idFactory(
								'stablecoin-asset',
								`${state.selectedStablecoinAsset}-${state.selectedStablecoinAssetChartType}`
							),
							kind: 'stablecoin-asset',
							stablecoin: state.selectedStablecoinAsset,
							stablecoinId: state.selectedStablecoinAssetId,
							chartType: state.selectedStablecoinAssetChartType,
							colSpan: 1
						}
					]
				: [
						{
							id: idFactory('stablecoins', `${state.selectedStablecoinChain}-${state.selectedStablecoinChartType}`),
							kind: 'stablecoins',
							chain: state.selectedStablecoinChain,
							chartType: state.selectedStablecoinChartType,
							colSpan: 1
						}
					]
		case 'rwa':
			return state.rwaMode === 'asset' && state.selectedRwaAssetId && state.selectedRwaAssetName
				? [
						{
							id: idFactory('rwa-asset', `${state.selectedRwaAssetId}-${state.selectedRwaAssetMetrics.join('-')}`),
							kind: 'rwa-asset',
							assetId: state.selectedRwaAssetId,
							assetName: state.selectedRwaAssetName,
							metrics: state.selectedRwaAssetMetrics,
							colSpan: 1
						}
					]
				: [
						{
							id: idFactory(
								'rwa-overview',
								`${state.selectedRwaChain === 'All' ? 'all' : state.selectedRwaChain}-${state.selectedRwaMetric}-${state.selectedRwaChartView}-${state.selectedRwaBreakdown}`
							),
							kind: 'rwa-overview',
							metric: state.selectedRwaMetric,
							chartView: state.selectedRwaChartView,
							breakdown: state.selectedRwaBreakdown,
							...(state.selectedRwaChain === 'All' ? {} : { chain: state.selectedRwaChain }),
							treemapNestedBy: state.selectedRwaTreemapNestedBy || 'none',
							colSpan: 1
						}
					]
		case 'unlocks': {
			if (!state.selectedUnlocksProtocol) return []
			const protocol = protocols.find((item) => item.slug === state.selectedUnlocksProtocol)
			const protocolName = state.selectedUnlocksProtocolName || protocol?.name || state.selectedUnlocksProtocol
			if (state.selectedUnlocksChartType === 'schedule') {
				return [
					{
						id: idFactory('unlocks-schedule', state.selectedUnlocksProtocol),
						kind: 'unlocks-schedule',
						protocol: state.selectedUnlocksProtocol,
						protocolName,
						dataType: 'documented',
						colSpan: 2
					}
				]
			}
			if (state.selectedUnlocksChartType === 'allocation' || state.selectedUnlocksChartType === 'locked-unlocked') {
				return [
					{
						id: idFactory('unlocks-pie', `${state.selectedUnlocksProtocol}-${state.selectedUnlocksChartType}`),
						kind: 'unlocks-pie',
						protocol: state.selectedUnlocksProtocol,
						protocolName,
						chartType: state.selectedUnlocksChartType,
						colSpan: 1
					}
				]
			}
			const chart = buildNewChart({
				item: state.selectedUnlocksProtocol,
				itemType: 'protocol',
				chartType: 'unlocks',
				idFactory,
				...(protocol?.geckoId === undefined ? {} : { geckoId: protocol.geckoId }),
				dataType: 'documented'
			})
			return chart ? [chart] : []
		}
		case 'advanced-tvl':
			return state.selectedAdvancedTvlProtocol && state.selectedAdvancedTvlProtocolName
				? [
						{
							id: idFactory(
								'advanced-tvl',
								`${state.selectedAdvancedTvlProtocol}-${state.selectedAdvancedTvlChartType}`
							),
							kind: 'advanced-tvl',
							protocol: state.selectedAdvancedTvlProtocol,
							protocolName: state.selectedAdvancedTvlProtocolName,
							chartType: state.selectedAdvancedTvlChartType,
							colSpan: 1
						}
					]
				: []
		case 'borrowed':
			return state.selectedBorrowedProtocol && state.selectedBorrowedProtocolName
				? [
						{
							id: idFactory(
								'advanced-borrowed',
								`${state.selectedBorrowedProtocol}-${state.selectedBorrowedChartType}`
							),
							kind: 'advanced-borrowed',
							protocol: state.selectedBorrowedProtocol,
							protocolName: state.selectedBorrowedProtocolName,
							chartType: state.selectedBorrowedChartType,
							colSpan: 1
						}
					]
				: []
		case 'income-statement':
			return state.selectedIncomeStatementProtocol && state.selectedIncomeStatementProtocolName
				? [
						{
							id: idFactory('income-statement', state.selectedIncomeStatementProtocol),
							kind: 'income-statement',
							protocol: state.selectedIncomeStatementProtocol,
							protocolName: state.selectedIncomeStatementProtocolName,
							colSpan: 2
						}
					]
				: []
		case 'chain':
		case 'protocol':
			return buildNewComparisonItems(input)
		default:
			return state.selectedChartTab satisfies never
	}
}

function buildNewItemsForTab(input: BuildNewDashboardItemsInput): Array<DashboardItemConfig> {
	const { state, idFactory } = input
	switch (state.selectedMainTab) {
		case 'charts':
			if (state.chartMode === 'manual') return buildNewManualChart(input)
			return [
				{
					id: idFactory('builder', ''),
					kind: 'builder',
					...(state.chartBuilderName.trim() ? { name: state.chartBuilderName.trim() } : {}),
					config: state.chartBuilder,
					colSpan: 1
				}
			]
		case 'table':
			return buildDatasetTableSelections(state, null).map((selection) =>
				createDatasetTableConfig({
					...selection,
					id: idFactory('table', getDatasetTableIdentifier(selection)),
					colSpan: 2
				})
			)
		case 'text': {
			const content = state.textContent.trim()
			if (!content) return []
			const title = state.textTitle.trim()
			return [
				{
					id: idFactory('text', ''),
					kind: 'text',
					...(title ? { title } : {}),
					content,
					colSpan: 1
				}
			]
		}
		case 'metric': {
			const subject: MetricSubject | null =
				state.metricSubjectType === 'chain'
					? state.metricChain
						? { itemType: 'chain', chain: state.metricChain }
						: null
					: state.metricProtocol
						? { itemType: 'protocol', protocol: state.metricProtocol }
						: null
			if (!subject) return []
			const metric = createMetricConfig({
				id: idFactory('metric', ''),
				kind: 'metric',
				subject,
				type: state.metricType,
				aggregator: state.metricAggregator,
				window: state.metricWindow,
				compare: { mode: 'previous_value', format: 'percent' },
				chartType: state.metricChartType,
				label: state.metricLabel,
				colSpan: 0.5
			})
			return metric ? [metric] : []
		}
		case 'llamaai':
			return state.selectedLlamaAIChart
				? [
						{
							id: idFactory('llamaai-chart', state.selectedLlamaAIChart.id),
							kind: 'llamaai-chart',
							savedChartId: state.selectedLlamaAIChart.id,
							title: state.selectedLlamaAIChart.title,
							colSpan: 1
						}
					]
				: []
		case 'sql':
			return []
		case 'custom-data': {
			const { customData } = state
			if (!customData.storedRows || customData.columns.length === 0) return []
			const sourceName = customData.sourceName.trim()
			return [
				{
					id: idFactory('custom-data', ''),
					kind: 'custom-data',
					name: customData.name.trim() || 'Custom data',
					...(sourceName ? { sourceName } : {}),
					columns: customData.columns,
					rows: customData.storedRows,
					chart: customData.chart,
					displayMode: customData.displayMode,
					colSpan: CUSTOM_DATA_COL_SPAN
				}
			]
		}
		default:
			return state.selectedMainTab satisfies never
	}
}

export function buildNewDashboardItems(input: BuildNewDashboardItemsInput): Array<DashboardItemConfig> {
	return buildNewItemsForTab(input).map((item) => withModalBindings(item, input.state.bindings))
}

interface BuildEditedDashboardItemInput {
	editItem: DashboardItemConfig
	state: ModalState
	protocols: ReadonlyArray<Protocol>
	chains: ReadonlyArray<Chain>
}

function getEditableGrouping(item: DashboardItemConfig): DashboardGrouping | undefined {
	switch (item.kind) {
		case 'chart':
		case 'multi':
		case 'builder':
			return item.grouping
		default:
			return undefined
	}
}

function hasSameChartSubject(
	item: DashboardItemConfig,
	subject: { subjectType: 'chain'; chain: string } | { subjectType: 'protocol'; protocol: string },
	keepsBinding: boolean
): item is ChartConfig {
	if (item.kind !== 'chart' || item.subjectType !== subject.subjectType) return false
	if (keepsBinding) return true
	return subject.subjectType === 'chain' ? item.chain === subject.chain : item.protocol === subject.protocol
}

function getRetainedChartFields(
	item: DashboardItemConfig,
	subject: { subjectType: 'chain'; chain: string } | { subjectType: 'protocol'; protocol: string },
	chartType: string,
	fallbackGeckoId: string | null | undefined,
	subjectBinding: string | undefined
): Pick<ChartConfig, 'color' | 'dataType' | 'geckoId' | 'grouping' | 'showCumulative'> {
	const keepsBinding =
		subjectBinding !== undefined && item.kind === 'chart' && item.bindings?.subject === subjectBinding
	const previous = hasSameChartSubject(item, subject, keepsBinding) ? item : null
	const chartTypeDetails = isProDashboardChartType(chartType) ? CHART_TYPES[chartType] : null
	const isGroupable = chartTypeDetails && 'groupable' in chartTypeDetails && chartTypeDetails.groupable
	return {
		...(previous?.color === undefined ? {} : { color: previous.color }),
		...(chartType === 'unlocks'
			? { dataType: previous?.type === 'unlocks' ? (previous.dataType ?? 'documented') : 'documented' }
			: {}),
		...(subjectBinding !== undefined
			? {}
			: previous?.geckoId === undefined
				? fallbackGeckoId === undefined
					? {}
					: { geckoId: fallbackGeckoId }
				: { geckoId: previous.geckoId }),
		...(isGroupable ? { grouping: previous?.grouping ?? 'day' } : {}),
		...(previous?.showCumulative === undefined ? {} : { showCumulative: previous.showCumulative })
	}
}

function buildEditedComposerChart(
	layout: DashboardItemLayout & { id: string },
	chart: ChartConfig,
	subjectBinding: string | undefined
): DashboardItemConfig | null {
	const presentation = {
		...(chart.color === undefined ? {} : { color: chart.color }),
		...(chart.grouping === undefined ? {} : { grouping: chart.grouping }),
		...(chart.dataType === undefined ? {} : { dataType: chart.dataType }),
		...(chart.showCumulative === undefined ? {} : { showCumulative: chart.showCumulative }),
		...(subjectBinding !== undefined || chart.geckoId === undefined ? {} : { geckoId: chart.geckoId })
	}
	return chart.subjectType === 'chain'
		? createChartConfig({
				...layout,
				kind: 'chart',
				subjectType: 'chain',
				chain: chart.chain,
				type: chart.type,
				...presentation
			})
		: createChartConfig({
				...layout,
				kind: 'chart',
				subjectType: 'protocol',
				protocol: chart.protocol,
				type: chart.type,
				...presentation
			})
}

function buildEditedManualChart({
	editItem,
	state,
	protocols,
	chains
}: BuildEditedDashboardItemInput): DashboardItemConfig | null {
	const layout = { id: editItem.id, ...getDashboardItemLayout(editItem) }
	const soleComposerChart = state.composerItems.length === 1 ? state.composerItems[0] : undefined
	if (
		(editItem.kind === 'chart' || state.chartCreationMode === 'separate') &&
		(state.selectedChartTab === 'chain' || state.selectedChartTab === 'protocol') &&
		soleComposerChart
	) {
		return buildEditedComposerChart(layout, soleComposerChart, state.bindings.subject)
	}
	if (
		(state.selectedChartTab === 'chain' || state.selectedChartTab === 'protocol') &&
		state.chartCreationMode === 'combined' &&
		state.composerItems.length > 0
	) {
		const grouping = getEditableGrouping(editItem)
		return {
			...layout,
			kind: 'multi',
			...(state.unifiedChartName.trim() ? { name: state.unifiedChartName.trim() } : {}),
			items: state.composerItems,
			...(grouping === undefined ? {} : { grouping }),
			...(editItem.kind !== 'multi' || editItem.showCumulative === undefined
				? {}
				: { showCumulative: editItem.showCumulative }),
			...(editItem.kind !== 'multi' || editItem.showPercentage === undefined
				? {}
				: { showPercentage: editItem.showPercentage }),
			...(editItem.kind !== 'multi' || editItem.showStacked === undefined ? {} : { showStacked: editItem.showStacked }),
			...(editItem.kind !== 'multi' || editItem.showTreemap === undefined ? {} : { showTreemap: editItem.showTreemap })
		}
	}

	switch (state.selectedChartTab) {
		case 'yields':
			if (!state.selectedYieldPool) return null
			return {
				...layout,
				kind: 'yields',
				poolConfigId: state.selectedYieldPool.configID,
				poolName: state.selectedYieldPool.name,
				project: state.selectedYieldPool.project,
				chain: state.selectedYieldPool.chain,
				chartType: normalizeYieldChartType(state.selectedYieldChartType)
			}
		case 'stablecoins':
			return state.stablecoinMode === 'asset' && state.selectedStablecoinAsset && state.selectedStablecoinAssetId
				? {
						...layout,
						kind: 'stablecoin-asset',
						stablecoin: state.selectedStablecoinAsset,
						stablecoinId: state.selectedStablecoinAssetId,
						chartType: state.selectedStablecoinAssetChartType
					}
				: {
						...layout,
						kind: 'stablecoins',
						chain: state.selectedStablecoinChain,
						chartType: state.selectedStablecoinChartType
					}
		case 'rwa':
			return state.rwaMode === 'asset' && state.selectedRwaAssetId && state.selectedRwaAssetName
				? {
						...layout,
						kind: 'rwa-asset',
						assetId: state.selectedRwaAssetId,
						assetName: state.selectedRwaAssetName,
						metrics: state.selectedRwaAssetMetrics
					}
				: {
						...layout,
						kind: 'rwa-overview',
						metric: state.selectedRwaMetric,
						chartView: state.selectedRwaChartView,
						breakdown: state.selectedRwaBreakdown,
						...(state.selectedRwaChain === 'All' ? {} : { chain: state.selectedRwaChain }),
						treemapNestedBy: state.selectedRwaTreemapNestedBy
					}
		case 'unlocks': {
			if (!state.selectedUnlocksProtocol) return null
			const protocol = protocols.find((item) => item.slug === state.selectedUnlocksProtocol)
			const protocolName = state.selectedUnlocksProtocolName || protocol?.name || state.selectedUnlocksProtocol
			if (state.selectedUnlocksChartType === 'schedule') {
				return {
					...layout,
					kind: 'unlocks-schedule',
					protocol: state.selectedUnlocksProtocol,
					protocolName,
					dataType: 'documented'
				}
			}
			if (state.selectedUnlocksChartType === 'allocation' || state.selectedUnlocksChartType === 'locked-unlocked') {
				return {
					...layout,
					kind: 'unlocks-pie',
					protocol: state.selectedUnlocksProtocol,
					protocolName,
					chartType: state.selectedUnlocksChartType
				}
			}
			return createChartConfig({
				...layout,
				kind: 'chart',
				subjectType: 'protocol',
				protocol: state.selectedUnlocksProtocol,
				type: 'unlocks',
				...getRetainedChartFields(
					editItem,
					{ subjectType: 'protocol', protocol: state.selectedUnlocksProtocol },
					'unlocks',
					protocol?.geckoId,
					state.bindings.subject
				)
			})
		}
		case 'advanced-tvl':
			if (!state.selectedAdvancedTvlProtocol || !state.selectedAdvancedTvlProtocolName) return null
			return {
				...layout,
				kind: 'advanced-tvl',
				protocol: state.selectedAdvancedTvlProtocol,
				protocolName: state.selectedAdvancedTvlProtocolName,
				chartType: state.selectedAdvancedTvlChartType
			}
		case 'borrowed':
			if (!state.selectedBorrowedProtocol || !state.selectedBorrowedProtocolName) return null
			return {
				...layout,
				kind: 'advanced-borrowed',
				protocol: state.selectedBorrowedProtocol,
				protocolName: state.selectedBorrowedProtocolName,
				chartType: state.selectedBorrowedChartType
			}
		case 'income-statement':
			if (!state.selectedIncomeStatementProtocol || !state.selectedIncomeStatementProtocolName) return null
			return {
				...layout,
				kind: 'income-statement',
				protocol: state.selectedIncomeStatementProtocol,
				protocolName: state.selectedIncomeStatementProtocolName
			}
		case 'chain': {
			if (!state.selectedChain) return null
			const chain = chains.find((item) => item.name === state.selectedChain)
			const chartType = state.selectedChartTypes[0] || state.selectedChartType
			return createChartConfig({
				...layout,
				kind: 'chart',
				subjectType: 'chain',
				chain: state.selectedChain,
				type: chartType,
				...getRetainedChartFields(
					editItem,
					{ subjectType: 'chain', chain: state.selectedChain },
					chartType,
					isChainTokenChartType(chartType) ? chain?.gecko_id : undefined,
					state.bindings.subject
				)
			})
		}
		case 'protocol': {
			if (!state.selectedProtocol) return null
			const protocol = protocols.find((item) => item.slug === state.selectedProtocol)
			const chartType = state.selectedChartTypes[0] || state.selectedChartType
			return createChartConfig({
				...layout,
				kind: 'chart',
				subjectType: 'protocol',
				protocol: state.selectedProtocol,
				type: chartType,
				...getRetainedChartFields(
					editItem,
					{ subjectType: 'protocol', protocol: state.selectedProtocol },
					chartType,
					protocol?.geckoId,
					state.bindings.subject
				)
			})
		}
		default:
			return state.selectedChartTab satisfies never
	}
}

function buildEditedItemForTab({
	editItem,
	state,
	protocols,
	chains
}: BuildEditedDashboardItemInput): DashboardItemConfig | null {
	const layout = { id: editItem.id, ...getDashboardItemLayout(editItem) }

	switch (state.selectedMainTab) {
		case 'charts':
			if (state.chartMode === 'manual') return buildEditedManualChart({ editItem, state, protocols, chains })
			const grouping = getEditableGrouping(editItem)
			return {
				...layout,
				kind: 'builder',
				...(state.chartBuilderName.trim() ? { name: state.chartBuilderName.trim() } : {}),
				config: state.chartBuilder,
				...(grouping === undefined ? {} : { grouping })
			}
		case 'table': {
			if (state.selectedTableType === 'protocols') return null
			const previous = editItem.kind === 'dataset-table' ? editItem : null
			const selection = buildDatasetTableSelections(state, previous)[0]
			return selection ? createDatasetTableConfig({ ...selection, ...layout }) : null
		}
		case 'text': {
			const content = state.textContent.trim()
			if (!content) return null
			return {
				...layout,
				kind: 'text',
				...(state.textTitle.trim() ? { title: state.textTitle.trim() } : {}),
				content,
				...(editItem.kind !== 'text' || editItem.allowHtml === undefined ? {} : { allowHtml: editItem.allowHtml })
			}
		}
		case 'metric': {
			const metricPresentation: Pick<MetricConfig, 'compare' | 'format'> =
				editItem.kind === 'metric'
					? {
							...(editItem.compare === undefined ? {} : { compare: editItem.compare }),
							...(editItem.format === undefined ? {} : { format: editItem.format })
						}
					: { compare: { mode: 'previous_value', format: 'percent' } }
			const metricLabel = state.metricLabel.trim()
			if (state.metricSubjectType === 'chain') {
				const geckoId =
					state.bindings.subject === undefined &&
					editItem.kind === 'metric' &&
					editItem.subject.itemType === 'chain' &&
					editItem.subject.chain === state.metricChain
						? editItem.subject.geckoId
						: undefined
				return state.metricChain
					? createMetricConfig({
							...layout,
							kind: 'metric',
							subject: {
								itemType: 'chain',
								chain: state.metricChain,
								...(geckoId === undefined ? {} : { geckoId })
							},
							type: state.metricType,
							aggregator: state.metricAggregator,
							window: state.metricWindow,
							...metricPresentation,
							chartType: state.metricChartType,
							...(metricLabel ? { label: metricLabel } : {})
						})
					: null
			}
			const geckoId =
				state.bindings.subject === undefined &&
				editItem.kind === 'metric' &&
				editItem.subject.itemType === 'protocol' &&
				editItem.subject.protocol === state.metricProtocol
					? editItem.subject.geckoId
					: undefined
			return state.metricProtocol
				? createMetricConfig({
						...layout,
						kind: 'metric',
						subject: {
							itemType: 'protocol',
							protocol: state.metricProtocol,
							...(geckoId === undefined ? {} : { geckoId })
						},
						type: state.metricType,
						aggregator: state.metricAggregator,
						window: state.metricWindow,
						...metricPresentation,
						chartType: state.metricChartType,
						...(metricLabel ? { label: metricLabel } : {})
					})
				: null
		}
		case 'llamaai': {
			if (!state.selectedLlamaAIChart?.id) return null
			const retainedLlamaAI =
				editItem.kind === 'llamaai-chart' && editItem.savedChartId === state.selectedLlamaAIChart.id
					? { ...editItem }
					: null
			if (retainedLlamaAI) delete retainedLlamaAI.title
			return {
				...(retainedLlamaAI ?? layout),
				...layout,
				kind: 'llamaai-chart',
				savedChartId: state.selectedLlamaAIChart.id,
				...(state.selectedLlamaAIChart.title ? { title: state.selectedLlamaAIChart.title } : {})
			}
		}
		case 'sql':
			return null
		case 'custom-data': {
			const { customData } = state
			const previous = editItem.kind === 'custom-data' ? editItem : null
			const rows = customData.storedRows ?? previous?.rows ?? null
			if (customData.columns.length === 0 || !rows) return null
			const sourceName = customData.sourceName.trim()
			return {
				...layout,
				kind: 'custom-data',
				name: customData.name.trim() || 'Custom data',
				...(sourceName ? { sourceName } : {}),
				columns: customData.columns,
				rows,
				chart: customData.chart,
				displayMode: customData.displayMode
			}
		}
		default:
			return state.selectedMainTab satisfies never
	}
}

export function buildEditedDashboardItem(input: BuildEditedDashboardItemInput): DashboardItemConfig | null {
	const item = buildEditedItemForTab(input)
	return item ? withModalBindings(item, input.state.bindings) : item
}
