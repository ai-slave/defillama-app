import { describe, expect, it } from 'vitest'
import type { DashboardStreamChunk } from '~/containers/ProDashboard/dashboardStreamContract'
import type { ProDashboardTableSource } from '~/containers/ProDashboard/tableSourcePlan'
import { auditProDashboardTableSources } from './proDashboardTableAudit'

describe('auditProDashboardTableSources', () => {
	it('reports exact missing, duplicate, unexpected, and empty table identities', () => {
		const expected: ProDashboardTableSource[] = [
			{
				chunkType: 'tableData',
				key: '["pro-dashboard","protocols-volume-by-chain","Base"]'
			},
			{
				chunkType: 'stablecoinsTableData',
				key: '["pro-dashboard","stablecoins-overview","Base"]'
			},
			{
				chunkType: 'rwaChainsTableData',
				key: '["pro-dashboard","rwa-chains-table"]'
			}
		]
		const chunks: DashboardStreamChunk[] = [
			{
				type: 'tableData',
				data: {
					protocolsList: null,
					volumeByChain: { Base: { chain: 'Base', protocols: [] } },
					feesByChain: {},
					perpsByChain: {},
					openInterestByChain: {},
					datasetsByQueryKey: {},
					tokenUsageByQueryKey: {}
				}
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
			}
		]

		const result = auditProDashboardTableSources(expected, chunks)

		expect(result.missing).toEqual(['rwaChainsTableData:["pro-dashboard","rwa-chains-table"]'])
		expect(result.duplicate).toEqual(['stablecoinsTableData:["pro-dashboard","stablecoins-overview","Base"]'])
		expect(result.unexpected).toEqual(['chainsDatasetData:["pro-dashboard","chains-overview","all"]'])
		expect(result.empty).toEqual(
			expect.arrayContaining([
				'tableData:["pro-dashboard","protocols-volume-by-chain","Base"]',
				'stablecoinsTableData:["pro-dashboard","stablecoins-overview","Base"]'
			])
		)
	})
})
