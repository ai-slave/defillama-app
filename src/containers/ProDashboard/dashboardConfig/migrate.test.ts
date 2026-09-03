import { describe, expect, it } from 'vitest'
import type { UnifiedTableConfig } from '../unifiedTable/config/current'
import { getProtocolMetricCapabilities } from '../unifiedTable/protocolCapabilities'
import { migrateDashboardConfig, migrateDashboardItemConfig } from './migrate'
import type {
	PersistedChartConfig,
	PersistedDashboard,
	PersistedLegacyMetricConfig,
	UnifiedTableV1Config,
	UnifiedTableV2Config,
	UnversionedUnifiedTableConfig
} from './persisted'

const ESSENTIAL_UNIFIED_COLUMN_ORDER = [
	'name',
	'category',
	'chains',
	'tvl',
	'change1d',
	'change7d',
	'fees24h',
	'fees_7d',
	'revenue24h',
	'revenue_7d',
	'volume24h',
	'volume_7d',
	'mcap',
	'mcaptvl'
] as const

const HISTORICAL_UNVERSIONED_PRESET_LAYOUTS = [
	{
		id: 'advanced-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'tvl',
			'change1d',
			'fees24h',
			'revenue24h',
			'volume24h',
			'mcaptvl',
			'pf',
			'ps'
		],
		sortColumn: 'tvl'
	},
	{
		id: 'fees-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'fees24h',
			'fees_7d',
			'fees_30d',
			'fees_1y',
			'average_1y',
			'cumulativeFees',
			'holderRevenue_24h',
			'holdersRevenue30d',
			'feesChange_1d',
			'feesChange7dOver7d',
			'feesChange30dOver30d'
		],
		sortColumn: 'fees24h'
	},
	{
		id: 'holders-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'holderRevenue_24h',
			'holdersRevenue30d',
			'holderRevenueChange30dOver30d',
			'revenue_30d',
			'revenue24hChange30dAgo'
		],
		sortColumn: 'holderRevenue_24h'
	},
	{
		id: 'volume-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'volume24h',
			'volume_7d',
			'volume_30d',
			'cumulativeVolume',
			'volumeChange_1d',
			'volumeChange7dOver7d',
			'volumeChange30dOver30d',
			'volumeDominance_24h',
			'volumeMarketShare7d'
		],
		sortColumn: 'volume24h'
	},
	{
		id: 'perps-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'perpsVolume24h',
			'perps_volume_7d',
			'perps_volume_30d',
			'perps_volume_change_1d',
			'perpsVolumeChange7dOver7d',
			'perpsVolumeChange30dOver30d',
			'perps_volume_dominance_24h',
			'openInterest'
		],
		sortColumn: 'perpsVolume24h'
	},
	{
		id: 'open-interest-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'openInterest',
			'perpsVolume24h',
			'perps_volume_change_1d',
			'perpsVolume24hChange7dAgo'
		],
		sortColumn: 'openInterest'
	},
	{
		id: 'revenue-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'revenue24h',
			'revenue_7d',
			'revenue_30d',
			'revenue_1y',
			'average_revenue_1y',
			'revenueChange_1d',
			'revenueChange7dOver7d',
			'revenueChange30dOver30d',
			'fees24h',
			'fees_7d',
			'mcap',
			'mcaptvl'
		],
		sortColumn: 'revenue24h'
	},
	{
		id: 'earnings-protocols',
		columns: ['name', 'category', 'chains', 'earnings24h', 'earnings7d', 'earnings30d', 'earnings1y'],
		sortColumn: 'earnings24h'
	},
	{
		id: 'growth-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'tvl',
			'change1d',
			'change7d',
			'change1m',
			'volume24h',
			'volumeChange_1d',
			'volumeChange7dOver7d',
			'volumeChange30dOver30d',
			'fees24h',
			'feesChange_1d',
			'feesChange7dOver7d',
			'revenue24h',
			'revenueChange_1d',
			'revenueChange7dOver7d',
			'mcaptvl'
		],
		sortColumn: 'change7d'
	},
	{
		id: 'aggregators-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'aggregators_volume_24h',
			'aggregators_volume_7d',
			'aggregators_volume_30d',
			'aggregators_volume_change_1d',
			'aggregatorVolumeChange7dOver7d',
			'aggregators_volume_dominance_24h',
			'aggregators_volume_marketShare7d',
			'volume24h',
			'volume_7d'
		],
		sortColumn: 'aggregators_volume_24h'
	},
	{
		id: 'bridge-aggregators-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'bridgeAggregatorVolume24h',
			'bridgeAggregatorVolume7d',
			'bridgeAggregatorVolume30d',
			'bridgeAggregatorVolumeChange1d',
			'bridgeAggregatorVolume24hChange7dAgo',
			'bridgeAggregatorVolumeDominance24h',
			'volume24h',
			'volume_7d'
		],
		sortColumn: 'bridgeAggregatorVolume24h'
	},
	{
		id: 'options-protocols',
		columns: [
			'name',
			'category',
			'chains',
			'options_volume_24h',
			'options_volume_7d',
			'options_volume_30d',
			'options_volume_change_1d',
			'optionsVolumeChange7dOver7d',
			'options_volume_dominance_24h',
			'volume24h',
			'volume_7d'
		],
		sortColumn: 'options_volume_24h'
	}
] as const

