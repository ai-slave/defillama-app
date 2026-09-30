import { createChartConfig, createMetricConfig } from './dashboardConfig/classicChartConfig'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { DashboardVariable } from './dashboardTypes'
import {
	getProDashboardChartTypeConfig,
	type AdvancedTvlChartConfig,
	type Chain,
	type ChainChartType,
	type ChartConfig,
	type IncomeStatementConfig,
	type MetricConfig,
	type MultiChartConfig,
	type ProDashboardChartType,
	type Protocol,
	type ProtocolChartType,
	type StablecoinsChartConfig,
	type UnlocksScheduleConfig
} from './types'
import { UNIFIED_TABLE_CONFIG_VERSION, type UnifiedTableConfig } from './unifiedTable/config/current'
import { generateItemId } from './utils/dashboardUtils'

interface DashboardTemplateBase {
	id: string
	name: string
	description: string
}

export interface ComparisonDashboardTemplate extends DashboardTemplateBase {
	parameterized?: false
	variables?: never
	type: 'chains' | 'protocols'
	metrics: Array<ProDashboardChartType>
	filter: {
		category?: string
		metadataFlag?: keyof DimensionProtocols
		chainNames?: Array<string>
		chainCategory?: string
		excludeChainCategory?: string
	}
	count: number
	displayMode?: 'default' | 'stacked'
	grouping?: 'day' | 'week' | 'month'
}

export interface ParameterizedDashboardTemplate extends DashboardTemplateBase {
	parameterized: true
	variables: Array<DashboardVariable>
	createItems: () => Array<DashboardItemConfig>
}

export type DashboardTemplate = ComparisonDashboardTemplate | ParameterizedDashboardTemplate

export interface GeneratedTemplate {
	items: Array<DashboardItemConfig>
	variables: Array<DashboardVariable>
}

const CHAIN_OVERVIEW_CHAIN = 'Ethereum'
const CHAIN_OVERVIEW_METRIC_TYPES: Array<ChainChartType> = ['tvl', 'volume', 'fees', 'activeUsers']
const CHAIN_OVERVIEW_CHART_TYPES: Array<ChainChartType> = ['tvl', 'fees']
const CHAIN_OVERVIEW_TABLE_COLUMNS = ['name', 'category', 'tvl', 'change7d', 'fees24h', 'revenue24h', 'volume24h']

const PROTOCOL_DEEP_DIVE_PROTOCOL = { slug: 'aave', name: 'Aave' }
const PROTOCOL_DEEP_DIVE_CHART_TYPES: Array<ProtocolChartType> = ['tvl', 'fees', 'revenue']

function createChainOverviewItems(): Array<DashboardItemConfig> {
	const chain = CHAIN_OVERVIEW_CHAIN
	const metrics: Array<MetricConfig> = []
	for (const type of CHAIN_OVERVIEW_METRIC_TYPES) {
		const metric = createMetricConfig({
			id: generateItemId('metric', `chain-overview-${type}`),
			kind: 'metric',
			subject: { itemType: 'chain', chain },
			type,
			aggregator: 'latest',
			window: '30d',
			compare: { mode: 'previous_window', format: 'percent' },
			chartType: 'sparkline',
			colSpan: 0.5,
			bindings: { subject: 'chain' }
		})
		if (metric) metrics.push(metric)
	}
	const charts: Array<ChartConfig> = []
	for (const type of CHAIN_OVERVIEW_CHART_TYPES) {
		const chart = createChartConfig({
			id: generateItemId('chart', `chain-overview-${type}`),
			kind: 'chart',
			subjectType: 'chain',
			chain,
			type,
			colSpan: 1,
			bindings: { subject: 'chain' }
		})
		if (chart) charts.push(chart)
	}
	const stablecoins: StablecoinsChartConfig = {
		id: generateItemId('stablecoins', 'chain-overview'),
		kind: 'stablecoins',
		chain,
		chartType: 'totalMcap',
		colSpan: 2,
		bindings: { chain: 'chain' }
	}
	const columnVisibility: Record<string, boolean> = {}
	for (const column of CHAIN_OVERVIEW_TABLE_COLUMNS) columnVisibility[column] = true
	const table: UnifiedTableConfig = {
		id: generateItemId('unified-table', 'chain-overview'),
		kind: 'unified-table',
		configVersion: UNIFIED_TABLE_CONFIG_VERSION,
		strategy: 'protocols',
		rowHeaders: ['protocol'],
		params: { chains: [chain] },
		columnOrder: CHAIN_OVERVIEW_TABLE_COLUMNS,
		columnVisibility,
		defaultSorting: [{ id: 'tvl', desc: true }],
		colSpan: 2,
		bindings: { chains: 'chain' }
	}
	return [...metrics, ...charts, stablecoins, table]
}

