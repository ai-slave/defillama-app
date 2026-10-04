import type { ChartConfig as DownloadChartConfig } from '~/containers/Downloads/sql/chartConfig'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { sanitizeDashboardItemBindings } from '../../dashboardVariables/bindableFields'
import {
	type ChartConfig,
	type CustomDataColumn,
	type DashboardBindableField,
	type DashboardItemBindings,
	isDashboardChartTypeForSubject,
	type MetricAggregator,
	type MetricChartType,
	normalizeYieldChartType,
	type CustomDataRows,
	type SqlSnapshotValue
} from '../../types'
import { DEFAULT_CHART_MODE } from './chartModePreference'
import type {
	ChartBuilderConfig,
	ChartModeType,
	ChartTabType,
	CombinedTableType,
	CustomDataModalState,
	MainTabType,
	ModalState
} from './types'

type SetStateAction<T> = T | ((prev: T) => T)

type ModalAction =
	| { type: 'SET_SELECTED_MAIN_TAB'; payload: MainTabType }
	| { type: 'SET_SELECTED_CHART_TAB'; payload: ChartTabType }
	| { type: 'SET_CHART_MODE'; payload: ChartModeType }
	| { type: 'SET_MANUAL_FORM_OPEN'; payload: boolean }
	| { type: 'SET_COMPOSER_ITEMS'; payload: SetStateAction<Array<ChartConfig>> }
	| { type: 'SET_SELECTED_CHAIN'; payload: string | null }
	| { type: 'SET_SELECTED_CHAINS'; payload: Array<string> }
	| { type: 'SET_SELECTED_PROTOCOL'; payload: string | null }
	| { type: 'SET_SELECTED_PROTOCOLS'; payload: Array<string> }
	| { type: 'SET_SELECTED_CHART_TYPE'; payload: string }
	| { type: 'SET_SELECTED_CHART_TYPES'; payload: Array<string> }
	| { type: 'SET_UNIFIED_CHART_NAME'; payload: string }
	| { type: 'SET_CHART_CREATION_MODE'; payload: 'separate' | 'combined' }
	| { type: 'SET_TEXT_TITLE'; payload: string }
	| { type: 'SET_TEXT_CONTENT'; payload: string }
	| { type: 'SET_SELECTED_TABLE_TYPE'; payload: CombinedTableType | null }
	| { type: 'SET_SELECTED_DATASET_CHAIN'; payload: string | null }
	| { type: 'SET_SELECTED_CEX_ANALYTICS_VIEW'; payload: ModalState['selectedCexAnalyticsView'] }
	| { type: 'SET_SELECTED_CEX_ANALYTICS_METRIC'; payload: ModalState['selectedCexAnalyticsMetric'] }
	| { type: 'SET_SELECTED_CEX_ANALYTICS_TOP_N'; payload: number }
	| { type: 'SET_SELECTED_TOKENS'; payload: Array<string> }
	| { type: 'SET_INCLUDE_CEX'; payload: boolean }
	| { type: 'SET_CHART_BUILDER_NAME'; payload: string }
	| { type: 'SET_CHART_BUILDER'; payload: SetStateAction<ChartBuilderConfig> }
	| { type: 'SET_METRIC_SUBJECT_TYPE'; payload: 'chain' | 'protocol' }
	| { type: 'SET_METRIC_CHAIN'; payload: string | null }
	| { type: 'SET_METRIC_PROTOCOL'; payload: string | null }
	| { type: 'SET_METRIC_TYPE'; payload: string }
	| { type: 'SET_METRIC_AGGREGATOR'; payload: MetricAggregator }
	| { type: 'SET_METRIC_WINDOW'; payload: '7d' | '30d' | '90d' | '365d' | 'ytd' | '3y' | 'all' }
	| { type: 'SET_METRIC_LABEL'; payload: string }
	| { type: 'SET_METRIC_CHART_TYPE'; payload: MetricChartType }
	| {
			type: 'SET_SELECTED_YIELD_POOL'
			payload: { configID: string; name: string; project: string; chain: string } | null
	  }
	| { type: 'SET_SELECTED_YIELD_CHART_TYPE'; payload: ModalState['selectedYieldChartType'] }
	| { type: 'SET_SELECTED_YIELD_CHAINS'; payload: Array<string> }
	| { type: 'SET_SELECTED_YIELD_PROJECTS'; payload: Array<string> }
	| { type: 'SET_SELECTED_YIELD_CATEGORIES'; payload: Array<string> }
	| { type: 'SET_SELECTED_YIELD_TOKENS'; payload: Array<string> }
	| { type: 'SET_MIN_TVL'; payload: number | null }
	| { type: 'SET_MAX_TVL'; payload: number | null }
	| { type: 'SET_SELECTED_STABLECOIN_CHAIN'; payload: string }
	| { type: 'SET_SELECTED_STABLECOIN_CHART_TYPE'; payload: ModalState['selectedStablecoinChartType'] }
	| { type: 'SET_STABLECOIN_MODE'; payload: 'chain' | 'asset' }
	| { type: 'SET_SELECTED_STABLECOIN_ASSET'; payload: string | null }
	| { type: 'SET_SELECTED_STABLECOIN_ASSET_ID'; payload: string | null }
	| { type: 'SET_SELECTED_STABLECOIN_ASSET_CHART_TYPE'; payload: ModalState['selectedStablecoinAssetChartType'] }
	| { type: 'SET_SELECTED_ADVANCED_TVL_PROTOCOL'; payload: string | null }
	| { type: 'SET_SELECTED_ADVANCED_TVL_PROTOCOL_NAME'; payload: string | null }
	| { type: 'SET_SELECTED_ADVANCED_TVL_CHART_TYPE'; payload: ModalState['selectedAdvancedTvlChartType'] }
	| { type: 'SET_SELECTED_BORROWED_PROTOCOL'; payload: string | null }
	| { type: 'SET_SELECTED_BORROWED_PROTOCOL_NAME'; payload: string | null }
	| { type: 'SET_SELECTED_BORROWED_CHART_TYPE'; payload: ModalState['selectedBorrowedChartType'] }
	| { type: 'SET_SELECTED_INCOME_STATEMENT_PROTOCOL'; payload: string | null }
	| { type: 'SET_SELECTED_INCOME_STATEMENT_PROTOCOL_NAME'; payload: string | null }
	| { type: 'SET_SELECTED_LLAMAAI_CHART'; payload: { id: string; title: string } | null }
	| { type: 'SET_SELECTED_UNLOCKS_PROTOCOL'; payload: string | null }
	| { type: 'SET_SELECTED_UNLOCKS_PROTOCOL_NAME'; payload: string | null }
	| { type: 'SET_SELECTED_UNLOCKS_CHART_TYPE'; payload: 'total' | 'schedule' | 'allocation' | 'locked-unlocked' }
	| { type: 'SET_RWA_MODE'; payload: 'overview' | 'asset' }
	| { type: 'SET_SELECTED_RWA_CHAIN'; payload: string }
	| { type: 'SET_SELECTED_RWA_METRIC'; payload: ModalState['selectedRwaMetric'] }
	| { type: 'SET_SELECTED_RWA_CHART_VIEW'; payload: ModalState['selectedRwaChartView'] }
	| { type: 'SET_SELECTED_RWA_BREAKDOWN'; payload: ModalState['selectedRwaBreakdown'] }
	| { type: 'SET_SELECTED_RWA_TREEMAP_NESTED_BY'; payload: string }
	| { type: 'SET_SELECTED_RWA_ASSET_ID'; payload: string | null }
	| { type: 'SET_SELECTED_RWA_ASSET_NAME'; payload: string | null }
	| { type: 'SET_SELECTED_RWA_ASSET_METRICS'; payload: ModalState['selectedRwaAssetMetrics'] }
	| { type: 'SET_ITEM_BINDING'; payload: { field: DashboardBindableField; variableId: string | null } }
	| { type: 'SET_CUSTOM_DATA_NAME'; payload: string }
	| { type: 'SET_CUSTOM_DATA_TEXT'; payload: string }
	| {
			type: 'SET_CUSTOM_DATA_PARSED'
			payload: {
				columns: Array<CustomDataColumn>
				rows: Array<Array<SqlSnapshotValue>>
				chart: DownloadChartConfig
				sourceName: string
			}
	  }
	| { type: 'SET_CUSTOM_DATA_STORED_ROWS'; payload: CustomDataRows | null }
	| { type: 'SET_CUSTOM_DATA_ERROR'; payload: string }
	| { type: 'SET_CUSTOM_DATA_CHART'; payload: Partial<DownloadChartConfig> }
	| { type: 'SET_CUSTOM_DATA_DISPLAY_MODE'; payload: 'chart' | 'table' }
	| { type: 'RESET_STATE' }
	| { type: 'INITIALIZE_FROM_EDIT_ITEM'; payload: { editItem: DashboardItemConfig | null | undefined } }

