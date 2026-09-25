import { describe, expect, test } from 'vitest'
import { buildFeeMViewModel, type FeeMAPIResponse } from '../feemApi'

function buildResponse(): FeeMAPIResponse {
	const formattedValue = { value: 1, formatted: '1' }
	return {
		metadata: {
			projectId: 1,
			projectName: 'Sonic',
			updatedAt: '2026-07-18',
			links: { website: 'https://soniclabs.com' }
		},
		feem: {
			globalKpis: {
				totalContracts: formattedValue,
				totalTransactions: formattedValue,
				totalCollected: formattedValue,
				totalClaimed: formattedValue,
				gasMonetizationAddress: '0x1'
			},
			leaderboard: [
				{
					id: 1,
					name: 'App',
					imageUrl: null,
					websiteUrl: null,
					isActive: true,
					transactionsCount: 10,
					transactionsFormatted: '10',
					contractsCount: 2,
					collectedRewards: 3,
					collectedRewardsFormatted: '3 S',
					claimedRewards: 2,
					rewardsToClaim: 1
				}
			],
			dailyStats: {
				title: 'Daily FeeM Activity',
				dates: ['2026-07-16', '2026-07-17'],
				series: [
					{ name: 'Transactions', data: [10, 20] },
					{ name: 'Rewards', data: [1, 2] },
					{ name: 'Other', data: [3, 4] }
				]
			}
		}
	}
}

describe('buildFeeMViewModel', () => {
	test('preserves series order, UTC-second timestamps, axes, colors, and area styles', () => {
		const result = buildFeeMViewModel(buildResponse())
		const firstTimestamp = Date.UTC(2026, 6, 16)
		const secondTimestamp = Date.UTC(2026, 6, 17)

		expect(result.dailyStatsModel.dataset).toEqual({
			dimensions: ['timestamp', 'Transactions', 'Rewards', 'Other'],
			source: [
				[firstTimestamp, 10, 1, 3],
				[secondTimestamp, 20, 2, 4]
			]
		})
		expect(result.dailyStatsModel.charts).toEqual([
			expect.objectContaining({
				name: 'Transactions',
				type: 'bar',
				color: '#4691ce',
				yAxisIndex: 0,
				valueSymbol: ''
			}),
			expect.objectContaining({
				name: 'Rewards',
				type: 'line',
				color: '#4cae4f',
				yAxisIndex: 1,
				valueSymbol: 'S',
				areaStyle: { opacity: 0 }
			}),
			expect.objectContaining({
				name: 'Other',
				type: 'line',
				color: '#4cae4f',
				yAxisIndex: 1
			})
		])
		expect(result.dailyStatsLength).toBe(2)
	})

	test('keeps an empty chart with its series when the daily history is empty', () => {
		const response = buildResponse()
		response.feem.dailyStats.dates = []
		response.feem.dailyStats.series = [{ name: 'Transactions', data: [] }]
		const result = buildFeeMViewModel(response)

		expect(result.dailyStatsModel.dataset.source).toEqual([])
		expect(result.dailyStatsModel.charts.map((series) => series.name)).toEqual(['Transactions'])
	})
})
