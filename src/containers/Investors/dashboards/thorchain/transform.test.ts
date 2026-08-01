import { describe, expect, it } from 'vitest'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { addNetworkFeeToIncomeStatement, carryForwardCumulative, chartToDataset, sumDailySeries } from './transform'

describe('chartToDataset', () => {
	it('skips category labels while keeping aligned time-series values', () => {
		const dataset = chartToDataset({
			dates: ['Total', '2026-01-01'],
			series: [{ name: 'Revenue', data: [10, 20] }]
		})

		expect(dataset).toEqual({
			dimensions: ['timestamp', 'Revenue'],
			source: [[1_767_225_600_000, 20]]
		})
	})

	it('rejects a time-series value missing from a parallel series', () => {
		expect(() =>
			chartToDataset({
				dates: ['2026-01-01'],
				series: [{ name: 'Revenue', data: [] }]
			})
		).toThrow('Expected Revenue data for 2026-01-01')
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
	type IncomeStatementData = NonNullable<IProtocolOverviewPageData['incomeStatement']>

	const statement = (): IncomeStatementData => ({
		data: {
			monthly: {
				'2026-01': {
					timestamp: Date.parse('2026-01-01'),
					values: { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } }
				}
			},
			quarterly: {
				'2026-Q1': {
					timestamp: Date.parse('2026-01-01'),
					values: { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } }
				}
			},
			yearly: {
				'2026': {
					timestamp: Date.parse('2026-01-01'),
					values: { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } }
				}
			},
			cumulative: {
				cumulative: {
					timestamp: Date.parse('2026-01-01'),
					values: { 'Gross Protocol Revenue': { value: 100, 'by-label': { Swap: 100 } } }
				}
			}
		},
		labelsByType: { 'Gross Protocol Revenue': ['Swap'] },
		methodology: {},
		breakdownMethodology: {},
		hasOtherTokenHolderFlows: false,
		hasTokenHolderNetIncome: false
	})

	const getPeriod = (
		incomeStatement: IncomeStatementData,
		group: keyof IncomeStatementData['data'],
		periodKey: string
	) => {
		const period = incomeStatement.data[group][periodKey]
		if (!period) throw new Error(`Expected ${group} period ${periodKey}`)
		return period
	}

	it('adds the fee to every period bucket without mutating the source', () => {
		const source = statement()
		const merged = addNetworkFeeToIncomeStatement(source, [[JAN_15_2026, 10]])
		if (!merged) throw new Error('Expected merged income statement')

		for (const [group, period] of [
			['monthly', '2026-01'],
			['quarterly', '2026-Q1'],
			['yearly', '2026'],
			['cumulative', 'cumulative']
		] as const) {
			const entry = getPeriod(merged, group, period).values['Gross Protocol Revenue']
			if (!entry) throw new Error('Expected gross protocol revenue')
			expect(entry.value).toBe(110)
			expect(entry['by-label']).toEqual({ Swap: 100, 'Network Fee': 10 })
		}
		expect(merged.labelsByType['Gross Protocol Revenue']).toEqual(['Swap', 'Network Fee'])
		// Lines the dex statement doesn't carry are created rather than dropped.
		expect(getPeriod(merged, 'monthly', '2026-01').values['Gross Profit']?.value).toBe(10)
		expect(getPeriod(merged, 'monthly', '2026-01').values['Earnings']?.value).toBe(10)
		expect(getPeriod(source, 'monthly', '2026-01').values['Gross Protocol Revenue']?.value).toBe(100)
	})

	it('fills in a by-label map on lines that arrive as a bare total', () => {
		const source = statement()
		getPeriod(source, 'monthly', '2026-01').values['Gross Profit'] = { value: 40 }

		const merged = addNetworkFeeToIncomeStatement(source, [[JAN_15_2026, 10]])
		if (!merged) throw new Error('Expected merged income statement')

		expect(getPeriod(merged, 'monthly', '2026-01').values['Gross Profit']).toEqual({
			value: 50,
			'by-label': { 'Network Fee': 10 }
		})
	})

	it('drops days outside the periods the statement covers', () => {
		const merged = addNetworkFeeToIncomeStatement(statement(), [[JAN_15_2026 - 365 * 86400, 10]])
		if (!merged) throw new Error('Expected merged income statement')
		expect(getPeriod(merged, 'monthly', '2026-01').values['Gross Protocol Revenue']?.value).toBe(100)
	})
})