const CUMULATIVE_METRIC_TYPES = new Set([
	'volume',
	'fees',
	'revenue',
	'perps',
	'aggregators',
	'bridgeAggregators',
	'perpsAggregators',
	'holdersRevenue',
	'optionsPremium',
	'optionsNotional',
	'tokenVolume',
	'txs',
	'activeUsers',
	'newUsers',
	'gasUsed',
	'stablecoinInflows',
	'chainFees',
	'chainRevenue',
	'incentives'
])

function getDefaultAggregator(metricType: string): MetricAggregator {
	return CUMULATIVE_METRIC_TYPES.has(metricType) ? 'sum' : 'latest'
}

const DEFAULT_CHART_BUILDER: ChartBuilderConfig = {
	metric: 'tvl',
	mode: 'chains',
	chainFilterMode: 'include',
	categoryFilterMode: 'include',
	chainCategoryFilterMode: 'include',
	protocolCategoryFilterMode: 'include',
	chains: [],
	chainCategories: [],
	protocolCategories: [],
	categories: [],
	groupBy: 'protocol',
	limit: 10,
	chartType: 'stackedArea',
	treemapValue: 'latest',
	displayAs: 'timeSeries',
	seriesColors: {}
}

const EMPTY_BINDINGS: DashboardItemBindings = {}

