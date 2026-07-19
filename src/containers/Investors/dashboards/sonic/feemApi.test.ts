import { describe, expect, it } from 'vitest'
import { buildFeeMViewModel, type FeeMAPIResponse } from './feemApi'

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
	it('caches only the KPIs, leaderboard, title, and legacy chart series', () => {
		const response = buildResponse()
		const result = buildFeeMViewModel(response)

		expect(Object.keys(result)).toEqual(['globalKpis', 'leaderboard', 'dailyStatsSeries', 'dailyStatsTitle'])
		expect(result.globalKpis).toBe(response.feem.globalKpis)
		expect(result.leaderboard).toBe(response.feem.leaderboard)
		expect(result.dailyStatsTitle).toBe('Daily FeeM Activity')
		expect(result).not.toHaveProperty('metadata')
		expect(result).not.toHaveProperty('dailyStats')
	})

	it('preserves series order, UTC-second timestamps, axes, colors, and area styles', () => {
		const result = buildFeeMViewModel(buildResponse())
		const firstTimestamp = Date.UTC(2026, 6, 16) / 1000
		const secondTimestamp = Date.UTC(2026, 6, 17) / 1000

		expect(result.dailyStatsSeries).toEqual([
			{
				name: 'Transactions',
				type: 'bar',
				color: '#4691ce',
				data: [
					[firstTimestamp, 10],
					[secondTimestamp, 20]
				],
				yAxisIndex: 0,
				areaStyle: undefined
			},
			{
				name: 'Rewards',
				type: 'line',
				color: '#4cae4f',
				data: [
					[firstTimestamp, 1],
					[secondTimestamp, 2]
				],
				yAxisIndex: 1,
				areaStyle: { opacity: 0 }
			},
			{
				name: 'Other',
				type: 'line',
				color: '#4cae4f',
				data: [
					[firstTimestamp, 3],
					[secondTimestamp, 4]
				],
				yAxisIndex: 1,
				areaStyle: undefined
			}
		])
	})

	it('preserves chart configs when the daily history is empty', () => {
		const response = buildResponse()
		response.feem.dailyStats.dates = []
		response.feem.dailyStats.series = [{ name: 'Transactions', data: [] }]
		const result = buildFeeMViewModel(response)

		expect(result.dailyStatsSeries).toEqual([
			{
				name: 'Transactions',
				type: 'bar',
				color: '#4691ce',
				data: [],
				yAxisIndex: 0,
				areaStyle: undefined
			}
		])
	})
})
