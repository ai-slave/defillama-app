import { describe, expect, it } from 'vitest'
import { addNetworkFeeToIncomeStatement, carryForwardCumulative, chartToDataset, sumDailySeries } from './transform'

describe('chartToDataset', () => {
	it('guards broad date labels and zero-fills a missing parallel value', () => {
		const dataset = chartToDataset({
			dates: ['Total', '2026-01-01'],
			series: [{ name: 'Revenue', data: [10] }]
		})

		expect(dataset).toEqual({
			dimensions: ['timestamp', 'Revenue'],
			source: [[1_767_225_600_000, 0]]
		})
	})
})

describe('sumDailySeries', () => {
	it('adds overlapping days and keeps the union sorted', () => {
		expect(
			sumDailySeries([
				[
					[200, 5],
					[100, 1]
				],
				[[100, 2]]
			])
		).toEqual([
			[100, 3],
			[200, 5]
		])
	})
})

describe('carryForwardCumulative', () => {
	it('holds each series flat across days it did not report, and at 0 before its first', () => {
		expect(
			carryForwardCumulative([
				{
					name: 'A',
					points: [
						[1, 10],
						[3, 30]
					] as Array<[number, number]>
				},
				{ name: 'B', points: [[2, 5]] as Array<[number, number]> }
			])
		).toEqual([
			{
				name: 'A',
				points: [
					[1, 10],
					[2, 10],
					[3, 30]
				]
			},
			{
				name: 'B',
				points: [
					[1, 0],
					[2, 5],
					[3, 5]
				]
			}
		])
	})
})

describe('addNetworkFeeToIncomeStatement', () => {
	// 2026-01-15 UTC — lands in 2026-01 / 2026-Q1 / 2026 / cumulative.
	const JAN_15_2026 = 1_768_435_200

	const statement = () =>
		({
			data: {
				monthly: { '2026-01': { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } } },
				quarterly: { '2026-Q1': { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } } },
				yearly: { '2026': { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } } },
				cumulative: { cumulative: { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } } }
			},
			labelsByType: { 'Gross Protocol Revenue': ['Swap'] },
			methodology: {},
			breakdownMethodology: {},
			hasOtherTokenHolderFlows: false,
			hasTokenHolderNetIncome: false
		}) as unknown as NonNullable<
			import('~/containers/ProtocolOverview/types').IProtocolOverviewPageData['incomeStatement']
		>

	it('adds the fee to every period bucket without mutating the source', () => {
		const source = statement()
		const merged = addNetworkFeeToIncomeStatement(source, [[JAN_15_2026, 10]])!

		for (const [group, period] of [
			['monthly', '2026-01'],
			['quarterly', '2026-Q1'],
			['yearly', '2026'],
			['cumulative', 'cumulative']
		] as const) {
			const entry = merged.data[group][period]['Gross Protocol Revenue']
			expect(entry.value).toBe(110)
			expect(entry['by-label']).toEqual({ Swap: 100, 'Network Fee': 10 })
		}
		expect(merged.labelsByType['Gross Protocol Revenue']).toEqual(['Swap', 'Network Fee'])
		// Lines the dex statement doesn't carry are created rather than dropped.
		expect(merged.data.monthly['2026-01']['Gross Profit'].value).toBe(10)
		expect(merged.data.monthly['2026-01']['Earnings'].value).toBe(10)
		expect(source.data.monthly['2026-01']['Gross Protocol Revenue'].value).toBe(100)
	})

	it('fills in a by-label map on lines that arrive as a bare total', () => {
		const source = statement()
		source.data.monthly['2026-01']['Gross Profit'] = {
			value: 40
		} as (typeof source.data.monthly)['2026-01']['Gross Profit']

		const merged = addNetworkFeeToIncomeStatement(source, [[JAN_15_2026, 10]])!

		expect(merged.data.monthly['2026-01']['Gross Profit']).toEqual({ value: 50, 'by-label': { 'Network Fee': 10 } })
	})

	it('drops days outside the periods the statement covers', () => {
		const merged = addNetworkFeeToIncomeStatement(statement(), [[JAN_15_2026 - 365 * 86400, 10]])!
		expect(merged.data.monthly['2026-01']['Gross Protocol Revenue'].value).toBe(100)
	})
})
