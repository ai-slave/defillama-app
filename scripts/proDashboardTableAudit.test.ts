import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { DashboardStreamChunk } from '~/containers/ProDashboard/dashboardStreamContract'
import { auditProDashboardTableSources } from './proDashboardTableAudit'
import { buildProDashboardTableSourcePlan, type ProDashboardTableSource } from './proDashboardTableSourcePlan'

describe('buildProDashboardTableSourcePlan', () => {
	test('shares one RWA asset source across global and selected-chain tables', () => {
		const items: Array<DashboardItemConfig> = [
			{ id: 'all-assets', kind: 'dataset-table', datasetType: 'rwa' },
			{ id: 'ethereum-assets', kind: 'dataset-table', datasetType: 'rwa-selected-chain', chain: 'Ethereum' },
			{ id: 'base-assets', kind: 'dataset-table', datasetType: 'rwa-selected-chain', chain: 'Base' }
		]

		expect(buildProDashboardTableSourcePlan(items).streamSources).toEqual([
			{
				chunkType: 'rwaAssetsTableData',
				key: '["pro-dashboard","rwa-assets-table"]'
			}
		])
	})
})

describe('auditProDashboardTableSources', () => {
	test('reports exact missing, duplicate, unexpected, and empty table identities', () => {
		const expected: Array<ProDashboardTableSource> = [
			{
				chunkType: 'tokenUsageData',
				key: '["pro-dashboard","token-usage",["USDC"],false]'
			},
			{
				chunkType: 'stablecoinsTableData',
				key: '["pro-dashboard","stablecoins-overview","Base"]'
			},
			{
				chunkType: 'unifiedTableData',
				key: '["pro-dashboard","unified-table","fees"]'
			},
			{
				chunkType: 'rwaChainsTableData',
				key: '["pro-dashboard","rwa-chains-table"]'
			}
		]
		const chunks: Array<DashboardStreamChunk> = [
			{
				type: 'tokenUsageData',
				key: '["pro-dashboard","token-usage",["USDC"],false]',
				data: []
			},
			{
				type: 'stablecoinsTableData',
				key: '["pro-dashboard","stablecoins-overview","Base"]',
				data: []
			},
			{
				type: 'stablecoinsTableData',
				key: '["pro-dashboard","stablecoins-overview","Base"]',
				data: []
			},
			{
				type: 'chainsDatasetData',
				key: '["pro-dashboard","chains-overview","all"]',
				data: []
			},
			{
				type: 'unifiedTableData',
				key: '["pro-dashboard","unified-table","fees"]',
				data: { strategy: 'protocols', rows: [], parentMetrics: {} }
			}
		]

		const result = auditProDashboardTableSources(expected, chunks)

		expect(result.missing).toEqual(['rwaChainsTableData:["pro-dashboard","rwa-chains-table"]'])
		expect(result.duplicate).toEqual(['stablecoinsTableData:["pro-dashboard","stablecoins-overview","Base"]'])
		expect(result.unexpected).toEqual(['chainsDatasetData:["pro-dashboard","chains-overview","all"]'])
		expect(result.empty).toEqual(
			expect.arrayContaining([
				'tokenUsageData:["pro-dashboard","token-usage",["USDC"],false]',
				'stablecoinsTableData:["pro-dashboard","stablecoins-overview","Base"]'
			])
		)
	})
})