function createProtocolDeepDiveItems(): Array<DashboardItemConfig> {
	const { slug: protocol, name: protocolName } = PROTOCOL_DEEP_DIVE_PROTOCOL
	const charts: Array<ChartConfig> = []
	for (const type of PROTOCOL_DEEP_DIVE_CHART_TYPES) {
		const chart = createChartConfig({
			id: generateItemId('chart', `protocol-deep-dive-${type}`),
			kind: 'chart',
			subjectType: 'protocol',
			protocol,
			type,
			colSpan: 1,
			bindings: { subject: 'protocol' }
		})
		if (chart) charts.push(chart)
	}
	const incomeStatement: IncomeStatementConfig = {
		id: generateItemId('income-statement', 'protocol-deep-dive'),
		kind: 'income-statement',
		protocol,
		protocolName,
		colSpan: 1,
		bindings: { protocol: 'protocol' }
	}
	const advancedTvl: AdvancedTvlChartConfig = {
		id: generateItemId('advanced-tvl', 'protocol-deep-dive'),
		kind: 'advanced-tvl',
		protocol,
		protocolName,
		chartType: 'tvl',
		colSpan: 1,
		bindings: { protocol: 'protocol' }
	}
	const unlocks: UnlocksScheduleConfig = {
		id: generateItemId('unlocks-schedule', 'protocol-deep-dive'),
		kind: 'unlocks-schedule',
		protocol,
		protocolName,
		dataType: 'documented',
		colSpan: 1,
		bindings: { protocol: 'protocol' }
	}
	return [...charts, incomeStatement, advancedTvl, unlocks]
}

