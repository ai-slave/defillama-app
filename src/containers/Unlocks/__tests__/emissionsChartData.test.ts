import { describe, expect, it } from 'vitest'
import type { EmissionsChartRow } from '../api.types'
import { processGroupedChartData, sortStacksByVolatility } from '../emissionsChartData'

function createRow(timestamp: number): EmissionsChartRow {
	return { timestamp }
}

describe('emissions chart data transforms', () => {
	it('groups categories with case-insensitive first-match semantics', () => {
		const row = createRow(1)
		row.Team = 10
		row.team = 20
		row.Price = 2
		row['Market Cap'] = 200

		const [result] = processGroupedChartData([row], { Allocation: ['team'] })

		expect(result).toEqual({
			timestamp: 1,
			Price: 2,
			'Market Cap': 200,
			Allocation: 10
		})
	})

	it('sorts stacks by volatility without mutating their input order', () => {
		const first = createRow(1)
		first.volatile = 0
		first.moderate = 0
		first.steady = 2
		const second = createRow(2)
		second.volatile = 10
		second.moderate = 5
		second.steady = 2
		const stacks = ['moderate', 'volatile', 'steady']

		expect(sortStacksByVolatility(stacks, [first, second])).toEqual(['volatile', 'moderate', 'steady'])
		expect(stacks).toEqual(['moderate', 'volatile', 'steady'])
	})
})
