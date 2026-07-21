import { describe, expect, it } from 'vitest'
import { buildBlockchainViewModel, type BlockchainAPIResponse } from './blockchainApi'

function buildResponse(): BlockchainAPIResponse {
	const formattedValue = { value: 1, formatted: '1' }

	return {
		metadata: {
			projectName: 'Berachain',
			updatedAt: '2026-07-18',
			links: { website: 'https://berachain.com' }
		},
		blockchain: {
			chainActivity: {
				title: 'Chain Activity',
				dates: ['2026-07-16', '2026-07-17'],
				series: [
					{ name: 'Transactions', data: [10, 20] },
					{ name: 'Active Addresses', data: [4, 8] },
					{ name: 'New Addresses', data: [2] },
					{ name: 'Ignored Activity', data: [99, 99] }
				]
			},
			activityKpis: {
				latestTxCount: formattedValue,
				latestActiveAddresses: formattedValue,
				avgDailyTxs7d: formattedValue,
				avgDailyTxs30d: formattedValue,
				totalTxsAllTime: formattedValue
			},
			gasFees: {
				title: 'Gas Fees',
				dates: ['2026-07-16'],
				series: [
					{ name: 'Total Fees (USD)', data: [3] },
					{ name: 'Ignored Gas Series', data: [100] }
				]
			},
			gasKpis: {
				totalFees7d: formattedValue,
				totalFees30d: formattedValue,
				totalFeesAllTime: formattedValue,
				avgFeePerTx: formattedValue
			},
			blockUtilization: {
				title: 'Block Utilization',
				dates: ['2026-07-16'],
				series: [{ name: 'Utilization %', data: [75] }]
			},
			contractDeployments: {
				title: 'Contract Deployments',
				dates: ['2026-07-16'],
				series: [{ name: 'New Contracts', data: [5] }]
			},
			tokenTransfers: {
				title: 'Token Transfers',
				dates: ['2026-07-16'],
				series: [
					{ name: 'Transfer Count', data: [6] },
					{ name: 'Volume (USD)', data: [7] }
				]
			},
			topTokens: [
				{
					symbol: 'BERA',
					contractAddress: '0x1',
					transferCount: 10,
					volumeUsd: 20,
					volumeFormatted: '$20',
					uniqueSenders: 3
				}
			]
		}
	}
}

describe('buildBlockchainViewModel', () => {
	it('builds the chart datasets once and excludes raw chart payloads from the cached model', () => {
		const response = buildResponse()
		const result = buildBlockchainViewModel(response)

		expect(result.metadata).toBe(response.metadata)
		expect(result.activityKpis).toBe(response.blockchain.activityKpis)
		expect(result.gasKpis).toBe(response.blockchain.gasKpis)
		expect(result.topTokens).toBe(response.blockchain.topTokens)
		expect(result).not.toHaveProperty('chainActivity')
		expect(result).not.toHaveProperty('gasFees')
		expect(result).not.toHaveProperty('blockUtilization')
		expect(result).not.toHaveProperty('contractDeployments')
		expect(result).not.toHaveProperty('tokenTransfers')
	})

	it('preserves the selected series, UTC dates, zero-fill, and shared activity source', () => {
		const result = buildBlockchainViewModel(buildResponse())
		const { chartDatasets } = result

		expect(chartDatasets.transactions.dimensions).toEqual(['timestamp', 'Transactions'])
		expect(chartDatasets.addresses.dimensions).toEqual(['timestamp', 'Active Addresses', 'New Addresses'])
		expect(chartDatasets.transactions.source).not.toBe(chartDatasets.addresses.source)
		expect(chartDatasets.transactions.source).toEqual([
			[Date.UTC(2026, 6, 16), 10],
			[Date.UTC(2026, 6, 17), 20]
		])
		expect(chartDatasets.addresses.source).toEqual([
			[Date.UTC(2026, 6, 16), 4, 2],
			[Date.UTC(2026, 6, 17), 8, 0]
		])
		expect(chartDatasets.gasFees).toEqual({
			dimensions: ['timestamp', 'Total Fees (USD)'],
			source: [[Date.UTC(2026, 6, 16), 3]]
		})
		expect(chartDatasets.blockUtilization.dimensions).toEqual(['timestamp', 'Utilization %'])
		expect(chartDatasets.contractDeployments.dimensions).toEqual(['timestamp', 'New Contracts'])
		expect(chartDatasets.tokenTransfers).toEqual({
			dimensions: ['timestamp', 'Volume (USD)'],
			source: [[Date.UTC(2026, 6, 16), 7]]
		})
	})
})
