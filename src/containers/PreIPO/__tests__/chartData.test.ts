import { describe, expect, it } from 'vitest'
import { buildPreIpoValuationChart } from '../chartData'

describe('pre-IPO valuation chart', () => {
	it('preserves monthly valuations, nullable rounds, and same-date funding events', () => {
		const chart = buildPreIpoValuationChart(
			[
				{ date: '2025-01-01', estimatedValuation: 1_000 },
				{ date: '2025-02-01', estimatedValuation: 2_000 }
			],
			[
				{
					date: '2025-01-15',
					amountRaised: 10,
					valuation: null,
					series: 'Seed'
				},
				{
					date: '2025-01-15',
					amountRaised: 25,
					valuation: 1_500,
					series: 'Series A'
				}
			]
		)

		expect(chart).not.toBeNull()
		expect(chart?.charts[0]?.data).toEqual([
			[Date.UTC(2025, 0, 1), 1_000],
			[Date.UTC(2025, 1, 1), 2_000]
		])
		expect(chart?.charts[1]).toMatchObject({
			step: 'end',
			lineStyle: { type: 'dashed' }
		})
		expect(chart?.charts[1]?.data).toEqual([
			[Date.UTC(2025, 0, 15), null],
			[Date.UTC(2025, 0, 15), 1_500]
		])
		expect(chart?.charts[2]?.data).toEqual([
			[Date.UTC(2025, 0, 15), 10],
			[Date.UTC(2025, 0, 15), 25]
		])
	})

	it('uses the intentional empty-chart state when monthly valuations are absent', () => {
		expect(
			buildPreIpoValuationChart(
				[],
				[
					{
						date: '2025-01-01',
						amountRaised: 10,
						valuation: 100,
						series: 'Seed'
					}
				]
			)
		).toBeNull()
	})
})