const DEFAULT_CUSTOM_DATA_CHART: DownloadChartConfig = {
	chartType: 'bar',
	xCol: null,
	yCols: [],
	splitByCol: null,
	stackMode: 'off',
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto'
}

const INITIAL_CUSTOM_DATA_STATE: CustomDataModalState = {
	name: '',
	sourceName: '',
	csvText: '',
	columns: [],
	previewRows: null,
	storedRows: null,
	chart: DEFAULT_CUSTOM_DATA_CHART,
	displayMode: 'chart',
	error: '',
	isPreparing: false
}

const INITIAL_MODAL_STATE: ModalState = {
	selectedMainTab: 'charts',
	selectedChartTab: 'chain',
	chartMode: DEFAULT_CHART_MODE,
	manualFormOpen: false,
	composerItems: [],
	bindings: EMPTY_BINDINGS,
	customData: INITIAL_CUSTOM_DATA_STATE,
	selectedChain: null,
	selectedChains: [],
	selectedProtocol: null,
	selectedProtocols: [],
	selectedChartType: 'tvl',
	selectedChartTypes: [],
	unifiedChartName: '',
	chartCreationMode: 'combined',
	textTitle: '',
	textContent: '',
	selectedTableType: null,
	selectedDatasetChain: null,
	selectedCexAnalyticsView: 'starter',
	selectedCexAnalyticsMetric: 'derivatives',
	selectedCexAnalyticsTopN: 8,
	selectedTokens: [],
	includeCex: false,
	chartBuilderName: '',
	chartBuilder: DEFAULT_CHART_BUILDER,
	metricSubjectType: 'chain',
	metricChain: null,
	metricProtocol: null,
	metricType: 'tvl',
	metricAggregator: 'latest',
	metricWindow: '30d',
	metricLabel: '',
	metricChartType: 'sparkline',
	selectedYieldPool: null,
	selectedYieldChartType: 'tvl-apy',
	selectedYieldChains: [],
	selectedYieldProjects: [],
	selectedYieldCategories: [],
	selectedYieldTokens: [],
	minTvl: null,
	maxTvl: null,
	selectedStablecoinChain: 'All',
	selectedStablecoinChartType: 'totalMcap',
	stablecoinMode: 'chain',
	selectedStablecoinAsset: null,
	selectedStablecoinAssetId: null,
	selectedStablecoinAssetChartType: 'totalCirc',
	selectedAdvancedTvlProtocol: null,
	selectedAdvancedTvlProtocolName: null,
	selectedAdvancedTvlChartType: 'tvl',
	selectedBorrowedProtocol: null,
	selectedBorrowedProtocolName: null,
	selectedBorrowedChartType: 'chainsBorrowed',
	selectedIncomeStatementProtocol: null,
	selectedIncomeStatementProtocolName: null,
	selectedLlamaAIChart: null,
	selectedUnlocksProtocol: null,
	selectedUnlocksProtocolName: null,
	selectedUnlocksChartType: 'total',
	rwaMode: 'overview',
	selectedRwaChain: 'All',
	selectedRwaMetric: 'activeMcap',
	selectedRwaChartView: 'timeSeries',
	selectedRwaBreakdown: 'chain',
	selectedRwaTreemapNestedBy: 'none',
	selectedRwaAssetId: null,
	selectedRwaAssetName: null,
	selectedRwaAssetMetrics: ['activeMcap', 'onChainMcap', 'defiActiveTvl']
}

export function initializeFromEditItem(
	editItem: DashboardItemConfig | null | undefined,
	preferredChartMode = DEFAULT_CHART_MODE
): ModalState {
	return withDefaultChartTypes(stateFromEditItem(editItem, preferredChartMode))
}

