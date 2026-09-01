import { describe, expect, it } from 'vitest'
import { buildPreIpoValuationChart } from '../chartData'

const TODAY = Date.UTC(2026, 8, 1)

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
			],
			TODAY
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
		expect(chart?.xAxisMaxTimestamp).toBe(TODAY)
	})

	it('renders funding rounds when monthly valuations are absent', () => {
		const chart = buildPreIpoValuationChart(
			[],
			[
				{
					date: '2025-02-01',
					amountRaised: 20,
					valuation: 200,
					series: 'Series A'
				},
				{
					date: '2025-01-01',
					amountRaised: 10,
					valuation: 100,
					series: 'Seed'
				}
			],
			TODAY
		)

		expect(chart?.charts.map((series) => series.name)).toEqual(['Round valuation', 'Raised'])
		expect(chart?.charts[0]?.data).toEqual([
			[Date.UTC(2025, 0, 1), 100],
			[Date.UTC(2025, 1, 1), 200]
		])
		expect(chart?.charts[1]?.data).toEqual([
			[Date.UTC(2025, 0, 1), 10],
			[Date.UTC(2025, 1, 1), 20]
		])
	})

	it('omits round valuation when every funding valuation is unavailable', () => {
		const chart = buildPreIpoValuationChart(
			[],
			[{ date: '2025-01-01', amountRaised: 10, valuation: null, series: 'Seed' }],
			TODAY
		)

		expect(chart?.charts.map((series) => series.name)).toEqual(['Raised'])
		expect(chart?.charts[0]?.data).toEqual([[Date.UTC(2025, 0, 1), 10]])
	})

	it('renders only monthly valuations when funding rounds are absent', () => {
		const chart = buildPreIpoValuationChart([{ date: '2025-01-01', estimatedValuation: 1_000 }], [], TODAY)

		expect(chart?.charts.map((series) => series.name)).toEqual(['Monthly valuation'])
		expect(chart?.charts[0]?.data).toEqual([[Date.UTC(2025, 0, 1), 1_000]])
	})

	it('keeps future observations visible beyond today', () => {
		const chart = buildPreIpoValuationChart(
			[],
			[{ date: '2027-01-01', amountRaised: 10, valuation: 100, series: 'Seed' }],
			TODAY
		)

		expect(chart?.xAxisMaxTimestamp).toBe(Date.UTC(2027, 0, 1))
	})

	it('uses the empty-chart state when valuations and funding rounds are absent', () => {
		expect(buildPreIpoValuationChart([], [], TODAY)).toBeNull()
	})
})
