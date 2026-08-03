import { describe, expect, it } from 'vitest'
import { buildUnifiedTableStreamSourcePlan } from '../unifiedTableSourcePlan'
import { migrateDashboardItemConfig } from './migrate'
import type { PersistedProtocolMetricDatasetType } from './persisted'

const PROTOCOL_METRIC_DATASET_MIGRATIONS = [
	{ datasetType: 'fees', presetId: 'fees-protocols', sortColumn: 'fees24h' },
	{ datasetType: 'revenue', presetId: 'revenue-protocols', sortColumn: 'revenue24h' },
	{ datasetType: 'holders-revenue', presetId: 'holders-protocols', sortColumn: 'holderRevenue_24h' },
	{ datasetType: 'earnings', presetId: 'earnings-protocols', sortColumn: 'earnings24h' },
	{ datasetType: 'dexs', presetId: 'volume-protocols', sortColumn: 'volume24h' },
	{ datasetType: 'perps', presetId: 'perps-protocols', sortColumn: 'perpsVolume24h' },
	{ datasetType: 'aggregators', presetId: 'aggregators-protocols', sortColumn: 'aggregators_volume_24h' },
	{
		datasetType: 'bridge-aggregators',
		presetId: 'bridge-aggregators-protocols',
		sortColumn: 'bridgeAggregatorVolume24h'
	},
	{ datasetType: 'options', presetId: 'options-protocols', sortColumn: 'options_volume_24h' }
] as const satisfies ReadonlyArray<{
	datasetType: PersistedProtocolMetricDatasetType
	presetId: string
	sortColumn: string
}>

describe('protocol metric dataset-table migration', () => {
	it.each(PROTOCOL_METRIC_DATASET_MIGRATIONS)(
		'migrates $datasetType to the canonical $presetId Unified Table preset',
		({ datasetType, presetId, sortColumn }) => {
			const migrated = migrateDashboardItemConfig({
				id: `legacy-${datasetType}`,
				kind: 'table',
				tableType: 'dataset',
				datasetType,
				chains: ['All'],
				colSpan: 1.5
			})

			if (!migrated || migrated.kind !== 'unified-table') {
				throw new Error(`Expected ${datasetType} to migrate to Unified Table`)
			}
			expect(migrated).toMatchObject({
				id: `legacy-${datasetType}`,
				configVersion: 3,
				strategy: 'protocols',
				rowHeaders: ['parent-protocol', 'protocol'],
				activePresetId: presetId,
				defaultSorting: [{ id: sortColumn, desc: true }],
				colSpan: 1.5
			})
			expect(migrated.params).toBeUndefined()
			expect(migrateDashboardItemConfig(migrated)).toEqual(migrated)
		}
	)

	it('preserves only normalized chain and category row scope from transitional dataset-table configs', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'current-revenue',
			kind: 'dataset-table',
			datasetType: 'revenue',
			chains: [' optimism ', 'OP Mainnet', 'Base'],
			filters: {
				categories: [' Lending ', 'lending'],
				excludedCategories: [' CEX ', 'cex']
			},
			colSpan: 2
		})

		if (!migrated || migrated.kind !== 'unified-table') {
			throw new Error('Expected transitional Revenue table to migrate to Unified Table')
		}
		expect(migrated).toMatchObject({
			id: 'current-revenue',
			activePresetId: 'revenue-protocols',
			params: { chains: ['OP Mainnet', 'Base'] },
			filters: { categories: ['Lending'], excludedCategories: ['CEX'] },
			colSpan: 2
		})
	})

	it('preserves supported row scope and drops obsolete dataset filters from historical table configs', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'historical-fees',
			kind: 'table',
			tableType: 'dataset',
			datasetType: 'fees',
			chains: [' xDai ', 'Gnosis', 'Base'],
			filters: {
				categories: [' Dexs ', 'dexs'],
				excludedCategories: [' CEX ', 'cex'],
				tvlMin: 1_000_000
			}
		})

		if (!migrated || migrated.kind !== 'unified-table') {
			throw new Error('Expected historical Fees table to migrate to Unified Table')
		}
		expect(migrated).toMatchObject({
			id: 'historical-fees',
			activePresetId: 'fees-protocols',
			params: { chains: ['Gnosis', 'Base'] },
			filters: { categories: ['Dexs'], excludedCategories: ['CEX'] }
		})
		expect(migrated.filters).not.toHaveProperty('tvlMin')
	})

	it('dispatches migrated configs through the Unified Table stream source plan', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'current-earnings',
			kind: 'dataset-table',
			datasetType: 'earnings',
			chains: []
		})

		if (!migrated || migrated.kind !== 'unified-table') {
			throw new Error('Expected transitional Earnings table to migrate to Unified Table')
		}
		expect(buildUnifiedTableStreamSourcePlan([migrated])).toMatchObject([
			{
				supplementalMetrics: ['earnings'],
				rowMembership: { kind: 'supplemental-metric', metric: 'earnings' }
			}
		])
	})
})
