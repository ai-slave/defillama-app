import { createChartConfig, createMetricConfig } from './dashboardConfig/classicChartConfig'
import type { DashboardItemConfig } from './dashboardItemConfig'
import {
	getProDashboardChartTypeConfig,
	type Chain,
	type ChartConfig,
	type MetricConfig,
	type MultiChartConfig,
	type ProDashboardChartType,
	type Protocol
} from './types'
import { UNIFIED_TABLE_CONFIG_VERSION, type UnifiedTableConfig } from './unifiedTable/config/current'

export interface DashboardTemplate {
	id: string
	name: string
	description: string
	type: 'chains' | 'protocols'
	metrics: ProDashboardChartType[]
	filter: {
		category?: string
		metadataFlag?: keyof DimensionProtocols
		chainNames?: string[]
		chainCategory?: string
		excludeChainCategory?: string
	}
	count: number
	displayMode?: 'default' | 'stacked'
	grouping?: 'day' | 'week' | 'month'
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
	{
		id: 'top-l1-chains',
		name: 'Top L1 Chains',
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
		name: 'L2 Ecosystem',
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
		name: 'DEX Leaders',
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
		name: 'Lending Protocols',
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
		name: 'Perps Protocols',
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
		name: 'Yield Protocols',
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

const TEMPLATE_TABLE_COLUMNS: Record<string, { columns: string[]; sortBy: string }> = {
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

function generateId(prefix: string, suffix: string): string {
	return `${prefix}-${suffix}-${Date.now()}`
}

interface ProtocolMetadata {
	flags?: Record<string, boolean>
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
	perps?: DimensionProtocol[]
	dexs?: DimensionProtocol[]
	dexAggregators?: DimensionProtocol[]
}

function getSelectedItems(
	template: DashboardTemplate,
	protocols: Protocol[],
	chains: Chain[],
	protocolMetadata: Map<string, ProtocolMetadata>,
	chainCategoryData?: ChainCategoryData,
	dimensionProtocols?: DimensionProtocols
): SelectedItem[] {
	if (template.type === 'protocols') {
		if (template.filter.metadataFlag && dimensionProtocols) {
			const dimensionKey = template.filter.metadataFlag
			const dimensionData = dimensionProtocols[dimensionKey]
			if (dimensionData && dimensionData.length > 0) {
				return dimensionData.slice(0, template.count).map((p) => ({
					slug: p.slug,
					name: p.displayName || p.name
				}))
			}
		}

		let filtered = protocols

		if (template.filter.category) {
			filtered = filtered.filter((p) => p.category === template.filter.category)
		}

		if (template.filter.metadataFlag) {
			const metadataFlag = template.filter.metadataFlag
			filtered = filtered.filter((p) => {
				const meta = protocolMetadata.get(p.slug)
				return meta?.flags?.[metadataFlag]
			})
		}

		return filtered
			.filter((p) => template.filter.metadataFlag || !p.parentProtocol)
			.sort((a, b) => b.tvl - a.tvl)
			.slice(0, template.count)
			.map((p) => ({ slug: p.slug, name: p.name }))
	} else {
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
			.sort((a, b) => b.tvl - a.tvl)
			.slice(0, template.count)
			.map((c) => ({ slug: c.name, name: c.name }))
	}
}

function generateTemplateMetrics(template: DashboardTemplate, selectedItems: SelectedItem[]): MetricConfig[] {
	const primaryMetric = template.metrics[0]
	if (!primaryMetric) return []

	const metrics: MetricConfig[] = []
	for (const item of selectedItems) {
		const metric = createMetricConfig({
			id: generateId('metric', `${item.slug}-${primaryMetric}`),
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

function generateTemplateTable(template: DashboardTemplate, selectedItems: SelectedItem[]): UnifiedTableConfig {
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
		id: generateId('unified-table', `template-${template.id}`),
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

function generateTemplateMultiCharts(template: DashboardTemplate, selectedItems: SelectedItem[]): MultiChartConfig[] {
	return template.metrics.flatMap((metric) => {
		const chartTypeInfo = getProDashboardChartTypeConfig(metric)
		const isGroupable = chartTypeInfo && 'groupable' in chartTypeInfo && chartTypeInfo.groupable

		const chartItems: ChartConfig[] = []
		for (const item of selectedItems) {
			const chartBase = {
				id: generateId('chart', `${item.slug}-${metric}`),
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
			id: generateId('multi', `template-${metric}`),
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
	protocols: Protocol[],
	chains: Chain[],
	protocolMetadata: Map<string, ProtocolMetadata>,
	chainCategoryData?: ChainCategoryData,
	dimensionProtocols?: DimensionProtocols
): DashboardItemConfig[] {
	const selectedItems = getSelectedItems(
		template,
		protocols,
		chains,
		protocolMetadata,
		chainCategoryData,
		dimensionProtocols
	)

	if (selectedItems.length === 0) {
		return []
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

	return [...metricCards, ...multiCharts, table]
}