// The open manual chain or protocol form always has a chart type picked: the type of the first composer item
// for that subject, else the first composer item's, else tvl. Applied after every action, so a multi-chart edit,
// a return to the charts tab or a switch back to manual mode starts with one picked.
function withDefaultChartTypes(state: ModalState): ModalState {
	if (!state.manualFormOpen || state.selectedMainTab !== 'charts' || state.chartMode !== 'manual') return state
	if (state.selectedChartTab !== 'chain' && state.selectedChartTab !== 'protocol') return state
	if (state.selectedChartTypes.length > 0) return state
	const item = state.composerItems.find((i) => i.subjectType === state.selectedChartTab) ?? state.composerItems[0]
	return { ...state, selectedChartTypes: [item?.type ?? 'tvl'] }
}

function stateFromEditItem(
	editItem: DashboardItemConfig | null | undefined,
	preferredChartMode: ChartModeType
): ModalState {
	if (!editItem) {
		return {
			...INITIAL_MODAL_STATE,
			chartMode: preferredChartMode,
			composerItems: [],
			bindings: EMPTY_BINDINGS,
			customData: { ...INITIAL_CUSTOM_DATA_STATE, columns: [] },
			selectedChains: [],
			selectedProtocols: [],
			selectedChartTypes: [],
			selectedTokens: [],
			selectedYieldChains: [],
			selectedYieldProjects: [],
			selectedYieldCategories: [],
			selectedYieldTokens: [],
			chartBuilder: {
				...DEFAULT_CHART_BUILDER,
				chains: [],
				chainCategories: [],
				protocolCategories: [],
				categories: []
			}
		}
	}

	const base: ModalState = {
		...INITIAL_MODAL_STATE,
		manualFormOpen: true,
		composerItems: [],
		bindings: sanitizeDashboardItemBindings(editItem, 'bindings' in editItem ? editItem.bindings : undefined) ?? {},
		customData: { ...INITIAL_CUSTOM_DATA_STATE, columns: [] },
		selectedChains: [],
		selectedProtocols: [],
		selectedChartTypes: [],
		selectedTokens: [],
		selectedYieldChains: [],
		selectedYieldProjects: [],
		selectedYieldCategories: [],
		selectedYieldTokens: [],
		chartBuilder: { ...DEFAULT_CHART_BUILDER, chains: [], chainCategories: [], protocolCategories: [], categories: [] }
	}

	if (editItem.kind === 'chart') {
		if (editItem.type === 'unlocks' && editItem.subjectType === 'protocol') {
			return {
				...base,
				selectedMainTab: 'charts',
				chartMode: 'manual',
				selectedChartTab: 'unlocks',
				selectedUnlocksProtocol: editItem.protocol,
				selectedUnlocksProtocolName: editItem.protocol,
				selectedUnlocksChartType: 'total'
			}
		}
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: editItem.subjectType,
			composerItems: [editItem],
			selectedChain: editItem.subjectType === 'chain' ? editItem.chain : null,
			selectedProtocol: editItem.subjectType === 'protocol' ? editItem.protocol : null,
			selectedChartType: editItem.type,
			selectedChartTypes: [editItem.type],
			chartCreationMode: 'separate',
			unifiedChartName: ''
		}
	}

	if (editItem.kind === 'multi') {
		const firstItem = editItem.items[0]
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			composerItems: editItem.items,
			unifiedChartName: editItem.name || '',
			chartCreationMode: 'combined',
			selectedChartTab: firstItem?.subjectType ?? 'chain',
			selectedChartTypes: [],
			selectedProtocol: firstItem?.subjectType === 'protocol' ? firstItem.protocol : null,
			selectedChain: firstItem?.subjectType === 'chain' ? firstItem.chain : null
		}
	}

	if (editItem.kind === 'dataset-table') {
		const cexConfig = editItem.datasetType === 'cex-analytics' ? editItem : undefined
		const tokenUsageConfig = editItem.datasetType === 'token-usage' ? editItem : undefined
		const datasetChain =
			editItem.datasetType === 'stablecoins' || editItem.datasetType === 'rwa-selected-chain'
				? editItem.chain
				: editItem.datasetType === 'chains'
					? editItem.category
					: editItem.datasetType === 'equities-financials' || editItem.datasetType === 'equities-filings'
						? editItem.ticker
						: undefined
		return {
			...base,
			selectedMainTab: 'table',
			selectedChains: 'chains' in editItem ? editItem.chains : [],
			selectedTableType: editItem.datasetType,
			selectedDatasetChain: datasetChain ?? null,
			selectedCexAnalyticsView: cexConfig?.cexAnalyticsView ?? 'comparison',
			selectedCexAnalyticsMetric:
				cexConfig?.cexAnalyticsView === 'market-share' ? cexConfig.cexAnalyticsMetric : 'derivatives',
			selectedCexAnalyticsTopN: cexConfig?.cexAnalyticsView === 'market-share' ? cexConfig.cexAnalyticsTopN : 8,
			selectedTokens: tokenUsageConfig?.tokenSymbols ?? [],
			includeCex: tokenUsageConfig?.includeCex ?? false
		}
	}

	if (editItem.kind === 'unified-table') {
		return { ...base, selectedMainTab: 'table', selectedTableType: 'protocols' }
	}

	if (editItem.kind === 'text') {
		return {
			...base,
			selectedMainTab: 'text',
			textTitle: editItem.title || '',
			textContent: editItem.content
		}
	}

	if (editItem.kind === 'builder') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'builder',
			chartBuilderName: editItem.name || '',
			chartBuilder: {
				...editItem.config,
				protocolCategories: editItem.config.protocolCategories || [],
				seriesColors: editItem.config.seriesColors || {},
				treemapValue: editItem.config.treemapValue || 'latest'
			}
		}
	}

	if (editItem.kind === 'metric') {
		return {
			...base,
			selectedMainTab: 'metric',
			metricSubjectType: editItem.subject.itemType,
			metricChain: editItem.subject.chain || null,
			metricProtocol: editItem.subject.protocol || null,
			metricType: editItem.type,
			metricAggregator: editItem.aggregator,
			metricWindow: editItem.window,
			metricLabel: editItem.label || '',
			metricChartType: editItem.chartType
		}
	}

	if (editItem.kind === 'yields') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'yields',
			selectedYieldPool: {
				configID: editItem.poolConfigId,
				name: editItem.poolName,
				project: editItem.project,
				chain: editItem.chain
			},
			selectedYieldChartType: normalizeYieldChartType(editItem.chartType)
		}
	}

	if (editItem.kind === 'stablecoins') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'stablecoins',
			stablecoinMode: 'chain',
			selectedStablecoinChain: editItem.chain,
			selectedStablecoinChartType: editItem.chartType
		}
	}

	if (editItem.kind === 'stablecoin-asset') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'stablecoins',
			stablecoinMode: 'asset',
			selectedStablecoinAsset: editItem.stablecoin,
			selectedStablecoinAssetId: editItem.stablecoinId,
			selectedStablecoinAssetChartType: editItem.chartType
		}
	}

	if (editItem.kind === 'advanced-tvl') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'advanced-tvl',
			selectedAdvancedTvlProtocol: editItem.protocol,
			selectedAdvancedTvlProtocolName: editItem.protocolName,
			selectedAdvancedTvlChartType: editItem.chartType
		}
	}

	if (editItem.kind === 'advanced-borrowed') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'borrowed',
			selectedBorrowedProtocol: editItem.protocol,
			selectedBorrowedProtocolName: editItem.protocolName,
			selectedBorrowedChartType: editItem.chartType
		}
	}

	if (editItem.kind === 'income-statement') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'income-statement',
			selectedIncomeStatementProtocol: editItem.protocol,
			selectedIncomeStatementProtocolName: editItem.protocolName
		}
	}

	if (editItem.kind === 'unlocks-schedule') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'unlocks',
			selectedUnlocksProtocol: editItem.protocol,
			selectedUnlocksProtocolName: editItem.protocolName,
			selectedUnlocksChartType: 'schedule'
		}
	}

	if (editItem.kind === 'unlocks-pie') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'unlocks',
			selectedUnlocksProtocol: editItem.protocol,
			selectedUnlocksProtocolName: editItem.protocolName,
			selectedUnlocksChartType: editItem.chartType
		}
	}

	if (editItem.kind === 'custom-data') {
		return {
			...base,
			selectedMainTab: 'custom-data',
			customData: {
				...INITIAL_CUSTOM_DATA_STATE,
				name: editItem.name,
				sourceName: editItem.sourceName ?? '',
				columns: editItem.columns,
				storedRows: editItem.rows ?? null,
				chart: editItem.chart,
				displayMode: editItem.displayMode
			}
		}
	}

	if (editItem.kind === 'llamaai-chart') {
		return {
			...base,
			selectedMainTab: 'llamaai',
			selectedLlamaAIChart: editItem.savedChartId ? { id: editItem.savedChartId, title: editItem.title || '' } : null
		}
	}

	if (editItem.kind === 'rwa-overview') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'rwa',
			rwaMode: 'overview',
			selectedRwaChain: editItem.chain || 'All',
			selectedRwaMetric: editItem.metric,
			selectedRwaChartView: editItem.chartView,
			selectedRwaBreakdown: editItem.breakdown,
			selectedRwaTreemapNestedBy: editItem.treemapNestedBy || 'none'
		}
	}

	if (editItem.kind === 'rwa-asset') {
		return {
			...base,
			selectedMainTab: 'charts',
			chartMode: 'manual',
			selectedChartTab: 'rwa',
			rwaMode: 'asset',
			selectedRwaAssetId: editItem.assetId,
			selectedRwaAssetName: editItem.assetName,
			selectedRwaAssetMetrics: editItem.metrics
		}
	}

	return base
}