export const DASHBOARD_TEMPLATES: Array<DashboardTemplate> = [
	{
		id: 'chain-overview',
		name: 'Chain overview',
		description: 'TVL, volume, fees, users and stablecoins for one chain you can switch from the dashboard',
		parameterized: true,
		variables: [{ id: 'chain', kind: 'chain', label: 'Chain', value: CHAIN_OVERVIEW_CHAIN }],
		createItems: createChainOverviewItems
	},
	{
		id: 'protocol-deep-dive',
		name: 'Protocol deep dive',
		description: 'TVL, fees, revenue, income statement and unlocks for one protocol you can switch from the dashboard',
		parameterized: true,
		variables: [{ id: 'protocol', kind: 'protocol', label: 'Protocol', value: PROTOCOL_DEEP_DIVE_PROTOCOL.slug }],
		createItems: createProtocolDeepDiveItems
	},
	{
		id: 'top-l1-chains',
		name: 'Top L1 chains',
		description: 'Compare top Layer 1 blockchains by TVL',
		type: 'chains',
		metrics: ['tvl', 'volume', 'fees', 'revenue', 'stablecoins', 'bridgedTvl'],
		filter: {
			excludeChainCategory: 'Rollup'
		},
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'l2-ecosystem',
		name: 'L2 ecosystem',
		description: 'Compare Layer 2 rollups and scaling solutions',
		type: 'chains',
		metrics: ['tvl', 'volume', 'fees', 'revenue', 'stablecoins', 'bridgedTvl'],
		filter: {
			chainCategory: 'Rollup'
		},
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'dex-leaders',
		name: 'DEX leaders',
		description: 'Compare top decentralized exchanges by volume',
		type: 'protocols',
		metrics: ['volume', 'fees', 'revenue', 'tvl'],
		filter: { metadataFlag: 'dexs' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'lending-protocols',
		name: 'Lending protocols',
		description: 'Compare top lending and borrowing platforms',
		type: 'protocols',
		metrics: ['tvl', 'fees', 'revenue'],
		filter: { category: 'Lending' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'liquid-staking',
		name: 'Liquid Staking',
		description: 'Compare liquid staking derivatives protocols',
		type: 'protocols',
		metrics: ['tvl', 'fees', 'revenue'],
		filter: { category: 'Liquid Staking' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'perps-protocols',
		name: 'Perps protocols',
		description: 'Compare perpetual futures trading platforms',
		type: 'protocols',
		metrics: ['perps', 'openInterest', 'fees', 'revenue'],
		filter: { metadataFlag: 'perps' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'prediction-market-protocols',
		name: 'Prediction Markets',
		description: 'Compare top prediction market protocols',
		type: 'protocols',
		metrics: ['tvl', 'fees', 'revenue'],
		filter: { category: 'Prediction Market' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'yield-farming-protocols',
		name: 'Yield protocols',
		description: 'Compare top yield farming and optimization protocols',
		type: 'protocols',
		metrics: ['tvl', 'fees', 'revenue'],
		filter: { category: 'Yield' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'risk-curators-protocols',
		name: 'Risk Curators',
		description: 'Compare top risk curator and vault management protocols',
		type: 'protocols',
		metrics: ['tvl', 'fees', 'revenue'],
		filter: { category: 'Risk Curators' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	},
	{
		id: 'dex-aggregators',
		name: 'DEX Aggregators',
		description: 'Compare DEX aggregator protocols by volume',
		type: 'protocols',
		metrics: ['aggregators', 'fees', 'revenue'],
		filter: { metadataFlag: 'dexAggregators' },
		count: 4,
		displayMode: 'stacked',
		grouping: 'week'
	}
]

const TEMPLATE_TABLE_COLUMNS: Record<string, { columns: Array<string>; sortBy: string }> = {
	'top-l1-chains': {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h', 'volume24h', 'bridgedTvl', 'stablesMcap'],
		sortBy: 'tvl'
	},
	'l2-ecosystem': {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h', 'volume24h', 'bridgedTvl', 'stablesMcap'],
		sortBy: 'tvl'
	},
	'dex-leaders': {
		columns: ['name', 'tvl', 'volume24h', 'volume_7d', 'fees24h', 'revenue24h', 'change7d'],
		sortBy: 'volume24h'
	},
	'lending-protocols': {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h', 'volume24h'],
		sortBy: 'tvl'
	},
	'liquid-staking': {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h'],
		sortBy: 'tvl'
	},
	'perps-protocols': {
		columns: ['name', 'tvl', 'perpsVolume24h', 'perpsVolume7d', 'openInterest', 'fees24h', 'revenue24h'],
		sortBy: 'perpsVolume24h'
	},
	'prediction-market-protocols': {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h'],
		sortBy: 'tvl'
	},
	'yield-farming-protocols': {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h'],
		sortBy: 'tvl'
	},
	'risk-curators-protocols': {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h'],
		sortBy: 'tvl'
	},
	'dex-aggregators': {
		columns: ['name', 'tvl', 'aggregators_volume_24h', 'aggregators_volume_7d', 'fees24h', 'revenue24h'],
		sortBy: 'aggregators_volume_24h'
	},
	'derivatives-protocols': {
		columns: ['name', 'tvl', 'options_volume_24h', 'options_volume_7d', 'fees24h', 'revenue24h'],
		sortBy: 'options_volume_24h'
	}
}

export interface ChainCategoryData {
	chainsInCategory: Map<string, Set<string>>
}

interface SelectedItem {
	slug: string
	name: string
}

interface DimensionProtocol {
	name: string
	slug: string
	displayName?: string
	defillamaId?: string
	total24h?: number
}

export interface DimensionProtocols {
	perps?: Array<DimensionProtocol>
	dexs?: Array<DimensionProtocol>
	dexAggregators?: Array<DimensionProtocol>
}

export function getTemplateItems(
	template: DashboardTemplate,
	protocols: Array<Protocol>,
	chains: Array<Chain>,
	chainCategoryData?: ChainCategoryData,
	dimensionProtocols?: DimensionProtocols
): Array<SelectedItem> {
	if (template.parameterized === true) return []
	if (template.type === 'protocols') {
		// Volume templates use the ranked dimension dataset, never a TVL-ranked fallback.
		if (template.filter.metadataFlag) {
			return (dimensionProtocols?.[template.filter.metadataFlag] ?? []).slice(0, template.count).map((p) => ({
				slug: p.slug,
				name: p.displayName || p.name
			}))
		}

		let filtered = protocols

		if (template.filter.category) {
			filtered = filtered.filter((p) => p.category === template.filter.category)
		}

		return filtered
			.filter((p) => !p.parentProtocol)
			.sort((a, b) => b.tvl - a.tvl)
			.slice(0, template.count)
			.map((p) => ({ slug: p.slug, name: p.name }))
	}
	let filteredChains = chains

	if (template.filter.chainCategory && chainCategoryData) {
		const categoryChains = chainCategoryData.chainsInCategory.get(template.filter.chainCategory)
		if (categoryChains) {
			filteredChains = chains.filter((c) => categoryChains.has(c.name))
		}
	}

	if (template.filter.excludeChainCategory && chainCategoryData) {
		const excludeChains = chainCategoryData.chainsInCategory.get(template.filter.excludeChainCategory)
		if (excludeChains) {
			filteredChains = filteredChains.filter((c) => !excludeChains.has(c.name))
		}
	}

	if (template.filter.chainNames) {
		const chainSet = new Set(template.filter.chainNames)
		filteredChains = filteredChains.filter((c) => chainSet.has(c.name))
	}

	return filteredChains
		.toSorted((a, b) => b.tvl - a.tvl)
		.slice(0, template.count)
		.map((c) => ({ slug: c.name, name: c.name }))
}

function generateTemplateMetrics(
	template: ComparisonDashboardTemplate,
	selectedItems: Array<SelectedItem>
): Array<MetricConfig> {
	const primaryMetric = template.metrics[0]
	if (!primaryMetric) return []

	const metrics: Array<MetricConfig> = []
	for (const item of selectedItems) {
		const metric = createMetricConfig({
			id: generateItemId('metric', `${item.slug}-${primaryMetric}`),
			kind: 'metric',
			subject:
				template.type === 'chains'
					? { itemType: 'chain', chain: item.slug }
					: { itemType: 'protocol', protocol: item.slug },
			type: primaryMetric,
			aggregator: 'latest',
			window: '30d',
			compare: { mode: 'previous_window', format: 'percent' },
			chartType: 'sparkline',
			colSpan: 0.5
		})
		if (metric) metrics.push(metric)
	}
	return metrics
}

function generateTemplateTable(
	template: ComparisonDashboardTemplate,
	selectedItems: Array<SelectedItem>
): UnifiedTableConfig {
	const tableConfig = TEMPLATE_TABLE_COLUMNS[template.id] || {
		columns: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h', 'volume24h'],
		sortBy: 'tvl'
	}

	const columnVisibility: Record<string, boolean> = {}
	for (const col of tableConfig.columns) {
		columnVisibility[col] = true
	}

	const itemSlugs = selectedItems.map((item) => item.slug)

	return {
		id: generateItemId('unified-table', `template-${template.id}`),
		kind: 'unified-table',
		configVersion: UNIFIED_TABLE_CONFIG_VERSION,
		strategy: 'protocols',
		rowHeaders: template.type === 'chains' ? ['chain'] : ['protocol'],
		filters: template.type === 'protocols' ? { protocols: itemSlugs } : { chains: itemSlugs },
		columnOrder: tableConfig.columns,
		columnVisibility,
		defaultSorting: [{ id: tableConfig.sortBy, desc: true }],
		colSpan: 2
	}
}

function generateTemplateMultiCharts(
	template: ComparisonDashboardTemplate,
	selectedItems: Array<SelectedItem>
): Array<MultiChartConfig> {
	return template.metrics.flatMap((metric) => {
		const chartTypeInfo = getProDashboardChartTypeConfig(metric)
		const isGroupable = chartTypeInfo && 'groupable' in chartTypeInfo && chartTypeInfo.groupable

		const chartItems: Array<ChartConfig> = []
		for (const item of selectedItems) {
			const chartBase = {
				id: generateItemId('chart', `${item.slug}-${metric}`),
				kind: 'chart' as const,
				...(isGroupable && template.grouping !== undefined ? { grouping: template.grouping } : {})
			}
			const chart =
				template.type === 'chains'
					? createChartConfig({ ...chartBase, subjectType: 'chain', chain: item.slug, type: metric })
					: createChartConfig({ ...chartBase, subjectType: 'protocol', protocol: item.slug, type: metric })
			if (chart) chartItems.push(chart)
		}
		if (chartItems.length === 0) return []

		const chart: MultiChartConfig = {
			id: generateItemId('multi', `template-${metric}`),
			kind: 'multi',
			name: `${chartTypeInfo?.title || metric} Comparison`,
			items: chartItems,
			...(isGroupable && template.grouping !== undefined ? { grouping: template.grouping } : {}),
			showStacked: template.displayMode === 'stacked',
			showCumulative: false,
			showPercentage: false,
			colSpan: 1
		}
		return [chart]
	})
}

export function generateTemplateCharts(
	template: DashboardTemplate,
	selectedItems: Array<SelectedItem>
): GeneratedTemplate {
	if (template.parameterized === true) {
		return { items: template.createItems(), variables: template.variables.map((variable) => ({ ...variable })) }
	}
	if (selectedItems.length === 0) {
		return { items: [], variables: [] }
	}

	const metricCards = generateTemplateMetrics(template, selectedItems)
	const multiCharts = generateTemplateMultiCharts(template, selectedItems)
	const table = generateTemplateTable(template, selectedItems)

	const totalEffectiveCols = metricCards.length * 1 + multiCharts.length * 2
	const remainder = totalEffectiveCols % 4

	if (remainder === 2 && multiCharts.length > 0) {
		const lastChart = multiCharts.at(-1)
		if (lastChart) lastChart.colSpan = 2
	}

	return { items: [...metricCards, ...multiCharts, table], variables: [] }
}