describe('Pro dashboard config migration', () => {
	it('makes historical chain and protocol chart subjects explicit', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'chain-chart',
				kind: 'chart',
				chain: 'Ethereum',
				type: 'tvl'
			})
		).toEqual({
			id: 'chain-chart',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type: 'tvl'
		})
		expect(
			migrateDashboardItemConfig({
				id: 'protocol-chart',
				kind: 'chart',
				chain: '',
				protocol: 'aave',
				type: 'tvl'
			})
		).toEqual({
			id: 'protocol-chart',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'aave',
			type: 'tvl'
		})
	})

	it('normalizes historical classic metric names before constructing current configs', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'activity',
				kind: 'chart',
				chain: 'Ethereum',
				type: 'users'
			})
		).toMatchObject({ subjectType: 'chain', type: 'activeUsers' })
		expect(
			migrateDashboardItemConfig({
				id: 'options',
				kind: 'chart',
				chain: '',
				protocol: 'lyra',
				type: 'options'
			})
		).toMatchObject({ subjectType: 'protocol', type: 'optionsPremium' })
		expect(
			migrateDashboardItemConfig({
				id: 'activity-metric',
				kind: 'metric',
				subject: { itemType: 'chain', chain: 'Ethereum' },
				type: 'users',
				aggregator: 'sum',
				window: '30d'
			})
		).toMatchObject({ type: 'activeUsers' })
	})

	it('migrates historical subjects inside multi-charts', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'multi',
				kind: 'multi',
				items: [
					{ id: 'chain', kind: 'chart', chain: 'Base', type: 'fees' },
					{
						id: 'protocol',
						kind: 'chart',
						chain: '',
						protocol: 'aave',
						type: 'fees'
					}
				]
			})
		).toEqual({
			id: 'multi',
			kind: 'multi',
			items: [
				{
					id: 'chain',
					kind: 'chart',
					subjectType: 'chain',
					chain: 'Base',
					type: 'fees'
				},
				{
					id: 'protocol',
					kind: 'chart',
					subjectType: 'protocol',
					protocol: 'aave',
					type: 'fees'
				}
			]
		})
	})

	it('drops unsupported classic chart and metric types at the persisted-config boundary', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'retired-liquidity-chart',
				kind: 'chart',
				subjectType: 'protocol',
				protocol: 'aave',
				type: 'liquidity'
			})
		).toBeNull()
		expect(
			migrateDashboardItemConfig({
				id: 'invalid-metric',
				kind: 'metric',
				subject: { itemType: 'chain', chain: 'Ethereum' },
				type: 'tokenPrice',
				aggregator: 'latest',
				window: '30d'
			})
		).toBeNull()
		expect(
			migrateDashboardItemConfig({
				id: 'mixed-multi',
				kind: 'multi',
				items: [
					{ id: 'valid', kind: 'chart', chain: 'Base', type: 'fees' },
					{
						id: 'invalid',
						kind: 'chart',
						chain: '',
						protocol: 'aave',
						type: 'legacy-adapter-metric'
					}
				]
			})
		).toMatchObject({ items: [{ id: 'valid', type: 'fees' }] })
	})

	it.each(['assetClass', 'assetName'] as const)(
		'migrates the historical RWA %s breakdown alias to the chain breakdown',
		(breakdown) => {
			expect(
				migrateDashboardItemConfig({
					id: `rwa-${breakdown}`,
					kind: 'rwa-overview',
					metric: 'activeMcap',
					chartView: 'timeSeries',
					breakdown
				})
			).toEqual({
				id: `rwa-${breakdown}`,
				kind: 'rwa-overview',
				metric: 'activeMcap',
				chartView: 'timeSeries',
				breakdown: 'chain'
			})
		}
	)

	it('preserves a supported RWA overview breakdown and real RWA asset names', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'rwa-platform',
				kind: 'rwa-overview',
				metric: 'onChainMcap',
				chartView: 'treemap',
				breakdown: 'platform'
			})
		).toMatchObject({ breakdown: 'platform' })

		expect(
			migrateDashboardItemConfig({
				id: 'rwa-asset',
				kind: 'rwa-asset',
				assetId: 'ondo-usdy',
				assetName: 'Ondo US Dollar Yield',
				metrics: ['activeMcap']
			})
		).toMatchObject({ assetName: 'Ondo US Dollar Yield' })
	})

	it.each([
		{ showSparkline: false, expected: 'none' },
		{ showSparkline: true, expected: 'sparkline' },
		{ showSparkline: undefined, expected: 'sparkline' }
	])('migrates historical metric display semantics to $expected', ({ showSparkline, expected }) => {
		expect(
			migrateDashboardItemConfig({
				id: 'metric',
				kind: 'metric',
				subject: { itemType: 'chain', chain: 'Ethereum' },
				type: 'fees',
				aggregator: 'latest',
				window: '30d',
				...(showSparkline === undefined ? {} : { showSparkline })
			})
		).toEqual({
			id: 'metric',
			kind: 'metric',
			subject: { itemType: 'chain', chain: 'Ethereum' },
			type: 'fees',
			aggregator: 'latest',
			window: '30d',
			chartType: expected
		})
	})

	it('keeps an explicit metric chart type ahead of the historical boolean', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'metric',
				kind: 'metric',
				subject: { itemType: 'protocol', protocol: 'aave' },
				type: 'fees',
				aggregator: 'latest',
				window: '30d',
				chartType: 'bar',
				showSparkline: false
			})
		).toEqual({
			id: 'metric',
			kind: 'metric',
			subject: { itemType: 'protocol', protocol: 'aave' },
			type: 'fees',
			aggregator: 'latest',
			window: '30d',
			chartType: 'bar'
		})
	})

	it('removes the historical unused Chart Builder additional filters at read time', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'builder',
				kind: 'builder',
				config: {
					metric: 'fees',
					mode: 'protocol',
					chains: [],
					categories: [],
					groupBy: 'protocol',
					limit: 10,
					chartType: 'line',
					displayAs: 'timeSeries',
					filterMode: 'exclude',
					chainFilterMode: 'include',
					additionalFilters: { deprecated: true }
				}
			})
		).toEqual({
			id: 'builder',
			kind: 'builder',
			config: {
				metric: 'fees',
				mode: 'protocol',
				chains: [],
				categories: [],
				groupBy: 'protocol',
				limit: 10,
				chartType: 'line',
				displayAs: 'timeSeries',
				chainFilterMode: 'include',
				categoryFilterMode: 'exclude',
				chainCategoryFilterMode: 'exclude',
				protocolCategoryFilterMode: 'exclude',
				hideOthers: true
			}
		})
	})

	it('normalizes persisted top-N-only Chart Builder views without rewriting storage', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'builder',
				kind: 'builder',
				config: {
					metric: 'fees',
					mode: 'protocol',
					chains: [],
					categories: [],
					groupBy: 'protocol',
					limit: 10,
					chartType: 'line',
					displayAs: 'percentage',
					hideOthers: false
				}
			})
		).toEqual({
			id: 'builder',
			kind: 'builder',
			config: {
				metric: 'fees',
				mode: 'protocol',
				chains: [],
				categories: [],
				groupBy: 'protocol',
				limit: 10,
				chartType: 'line',
				displayAs: 'timeSeries',
				chainFilterMode: 'include',
				categoryFilterMode: 'include',
				chainCategoryFilterMode: 'include',
				protocolCategoryFilterMode: 'include',
				hideOthers: true
			}
		})
	})

	it('preserves exact Chart Builder all-series views', () => {
		const persistedConfig = {
			id: 'builder',
			kind: 'builder' as const,
			config: {
				metric: 'tvl' as const,
				mode: 'protocol' as const,
				chains: [],
				categories: [],
				groupBy: 'protocol' as const,
				limit: 10,
				chartType: 'line' as const,
				displayAs: 'percentage' as const,
				hideOthers: false
			}
		}
		expect(migrateDashboardItemConfig(persistedConfig)).toEqual({
			...persistedConfig,
			config: {
				...persistedConfig.config,
				chainFilterMode: 'include',
				categoryFilterMode: 'include',
				chainCategoryFilterMode: 'include',
				protocolCategoryFilterMode: 'include'
			}
		})
	})

	it.each([
		{
			legacyId: 'advanced',
			presetId: 'advanced-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'tvl',
				'change1d',
				'fees24h',
				'revenue24h',
				'volume24h',
				'mcaptvl',
				'pf',
				'ps'
			],
			sorting: [{ id: 'tvl', desc: true }]
		},
		{
			legacyId: 'fees',
			presetId: 'fees-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'tvl',
				'fees24h',
				'fees_7d',
				'fees_30d',
				'fees_1y',
				'average_1y',
				'feesChange_1d',
				'fees24hChange7dAgo',
				'fees24hChange30dAgo',
				'feesChange7dOver7d',
				'feesChange30dOver30d',
				'cumulativeFees',
				'pf'
			],
			sorting: [{ id: 'fees24h', desc: true }]
		},
		{
			legacyId: 'revenue',
			presetId: 'revenue-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'tvl',
				'revenue24h',
				'revenue_7d',
				'revenue_30d',
				'revenue_1y',
				'average_revenue_1y',
				'revenueChange_1d',
				'revenue24hChange7dAgo',
				'revenue24hChange30dAgo',
				'revenueChange7dOver7d',
				'revenueChange30dOver30d',
				'ps'
			],
			sorting: [{ id: 'revenue24h', desc: true }]
		},
		{
			legacyId: 'holders',
			presetId: 'holders-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'holderRevenue_24h',
				'holdersRevenue30d',
				'holderRevenueChange30dOver30d',
				'revenue_30d',
				'revenue24hChange30dAgo'
			],
			sorting: [{ id: 'holderRevenue_24h', desc: true }]
		},
		{
			legacyId: 'earnings',
			presetId: 'earnings-protocols',
			columns: ['name', 'category', 'chains', 'earnings24h', 'earnings7d', 'earnings30d', 'earnings1y'],
			sorting: [{ id: 'earnings24h', desc: true }]
		},
		{
			legacyId: 'spot-volume',
			presetId: 'volume-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'volume24h',
				'volume_7d',
				'volume_30d',
				'volumeChange_1d',
				'volume24hChange7dAgo',
				'volume24hChange30dAgo',
				'volumeDominance_24h',
				'volumeMarketShare7d',
				'cumulativeVolume'
			],
			sorting: [{ id: 'volume24h', desc: true }]
		},
		{
			legacyId: 'perps-volume',
			presetId: 'perps-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'perpsVolume24h',
				'perps_volume_7d',
				'perps_volume_30d',
				'perps_volume_change_1d',
				'perpsVolume24hChange7dAgo',
				'perpsVolume24hChange30dAgo',
				'perps_volume_dominance_24h',
				'openInterest'
			],
			sorting: [{ id: 'perpsVolume24h', desc: true }]
		},
		{
			legacyId: 'open-interest',
			presetId: 'open-interest-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'openInterest',
				'perpsVolume24h',
				'perps_volume_change_1d',
				'perpsVolume24hChange7dAgo'
			],
			sorting: [{ id: 'openInterest', desc: true }]
		},
		{
			legacyId: 'dex-aggregators',
			presetId: 'aggregators-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'aggregators_volume_24h',
				'aggregators_volume_change_1d',
				'aggregators_volume_7d',
				'aggregatorVolume24hChange7dAgo',
				'aggregators_volume_30d',
				'aggregators_volume_dominance_24h',
				'aggregators_volume_marketShare7d'
			],
			sorting: [{ id: 'aggregators_volume_24h', desc: true }]
		},
		{
			legacyId: 'bridge-aggregators',
			presetId: 'bridge-aggregators-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'bridgeAggregatorVolume24h',
				'bridgeAggregatorVolumeChange1d',
				'bridgeAggregatorVolume7d',
				'bridgeAggregatorVolume24hChange7dAgo',
				'bridgeAggregatorVolume30d',
				'bridgeAggregatorVolumeDominance24h'
			],
			sorting: [{ id: 'bridgeAggregatorVolume24h', desc: true }]
		},
		{
			legacyId: 'options',
			presetId: 'options-protocols',
			columns: [
				'name',
				'category',
				'chains',
				'options_volume_24h',
				'options_volume_change_1d',
				'options_volume_7d',
				'optionsVolume24hChange7dAgo',
				'options_volume_30d',
				'options_volume_dominance_24h'
			],
			sorting: [{ id: 'options_volume_24h', desc: true }]
		}
	])(
		'preserves the classic $legacyId preset semantics in its Unified layout',
		({ legacyId, presetId, columns, sorting }) => {
			const migrated = migrateDashboardItemConfig({
				id: `classic-${legacyId}`,
				kind: 'table',
				tableType: 'protocols',
				chains: [],
				activePresetId: legacyId
			})
			expect(migrated).toMatchObject({
				activePresetId: presetId,
				columnOrder: columns,
				columnVisibility: Object.fromEntries(columns.map((id) => [id, true])),
				defaultSorting: sorting
			})
		}
	)

	it('materializes the historical Essential preset for an untouched classic table', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'classic-default',
				kind: 'table',
				tableType: 'protocols',
				chains: []
			})
		).toMatchObject({
			activePresetId: 'essential-protocols',
			columnOrder: ['name', 'category', 'chains', 'tvl', 'change1d', 'change7d', 'mcap'],
			columnVisibility: {
				name: true,
				category: true,
				chains: true,
				tvl: true,
				change1d: true,
				change7d: true,
				mcap: true
			},
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
	})

	it('keeps explicit classic layout and sorting ahead of preset defaults', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'classic-fees-customized',
				kind: 'table',
				tableType: 'protocols',
				chains: [],
				activePresetId: 'fees',
				columnOrder: ['name', 'tvl'],
				columnVisibility: { name: true, tvl: true },
				filters: { sortBy: 'volume_24h', sortOrder: 'asc' }
			})
		).toMatchObject({
			activePresetId: 'fees-protocols',
			columnOrder: ['name', 'tvl'],
			columnVisibility: { name: true, tvl: true },
			defaultSorting: [{ id: 'volume24h', desc: false }]
		})
	})

	it('keeps an explicit classic column order instead of filling from a preset', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'classic-fees-partial-layout',
				kind: 'table',
				tableType: 'protocols',
				chains: [],
				activePresetId: 'fees',
				columnOrder: ['name', 'tvl']
			})
		).toMatchObject({
			activePresetId: 'fees-protocols',
			columnOrder: ['name', 'tvl'],
			columnVisibility: { name: true, tvl: true },
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
	})

	it('versions an existing Unified protocols table without changing its behavior', () => {
		const config: UnversionedUnifiedTableConfig = {
			id: 'unified-table-protocols-1',
			kind: 'unified-table',
			rowHeaders: ['parent-protocol', 'protocol'],
			params: { chains: ['Ethereum'], category: 'Lending' },
			filters: { tvlMin: 1_000_000, activeLending: true },
			columnOrder: ['name', 'tvl'],
			columnVisibility: { name: true, tvl: true },
			defaultSorting: [{ id: 'tvl', desc: true }]
		}

		expect(migrateDashboardItemConfig(config)).toEqual({
			...config,
			configVersion: 3,
			strategy: 'protocols',
			filters: { tvlMin: 1_000_000 }
		})
	})

	it('materializes the selected layout for a preset-only unversioned Unified table', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'unified-table-preset-only',
			kind: 'unified-table',
			rowHeaders: ['chain', 'protocol'],
			activePresetId: 'essential-protocols'
		})

		expect(migrated).toEqual({
			id: 'unified-table-preset-only',
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols',
			rowHeaders: ['chain', 'protocol'],
			activePresetId: 'essential-protocols',
			columnOrder: ESSENTIAL_UNIFIED_COLUMN_ORDER,
			columnVisibility: {
				name: true,
				category: false,
				chains: false,
				tvl: true,
				change1d: true,
				change7d: true,
				fees24h: true,
				fees_7d: true,
				revenue24h: true,
				revenue_7d: true,
				volume24h: true,
				volume_7d: true,
				mcap: true,
				mcaptvl: true
			},
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
		if (!migrated || migrated.kind !== 'unified-table') throw new Error('Expected a Unified Table')
		const capabilities = getProtocolMetricCapabilities(migrated)
		expect(capabilities.baseMetricFamilies).toEqual(['tvl', 'dex-volume', 'fees', 'revenue', 'market-cap'])
		expect(capabilities.pointMetrics).toEqual([])
		expect(capabilities.supplementalMetrics).toEqual([])
	})

	it.each(HISTORICAL_UNVERSIONED_PRESET_LAYOUTS)(
		'materializes the historical $id layout without reading the current preset registry',
		({ id, columns, sortColumn }) => {
			const migrated = migrateDashboardItemConfig({
				id: `unversioned-${id}`,
				kind: 'unified-table',
				rowHeaders: ['parent-protocol', 'protocol'],
				activePresetId: id
			})

			expect(migrated).toMatchObject({
				activePresetId: id,
				columnOrder: columns,
				columnVisibility: Object.fromEntries(columns.map((column) => [column, true])),
				defaultSorting: [{ id: sortColumn, desc: true }]
			})
		}
	)

	it('makes an explicit unversioned column order authoritative when visibility was omitted', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'unified-table-explicit-order',
			kind: 'unified-table',
			rowHeaders: ['chain', 'protocol'],
			columnOrder: ['name', 'tvl', 'bridgedTvl']
		})

		expect(migrated).toMatchObject({
			columnOrder: ['name', 'tvl', 'bridgedTvl'],
			columnVisibility: { name: true, tvl: true, bridgedTvl: true },
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
		if (!migrated || migrated.kind !== 'unified-table') throw new Error('Expected a Unified Table')
		expect(getProtocolMetricCapabilities(migrated).baseMetricFamilies).toEqual(['tvl', 'bridged-tvl'])
	})

	it('keeps visibility-only unversioned layouts sparse', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'unified-table-explicit-visibility',
			kind: 'unified-table',
			rowHeaders: ['protocol'],
			columnVisibility: { fees24h: true }
		})

		expect(migrated).toMatchObject({
			columnVisibility: { name: true, fees24h: true },
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
		expect(migrated).not.toHaveProperty('columnOrder')
		if (!migrated || migrated.kind !== 'unified-table') throw new Error('Expected a Unified Table')
		expect(getProtocolMetricCapabilities(migrated).baseMetricFamilies).toEqual(['tvl', 'fees'])
	})

	it('keeps an ordered classic custom column visible when a partial visibility map omits it', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'classic-partial-custom-visibility',
			kind: 'table',
			tableType: 'protocols',
			chains: [],
			columnOrder: ['name', 'custom_fee'],
			columnVisibility: { name: true },
			customColumns: [
				{
					id: 'custom_fee',
					name: 'Fees',
					expression: 'fees_24h',
					isValid: true
				}
			]
		})

		expect(migrated).toMatchObject({
			columnOrder: ['name', 'custom_fee'],
			columnVisibility: { name: true, custom_fee: true }
		})
		if (!migrated || migrated.kind !== 'unified-table') throw new Error('Expected a Unified Table')
		expect(getProtocolMetricCapabilities(migrated).baseMetricFamilies).toEqual(['tvl', 'fees'])
	})

	it('drops sorting that references a removed classic custom column', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'classic-removed-custom-sort',
			kind: 'table',
			tableType: 'protocols',
			chains: [],
			filters: { sortBy: 'custom_drop' },
			customColumns: [
				{
					id: 'custom_drop',
					name: 'LP',
					expression: 'supplySideRevenue_24h / tvl',
					isValid: true
				}
			]
		})

		expect(migrated).toMatchObject({
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
		expect(migrated).not.toHaveProperty('customColumns')
	})

	it('rejects inherited object properties as unknown classic column ids', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'classic-prototype-column',
				kind: 'table',
				tableType: 'protocols',
				chains: [],
				columnOrder: ['constructor', 'tvl'],
				columnVisibility: { constructor: true, tvl: true }
			})
		).toMatchObject({
			columnOrder: ['name', 'tvl'],
			columnVisibility: { name: true, tvl: true }
		})
	})

	it('hides custom columns omitted from an authoritative unversioned order', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'unified-table-omitted-custom-column',
			kind: 'unified-table',
			rowHeaders: ['protocol'],
			columnOrder: ['tvl'],
			customColumns: [
				{
					id: 'custom_fees',
					name: 'Fees',
					expression: 'fees24h',
					format: 'usd',
					aggregation: 'recalculate'
				}
			]
		})

		expect(migrated).toMatchObject({
			columnOrder: ['name', 'tvl'],
			columnVisibility: { name: true, tvl: true, custom_fees: false },
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
		if (!migrated || migrated.kind !== 'unified-table') throw new Error('Expected a Unified Table')
		expect(getProtocolMetricCapabilities(migrated).baseMetricFamilies).toEqual(['tvl'])
	})

	it('keeps an ordered unversioned custom column visible when a partial visibility map omits it', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'unified-table-partial-custom-visibility',
			kind: 'unified-table',
			rowHeaders: ['protocol'],
			columnOrder: ['name', 'custom_fee'],
			columnVisibility: { name: true },
			customColumns: [
				{
					id: 'custom_fee',
					name: 'Fees',
					expression: 'fees24h',
					format: 'usd',
					aggregation: 'recalculate'
				}
			]
		})

		expect(migrated).toMatchObject({
			columnOrder: ['name', 'custom_fee'],
			columnVisibility: { name: true, custom_fee: true }
		})
		if (!migrated || migrated.kind !== 'unified-table') throw new Error('Expected a Unified Table')
		expect(getProtocolMetricCapabilities(migrated).baseMetricFamilies).toEqual(['tvl', 'fees'])
	})

	it('materializes the rendered TVL sort when unversioned sorting is empty', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'unified-table-empty-sorting',
			kind: 'unified-table',
			rowHeaders: ['protocol'],
			columnOrder: ['name', 'earnings24h'],
			defaultSorting: []
		})

		expect(migrated).toMatchObject({
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
		if (!migrated || migrated.kind !== 'unified-table') throw new Error('Expected a Unified Table')
		const capabilities = getProtocolMetricCapabilities(migrated)
		expect(capabilities.baseMetricFamilies).toEqual(['tvl'])
		expect(capabilities.supplementalMetrics).toEqual(['earnings'])
	})

	it.each(['removed-preset', '__proto__'])(
		'normalizes unknown unversioned preset %s to the fallback preset',
		(presetId) => {
			expect(
				migrateDashboardItemConfig({
					id: 'unified-table-unknown-preset',
					kind: 'unified-table',
					rowHeaders: ['protocol'],
					activePresetId: presetId
				})
			).toMatchObject({ activePresetId: 'essential-protocols' })
		}
	)

	it('migrates v1 period changes without conflating comparison windows', () => {
		const config: UnifiedTableV1Config = {
			id: 'unified-table-protocols-1',
			kind: 'unified-table',
			configVersion: 1,
			strategy: 'protocols',
			rowHeaders: ['protocol'],
			columnOrder: ['name', 'volumeChange_7d', 'feesChange_1m'],
			columnVisibility: { volumeChange_7d: true, revenueChange_1m: false },
			defaultSorting: [{ id: 'revenueChange_1m', desc: true }],
			filters: { volumeChange7dMin: 10, feesChange1mMax: 25, apyMin: 1 },
			customColumns: [
				{
					id: 'custom-growth',
					name: 'Growth',
					expression: 'volumeChange_7d / feesChange_1m + my_volumeChange_7d',
					format: 'percent',
					aggregation: 'recalculate'
				}
			]
		}

		expect(migrateDashboardItemConfig(config)).toEqual({
			...config,
			configVersion: 3,
			columnOrder: ['name', 'volumeChange7dOver7d', 'feesChange30dOver30d'],
			columnVisibility: {
				volumeChange7dOver7d: true,
				revenueChange30dOver30d: false
			},
			defaultSorting: [{ id: 'revenueChange30dOver30d', desc: true }],
			filters: { volumeChange7dOver7dMin: 10, feesChange30dOver30dMax: 25 },
			customColumns: [
				{
					id: 'custom-growth',
					name: 'Growth',
					expression: 'volumeChange7dOver7d / feesChange30dOver30d + my_volumeChange_7d',
					format: 'percent',
					aggregation: 'recalculate'
				}
			]
		})
	})

	it('removes retired fee-distribution columns and dependent custom columns from v2 configs', () => {
		const config: UnifiedTableV2Config = {
			id: 'unified-table-protocols-1',
			kind: 'unified-table',
			configVersion: 2,
			strategy: 'protocols',
			rowHeaders: ['protocol'],
			columnOrder: ['name', 'fees24h', 'userFees_24h', 'custom_lp_yield', 'custom_dependent', 'holderRevenue_24h'],
			columnVisibility: {
				name: true,
				fees24h: true,
				userFees_24h: true,
				custom_lp_yield: true,
				custom_dependent: true,
				holderRevenue_24h: true
			},
			defaultSorting: [{ id: 'treasuryRevenue_24h', desc: true }],
			filters: {
				treasuryRevenue24hMin: 1,
				hasTreasuryRevenue: true,
				holderRevenue24hMin: 2,
				protocolAgeDaysMax: 90,
				tokens: ['USDC']
			},
			customColumns: [
				{
					id: 'custom_lp_yield',
					name: 'LP Yield',
					expression: 'supplySideRevenue_24h / tvl',
					format: 'percent',
					aggregation: 'recalculate'
				},
				{
					id: 'custom_dependent',
					name: 'Dependent Score',
					expression: 'custom_lp_yield * 2',
					format: 'number',
					aggregation: 'recalculate'
				}
			]
		}

		expect(migrateDashboardItemConfig(config)).toEqual({
			id: 'unified-table-protocols-1',
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols',
			rowHeaders: ['protocol'],
			columnOrder: ['name', 'fees24h', 'holderRevenue_24h'],
			columnVisibility: { name: true, fees24h: true, holderRevenue_24h: true },
			defaultSorting: [],
			filters: { holderRevenue24hMin: 2, protocolAgeDaysMax: 90 },
			customColumns: []
		})
	})

	it('repairs the pre-tableType protocols shape observed in persisted dashboards', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'table-solana-1',
				kind: 'table',
				chain: 'Solana',
				colSpan: 2,
				columnOrder: ['name', 'tvl']
			})
		).toEqual({
			id: 'table-solana-1',
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols',
			rowHeaders: ['parent-protocol', 'protocol'],
			params: { chains: ['Solana'] },
			colSpan: 2,
			columnOrder: ['name', 'tvl'],
			columnVisibility: { name: true, tvl: true },
			defaultSorting: [{ id: 'tvl', desc: true }]
		})
	})

	it('migrates classic protocol semantics and removes retired custom dependencies', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'classic',
				kind: 'table',
				tableType: 'protocols',
				chains: ['All'],
				columnOrder: ['name', 'feesChange_7d', 'fees_24h_share', 'supplySideRevenue_24h', 'custom_keep', 'custom_drop'],
				columnVisibility: {
					feesChange_7d: true,
					fees_24h_share: true,
					custom_keep: true,
					custom_drop: true
				},
				filters: {
					feesChange7dMin: 5,
					hasRewards: true,
					sortBy: 'fees_24h_share',
					sortOrder: 'asc'
				},
				customColumns: [
					{
						id: 'custom_keep',
						name: 'Margin',
						expression: 'revenue_24h / fees_24h',
						isValid: true
					},
					{
						id: 'custom_drop',
						name: 'LP',
						expression: 'supplySideRevenue_24h / tvl',
						isValid: true
					}
				]
			})
		).toEqual({
			id: 'classic',
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols',
			rowHeaders: ['parent-protocol', 'protocol'],
			columnOrder: ['name', 'fees24hChange7dAgo', 'filteredShare_fees24h', 'custom_keep'],
			columnVisibility: {
				name: true,
				fees24hChange7dAgo: true,
				filteredShare_fees24h: true,
				custom_keep: true
			},
			filters: { fees24hChange7dAgoMin: 5 },
			defaultSorting: [{ id: 'filteredShare_fees24h', desc: false }],
			customColumns: [
				{
					id: 'custom_keep',
					name: 'Margin',
					expression: 'revenue24h / fees24h',
					format: 'usd',
					aggregation: 'recalculate'
				}
			]
		})
	})

	it('preserves the semantics of an already-current config without reusing its object', () => {
		const config: UnifiedTableConfig = {
			id: 'unified-table-protocols-1',
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols',
			rowHeaders: ['protocol']
		}

		const migrated = migrateDashboardItemConfig(config)

		expect(migrated).toEqual(config)
		expect(migrated).not.toBe(config)
	})

	it('is idempotent after completing the ordered legacy-table migration', () => {
		const persisted = {
			id: 'classic',
			kind: 'table' as const,
			tableType: 'protocols' as const,
			chains: ['All'],
			columnOrder: ['name', 'feesChange_7d', 'supplySideRevenue_24h'],
			filters: { feesChange7dMin: 5, hasRewards: true }
		}

		const migrated = migrateDashboardItemConfig(persisted)

		if (!migrated) throw new Error('Expected a migrated config')
		expect(migrateDashboardItemConfig(migrated)).toEqual(migrated)
	})

	it('keeps historical dataset repairs isolated in the read migration', () => {
		expect(
			migrateDashboardItemConfig({
				id: 'old-stables',
				kind: 'table',
				tableType: 'dataset',
				chains: [],
				datasetChain: 'Base'
			})
		).toMatchObject({ datasetType: 'stablecoins', chain: 'Base' })

		expect(
			migrateDashboardItemConfig({
				id: 'old-cex-efficiency',
				kind: 'table',
				tableType: 'dataset',
				datasetType: 'cex-analytics',
				chains: [],
				cexAnalyticsView: 'efficiency'
			})
		).toMatchObject({
			datasetType: 'cex-analytics',
			cexAnalyticsView: 'comparison'
		})

		expect(
			migrateDashboardItemConfig({
				id: 'old-trending',
				kind: 'table',
				tableType: 'dataset',
				datasetType: 'trending-contracts',
				chains: ['Ethereum'],
				datasetChain: 'Ethereum',
				datasetTimeframe: '7d'
			})
		).toEqual({
			id: 'old-trending',
			kind: 'text',
			title: 'Trending Contracts retired',
			content:
				'This table used a non-canonical third-party feed and has been retired. Replace it with a canonical Pro dataset.'
		})
	})

	it('migrates active and undo items in memory without changing the source record', () => {
		const table: UnversionedUnifiedTableConfig = {
			id: 'unified-table-protocols-1',
			kind: 'unified-table',
			rowHeaders: ['protocol']
		}
		const persisted: PersistedDashboard = {
			id: 'dashboard-1',
			user: 'owner-1',
			created: '2026-01-01T00:00:00.000Z',
			updated: '2026-01-02T00:00:00.000Z',
			data: {
				dashboardName: 'Dashboard',
				items: [table],
				aiUndoState: {
					items: [table],
					timestamp: '2026-01-01T00:00:00.000Z',
					sessionId: 'session-1'
				}
			}
		}

		const migrated = migrateDashboardConfig(persisted)

		const expected = {
			...table,
			configVersion: 3,
			strategy: 'protocols',
			activePresetId: 'essential-protocols',
			columnOrder: ESSENTIAL_UNIFIED_COLUMN_ORDER,
			columnVisibility: Object.fromEntries(ESSENTIAL_UNIFIED_COLUMN_ORDER.map((id) => [id, true])),
			defaultSorting: [{ id: 'tvl', desc: true }]
		}
		expect(migrated.data.items[0]).toEqual(expected)
		expect(migrated.data.aiUndoState?.items[0]).toEqual(expected)
		expect(persisted.data.items[0]).toBe(table)
		expect(persisted.data.items[0]).not.toHaveProperty('configVersion')
	})

	it('migrates historical chart and metric cards in active and undo state without rewriting persisted objects', () => {
		const chart: PersistedChartConfig = {
			id: 'chart',
			kind: 'chart',
			chain: '',
			protocol: 'aave',
			type: 'fees'
		}
		const metric: PersistedLegacyMetricConfig = {
			id: 'metric',
			kind: 'metric',
			subject: { itemType: 'chain', chain: 'Ethereum' },
			type: 'fees',
			aggregator: 'latest',
			window: '30d',
			showSparkline: false
		}
		const persisted: PersistedDashboard = {
			id: 'dashboard-1',
			user: 'owner-1',
			created: '2026-01-01T00:00:00.000Z',
			updated: '2026-01-02T00:00:00.000Z',
			data: {
				dashboardName: 'Dashboard',
				items: [chart],
				aiUndoState: {
					items: [metric],
					timestamp: '2026-01-01T00:00:00.000Z',
					sessionId: 'session-1'
				}
			}
		}

		const migrated = migrateDashboardConfig(persisted)

		expect(migrated.data.items[0]).toEqual({
			id: 'chart',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'aave',
			type: 'fees'
		})
		expect(migrated.data.aiUndoState?.items[0]).toEqual({
			id: 'metric',
			kind: 'metric',
			subject: { itemType: 'chain', chain: 'Ethereum' },
			type: 'fees',
			aggregator: 'latest',
			window: '30d',
			chartType: 'none'
		})
		expect(persisted.data.items[0]).toBe(chart)
		expect(persisted.data.aiUndoState?.items[0]).toBe(metric)
		expect(chart).toHaveProperty('chain', '')
		expect(chart).not.toHaveProperty('subjectType')
		expect(metric).toHaveProperty('showSparkline', false)
		expect(metric).not.toHaveProperty('chartType')
	})

	it('migrates historical RWA aliases in active and undo state without rewriting persisted objects', () => {
		const overview = {
			id: 'rwa-overview',
			kind: 'rwa-overview' as const,
			metric: 'activeMcap' as const,
			chartView: 'timeSeries' as const,
			breakdown: 'assetClass' as const
		}
		const undoOverview = {
			...overview,
			id: 'rwa-undo',
			breakdown: 'assetName' as const
		}
		const persisted: PersistedDashboard = {
			id: 'dashboard-1',
			user: 'owner-1',
			created: '2026-01-01T00:00:00.000Z',
			updated: '2026-01-02T00:00:00.000Z',
			data: {
				dashboardName: 'Dashboard',
				items: [overview],
				aiUndoState: {
					items: [undoOverview],
					timestamp: '2026-01-01T00:00:00.000Z',
					sessionId: 'session-1'
				}
			}
		}

		const migrated = migrateDashboardConfig(persisted)

		expect(migrated.data.items[0]).toMatchObject({ breakdown: 'chain' })
		expect(migrated.data.aiUndoState?.items[0]).toMatchObject({
			breakdown: 'chain'
		})
		expect(overview.breakdown).toBe('assetClass')
		expect(undoOverview.breakdown).toBe('assetName')
	})

	it('removes retired Yields-only filters from the whole dashboard without mutating persisted config', () => {
		const retiredFilters = {
			tvlMin: 10,
			tokens: ['USDC'],
			apyMin: 1,
			apyMax: 20,
			baseApyMin: 0.5,
			baseApyMax: 10,
			hasRewards: true,
			stablesOnly: true,
			activeLending: true,
			poolTypes: ['stablecoins']
		}
		const table = {
			id: 'unified-table-protocols-1',
			kind: 'unified-table' as const,
			configVersion: 3 as const,
			strategy: 'protocols' as const,
			rowHeaders: ['protocol' as const],
			filters: retiredFilters
		}
		const persisted: PersistedDashboard = {
			id: 'dashboard-1',
			user: 'owner-1',
			created: '2026-01-01T00:00:00.000Z',
			updated: '2026-01-02T00:00:00.000Z',
			data: {
				dashboardName: 'Dashboard',
				items: [table],
				aiUndoState: {
					items: [table],
					timestamp: '2026-01-01T00:00:00.000Z',
					sessionId: 'session-1'
				}
			}
		}
		const originalFilters = structuredClone(retiredFilters)

		const migrated = migrateDashboardConfig(persisted)

		expect(migrated.data.items[0]).toMatchObject({ filters: { tvlMin: 10 } })
		expect(migrated.data.aiUndoState?.items[0]).toMatchObject({
			filters: { tvlMin: 10 }
		})
		expect(persisted.data.items[0]).toBe(table)
		expect(table.filters).toEqual(originalFilters)
		expect(table.filters).toBe(retiredFilters)
	})

	it('keeps chain metrics only on canonical chain-grouped Unified tables', () => {
		const base = {
			kind: 'unified-table' as const,
			configVersion: 3 as const,
			strategy: 'protocols' as const,
			columnOrder: ['name', 'tvl', 'bridgedTvl', 'stablesMcap', 'tvlShare', 'stablesShare', 'volume24hShare'],
			columnVisibility: {
				tvl: true,
				bridgedTvl: true,
				stablesMcap: true,
				volume24hShare: true
			},
			defaultSorting: [{ id: 'bridgedTvl', desc: true }],
			filters: {
				tvlMin: 10,
				bridgedTvlMin: 20,
				stablesMcapMax: 30,
				hasBridgedTVL: true,
				hasStables: true
			}
		}
		const protocolTable = {
			...base,
			id: 'protocols',
			rowHeaders: ['protocol' as const]
		}
		const chainTable = {
			...base,
			id: 'chains',
			rowHeaders: ['chain' as const, 'protocol' as const]
		}

		expect(migrateDashboardItemConfig(protocolTable)).toMatchObject({
			columnOrder: ['name', 'tvl'],
			columnVisibility: { tvl: true },
			defaultSorting: [],
			filters: { tvlMin: 10 }
		})
		expect(migrateDashboardItemConfig(chainTable)).toMatchObject(base)
		expect(protocolTable.columnOrder).toContain('bridgedTvl')
		expect(protocolTable.filters).toHaveProperty('hasStables', true)
	})

	it('treats a persisted null undo state as cleared without mutating the source dashboard', () => {
		const persisted: PersistedDashboard = {
			id: 'dashboard-1',
			user: 'owner-1',
			created: '2026-01-01T00:00:00.000Z',
			updated: '2026-01-02T00:00:00.000Z',
			data: {
				dashboardName: 'Dashboard',
				items: [],
				aiUndoState: null
			}
		}

		const migrated = migrateDashboardConfig(persisted)

		expect(migrated.data).not.toHaveProperty('aiUndoState')
		expect(persisted.data).toHaveProperty('aiUndoState', null)
	})
})
