import { describe, expect, it } from 'vitest'
import { buildProDashboardTableSourcePlan } from './tableSourcePlan'
import type { DashboardItemConfig } from './types'

function datasetTable(id: string, config: Partial<Extract<DashboardItemConfig, { kind: 'table' }>>) {
	return {
		id,
		kind: 'table',
		tableType: 'dataset',
		chains: [],
		...config
	} as Extract<DashboardItemConfig, { kind: 'table' }>
}

describe('buildProDashboardTableSourcePlan', () => {
	it('deduplicates shared sources while preserving normalized table identities', () => {
		const items: DashboardItemConfig[] = [
			datasetTable('revenue-a', { datasetType: 'revenue', chains: ['All'] }),
			datasetTable('revenue-b', { datasetType: 'revenue', chains: [] }),
			datasetTable('old-stables', { datasetChain: 'Base' }),
			datasetTable('rwa-default', { datasetType: 'rwa-selected-chain' }),
			datasetTable('equity-a', { datasetType: 'equities-financials', datasetChain: 'AAPL' }),
			datasetTable('equity-b', { datasetType: 'equities-financials', datasetChain: 'AAPL:US' }),
			datasetTable('trending', {
				datasetType: 'trending-contracts',
				datasetChain: 'Ethereum',
				datasetTimeframe: '7d'
			})
		]

		const plan = buildProDashboardTableSourcePlan(items)
		const identities = plan.streamSources.map((source) => `${source.chunkType}:${source.key}`)

		expect(identities.filter((identity) => identity.includes('revenue-overview'))).toHaveLength(1)
		expect(identities).toContain('stablecoinsTableData:["pro-dashboard","stablecoins-overview","Base"]')
		expect(identities).toContain('rwaChainAssetsTableData:["pro-dashboard","rwa-chain-assets-table","Ethereum"]')
		expect(identities.filter((identity) => identity.includes('equities-statements-table'))).toHaveLength(1)
		expect(plan.clientOnlySources).toEqual(['["pro-dashboard","trending-contracts","7d","ethereum"]'])
	})

	it('plans one bulk fetch identity for duplicate legacy and token-usage tables', () => {
		const items: DashboardItemConfig[] = [
			{
				id: 'legacy-a',
				kind: 'table',
				tableType: 'protocols',
				chains: ['Base']
			},
			{
				id: 'legacy-b',
				kind: 'table',
				tableType: 'protocols',
				chains: ['Base']
			},
			datasetTable('tokens-a', {
				datasetType: 'token-usage',
				tokenSymbols: ['USDC', 'USDT'],
				includeCex: false
			}),
			datasetTable('tokens-b', {
				datasetType: 'token-usage',
				tokenSymbols: ['usdt', 'usdc'],
				includeCex: false
			})
		]

		const keys = buildProDashboardTableSourcePlan(items).streamSources.map((source) => source.key)

		expect(keys.filter((key) => key.includes('protocols-volume-by-chain'))).toHaveLength(1)
		expect(keys.filter((key) => key.includes('token-usage'))).toHaveLength(1)
	})

	it('plans both aggregate and specific legacy sources when separate tables need them', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'all', kind: 'table', tableType: 'protocols', chains: ['All'] },
			{ id: 'ethereum', kind: 'table', tableType: 'protocols', chains: ['Ethereum'] }
		]
		const keys = buildProDashboardTableSourcePlan(items).streamSources.map((source) => source.key)

		expect(keys).toContain('["pro-dashboard","protocols-volume-by-chain","All"]')
		expect(keys).toContain('["pro-dashboard","protocols-volume-by-chain","Ethereum"]')
		expect(keys).toContain('["pro-dashboard","protocols-fees-revenue-by-chain","Ethereum"]')
		expect(keys).toContain('["pro-dashboard","protocols-perps-volume-by-chain","Ethereum"]')
		expect(keys).toContain('["pro-dashboard","protocols-open-interest-by-chain","Ethereum"]')
	})
})
