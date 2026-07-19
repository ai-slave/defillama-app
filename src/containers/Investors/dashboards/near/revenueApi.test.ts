import { describe, expect, it } from 'vitest'
import { extractNearRevenueSeries, type RevenueAPIResponse } from './revenueApi'

function responseWithSeries(revenueSeries: Array<{ name: string; data: number[] }>): RevenueAPIResponse {
	const chart = (series: Array<{ name: string; data: number[] }>) => ({
		title: 'chart',
		dates: ['2026-07-17', '2026-07-18'],
		series
	})

	return {
		metadata: { projectName: 'NEAR', updatedAt: '2026-07-18T00:00:00Z' },
		fees: {
			feesChart: chart([
				{ name: 'Intent Fees', data: [1, 2] },
				{ name: 'Protocol Fees', data: [3, 4] }
			]),
			kpis: {}
		},
		revenue: { revenueChart: chart(revenueSeries), kpis: {} },
		emissions: {
			revenueVsEmissionsChart: chart([{ name: 'Daily Emissions', data: [11, 12] }]),
			percentageChart: chart([]),
			kpis: {
				latestRevenue: { value: 0, formatted: '0' },
				latestEmissions: { value: 0, formatted: '0' },
				latestPercentage: { value: 0, formatted: '0' }
			}
		}
	}
}

describe('extractNearRevenueSeries', () => {
	it('uses the current API Intents Revenue series and combines unequal series lengths', () => {
		const result = extractNearRevenueSeries(
			responseWithSeries([
				{ name: 'Intents Revenue', data: [5, 6] },
				{ name: 'Protocol Revenue (70% Burned)', data: [7] },
				{ name: 'Cumulative Total', data: [12, 18] }
			])
		)

		expect(result.intentRevenue).toEqual([5, 6])
		expect(result.totalRevenue).toEqual([12, 6])
		expect(result.totalFees).toEqual([4, 6])
		expect(result.dailyEmissions).toEqual([11, 12])
	})

	it('supports cached responses with the legacy wallet-level revenue series', () => {
		const result = extractNearRevenueSeries(
			responseWithSeries([
				{ name: 'fefundsadmin', data: [2, 3] },
				{ name: '1csfundsadmin', data: [4, 5] }
			])
		)

		expect(result.intentRevenue).toEqual([6, 8])
	})
})