function clearItemBinding(state: ModalState, field: DashboardBindableField): ModalState {
	if (state.bindings[field] === undefined) return state
	const bindings: DashboardItemBindings = { ...state.bindings }
	delete bindings[field]
	return { ...state, bindings }
}

// Moving between tabs, chart modes and categories, and the chart types a category seeds on entry, change these fields
// without the reader entering anything. A picked table type is not here: for most table types the type is the card.
// The protocols table's grouping, filters and columns live in its wizard, which Add card compares on its own.
const NAVIGATION_FIELDS = new Set<keyof ModalState>([
	'selectedMainTab',
	'selectedChartTab',
	'chartMode',
	'manualFormOpen',
	'selectedChartType',
	'selectedChartTypes',
	// Like a chart category, a table type is one click to pick again; what is set up inside it is the draft.
	'selectedTableType'
])

/** Whether leaving would lose something the reader entered since the dialog opened, in any tab. */
export function hasDraftChanges(state: ModalState, opened: ModalState): boolean {
	let key: keyof ModalState
	for (key in state) {
		if (NAVIGATION_FIELDS.has(key) || state[key] === opened[key]) continue
		// Reducers rebuild arrays and objects, so compare what they hold.
		if (JSON.stringify(state[key]) !== JSON.stringify(opened[key])) return true
	}
	return false
}

export function modalReducer(state: ModalState, action: ModalAction): ModalState {
	return withDefaultChartTypes(reduceModalAction(state, action))
}

function reduceModalAction(state: ModalState, action: ModalAction): ModalState {
	switch (action.type) {
		case 'SET_SELECTED_MAIN_TAB':
			if (action.payload === state.selectedMainTab) return state
			return { ...state, selectedMainTab: action.payload, bindings: {} }

		case 'SET_MANUAL_FORM_OPEN':
			if (action.payload === state.manualFormOpen) return state
			return { ...state, manualFormOpen: action.payload }

		case 'SET_SELECTED_CHART_TAB': {
			if (action.payload !== 'chain' && action.payload !== 'protocol')
				return { ...state, selectedChartTab: action.payload }
			const selectedChartTypes = resolveChartTypesForSubjectTab(action.payload, state.selectedChartTypes)
			return {
				...state,
				selectedChartTab: action.payload,
				selectedChartTypes,
				selectedChartType: selectedChartTypes[0]
			}
		}

		case 'SET_CHART_MODE':
			return { ...state, chartMode: action.payload }

		case 'SET_COMPOSER_ITEMS':
			return {
				...state,
				composerItems: typeof action.payload === 'function' ? action.payload(state.composerItems) : action.payload
			}

		case 'SET_SELECTED_CHAIN':
			if (action.payload === state.selectedChain) return state
			return { ...clearItemBinding(state, 'subject'), selectedChain: action.payload }

		case 'SET_SELECTED_CHAINS':
			return { ...state, selectedChains: action.payload }

		case 'SET_SELECTED_PROTOCOL':
			if (action.payload === state.selectedProtocol) return state
			return { ...clearItemBinding(state, 'subject'), selectedProtocol: action.payload }

		case 'SET_SELECTED_PROTOCOLS':
			return { ...state, selectedProtocols: action.payload }

		case 'SET_SELECTED_CHART_TYPE':
			return { ...state, selectedChartType: action.payload }

		case 'SET_SELECTED_CHART_TYPES':
			return { ...state, selectedChartTypes: action.payload }

		case 'SET_UNIFIED_CHART_NAME':
			return { ...state, unifiedChartName: action.payload }

		case 'SET_CHART_CREATION_MODE':
			return { ...state, chartCreationMode: action.payload }

		case 'SET_TEXT_TITLE':
			return { ...state, textTitle: action.payload }

		case 'SET_TEXT_CONTENT':
			return { ...state, textContent: action.payload }

		case 'SET_SELECTED_TABLE_TYPE':
			return { ...state, selectedTableType: action.payload }

		case 'SET_SELECTED_DATASET_CHAIN':
			return { ...state, selectedDatasetChain: action.payload }

		case 'SET_SELECTED_CEX_ANALYTICS_VIEW':
			return { ...state, selectedCexAnalyticsView: action.payload }

		case 'SET_SELECTED_CEX_ANALYTICS_METRIC':
			return { ...state, selectedCexAnalyticsMetric: action.payload }

		case 'SET_SELECTED_CEX_ANALYTICS_TOP_N':
			return { ...state, selectedCexAnalyticsTopN: action.payload }

		case 'SET_SELECTED_TOKENS':
			return { ...state, selectedTokens: action.payload }

		case 'SET_INCLUDE_CEX':
			return { ...state, includeCex: action.payload }

		case 'SET_CHART_BUILDER_NAME':
			return { ...state, chartBuilderName: action.payload }

		case 'SET_CHART_BUILDER':
			return {
				...state,
				chartBuilder: typeof action.payload === 'function' ? action.payload(state.chartBuilder) : action.payload
			}

		case 'SET_METRIC_SUBJECT_TYPE':
			if (action.payload === state.metricSubjectType) return state
			return { ...clearItemBinding(state, 'subject'), metricSubjectType: action.payload }

		case 'SET_METRIC_CHAIN':
			if (action.payload === state.metricChain) return state
			return { ...clearItemBinding(state, 'subject'), metricChain: action.payload }

		case 'SET_METRIC_PROTOCOL':
			if (action.payload === state.metricProtocol) return state
			return { ...clearItemBinding(state, 'subject'), metricProtocol: action.payload }

		case 'SET_METRIC_TYPE':
			return {
				...state,
				metricType: action.payload,
				metricAggregator: getDefaultAggregator(action.payload)
			}

		case 'SET_METRIC_AGGREGATOR':
			return { ...state, metricAggregator: action.payload }

		case 'SET_METRIC_WINDOW':
			return { ...state, metricWindow: action.payload }

		case 'SET_METRIC_LABEL':
			return { ...state, metricLabel: action.payload }

		case 'SET_METRIC_CHART_TYPE':
			return { ...state, metricChartType: action.payload }

		case 'SET_SELECTED_YIELD_POOL':
			// Chart types depend on the pool's data, so another pool starts on the one every pool has.
			return action.payload?.configID === state.selectedYieldPool?.configID
				? { ...state, selectedYieldPool: action.payload }
				: { ...state, selectedYieldPool: action.payload, selectedYieldChartType: 'tvl-apy' }

		case 'SET_SELECTED_YIELD_CHART_TYPE':
			return { ...state, selectedYieldChartType: action.payload }

		case 'SET_SELECTED_YIELD_CHAINS':
			return { ...state, selectedYieldChains: action.payload }

		case 'SET_SELECTED_YIELD_PROJECTS':
			return { ...state, selectedYieldProjects: action.payload }

		case 'SET_SELECTED_YIELD_CATEGORIES':
			return { ...state, selectedYieldCategories: action.payload }

		case 'SET_SELECTED_YIELD_TOKENS':
			return { ...state, selectedYieldTokens: action.payload }

		case 'SET_MIN_TVL':
			return { ...state, minTvl: action.payload }

		case 'SET_MAX_TVL':
			return { ...state, maxTvl: action.payload }

		case 'SET_SELECTED_STABLECOIN_CHAIN':
			if (action.payload === state.selectedStablecoinChain) return state
			return { ...clearItemBinding(state, 'chain'), selectedStablecoinChain: action.payload }

		case 'SET_SELECTED_STABLECOIN_CHART_TYPE':
			return { ...state, selectedStablecoinChartType: action.payload }

		case 'SET_STABLECOIN_MODE':
			return { ...state, stablecoinMode: action.payload }

		case 'SET_SELECTED_STABLECOIN_ASSET':
			return { ...state, selectedStablecoinAsset: action.payload }

		case 'SET_SELECTED_STABLECOIN_ASSET_ID':
			return { ...state, selectedStablecoinAssetId: action.payload }

		case 'SET_SELECTED_STABLECOIN_ASSET_CHART_TYPE':
			return { ...state, selectedStablecoinAssetChartType: action.payload }

		case 'SET_SELECTED_ADVANCED_TVL_PROTOCOL':
			if (action.payload === state.selectedAdvancedTvlProtocol) return state
			return { ...clearItemBinding(state, 'protocol'), selectedAdvancedTvlProtocol: action.payload }

		case 'SET_SELECTED_ADVANCED_TVL_PROTOCOL_NAME':
			return { ...state, selectedAdvancedTvlProtocolName: action.payload }

		case 'SET_SELECTED_ADVANCED_TVL_CHART_TYPE':
			return { ...state, selectedAdvancedTvlChartType: action.payload }

		case 'SET_SELECTED_BORROWED_PROTOCOL':
			if (action.payload === state.selectedBorrowedProtocol) return state
			return { ...clearItemBinding(state, 'protocol'), selectedBorrowedProtocol: action.payload }

		case 'SET_SELECTED_BORROWED_PROTOCOL_NAME':
			return { ...state, selectedBorrowedProtocolName: action.payload }

		case 'SET_SELECTED_BORROWED_CHART_TYPE':
			return { ...state, selectedBorrowedChartType: action.payload }

		case 'SET_SELECTED_INCOME_STATEMENT_PROTOCOL':
			if (action.payload === state.selectedIncomeStatementProtocol) return state
			return { ...clearItemBinding(state, 'protocol'), selectedIncomeStatementProtocol: action.payload }

		case 'SET_SELECTED_INCOME_STATEMENT_PROTOCOL_NAME':
			return { ...state, selectedIncomeStatementProtocolName: action.payload }

		case 'SET_SELECTED_LLAMAAI_CHART':
			return { ...state, selectedLlamaAIChart: action.payload }

		case 'SET_SELECTED_UNLOCKS_PROTOCOL':
			if (action.payload === state.selectedUnlocksProtocol) return state
			return { ...clearItemBinding(state, 'protocol'), selectedUnlocksProtocol: action.payload }

		case 'SET_SELECTED_UNLOCKS_PROTOCOL_NAME':
			return { ...state, selectedUnlocksProtocolName: action.payload }

		case 'SET_SELECTED_UNLOCKS_CHART_TYPE':
			return { ...state, selectedUnlocksChartType: action.payload }

		case 'SET_RWA_MODE':
			return { ...state, rwaMode: action.payload }

		case 'SET_SELECTED_RWA_CHAIN':
			return { ...state, selectedRwaChain: action.payload }

		case 'SET_SELECTED_RWA_METRIC':
			return { ...state, selectedRwaMetric: action.payload }

		case 'SET_SELECTED_RWA_CHART_VIEW':
			return { ...state, selectedRwaChartView: action.payload }

		case 'SET_SELECTED_RWA_BREAKDOWN':
			return { ...state, selectedRwaBreakdown: action.payload }

		case 'SET_SELECTED_RWA_TREEMAP_NESTED_BY':
			return { ...state, selectedRwaTreemapNestedBy: action.payload }

		case 'SET_SELECTED_RWA_ASSET_ID':
			return { ...state, selectedRwaAssetId: action.payload }

		case 'SET_SELECTED_RWA_ASSET_NAME':
			return { ...state, selectedRwaAssetName: action.payload }

		case 'SET_SELECTED_RWA_ASSET_METRICS':
			return { ...state, selectedRwaAssetMetrics: action.payload }

		case 'SET_ITEM_BINDING': {
			const { field, variableId } = action.payload
			if ((state.bindings[field] ?? null) === variableId) return state
			const bindings: DashboardItemBindings = { ...state.bindings }
			if (variableId) bindings[field] = variableId
			else delete bindings[field]
			return { ...state, bindings }
		}

		case 'SET_CUSTOM_DATA_NAME':
			return { ...state, customData: { ...state.customData, name: action.payload } }

		case 'SET_CUSTOM_DATA_TEXT':
			return {
				...state,
				customData: {
					...state.customData,
					csvText: action.payload,
					// The shown rows stay until the next parse replaces them; an emptied box shows none.
					previewRows: action.payload.trim() ? state.customData.previewRows : null,
					error: '',
					isPreparing: action.payload.trim().length > 0
				}
			}

		case 'SET_CUSTOM_DATA_PARSED':
			return {
				...state,
				customData: {
					...state.customData,
					columns: action.payload.columns,
					previewRows: action.payload.rows,
					storedRows: null,
					chart: action.payload.chart,
					sourceName: action.payload.sourceName,
					error: '',
					isPreparing: true
				}
			}

		case 'SET_CUSTOM_DATA_STORED_ROWS':
			return { ...state, customData: { ...state.customData, storedRows: action.payload, isPreparing: false } }

		case 'SET_CUSTOM_DATA_ERROR':
			return { ...state, customData: { ...state.customData, error: action.payload, isPreparing: false } }

		case 'SET_CUSTOM_DATA_CHART':
			return { ...state, customData: { ...state.customData, chart: { ...state.customData.chart, ...action.payload } } }

		case 'SET_CUSTOM_DATA_DISPLAY_MODE':
			return { ...state, customData: { ...state.customData, displayMode: action.payload } }

		case 'RESET_STATE':
			return initializeFromEditItem(null, state.chartMode)

		case 'INITIALIZE_FROM_EDIT_ITEM':
			return initializeFromEditItem(action.payload.editItem, state.chartMode)

		default:
			return state
	}
}

export function resolveChartTypesForSubjectTab(
	subjectType: 'chain' | 'protocol',
	selectedChartTypes: Array<string>
): [string] {
	const current = selectedChartTypes[0]
	return [current && isDashboardChartTypeForSubject(subjectType, current) ? current : 'tvl']
}
