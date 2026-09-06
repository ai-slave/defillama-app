import { describe, expect, test } from 'vitest'
import { buildEtherfiCashTvlData } from './api'

describe('Ether.fi chart data', () => {
	test('derives TVL and signed inflows from the production tuple response', () => {
		const raw = [
			[1000, 100],
			[2000, 130],
			[3000, 120]
		] as const
		const result = buildEtherfiCashTvlData([...raw])

		expect(result).toEqual({
			tvlDataset: {
				dimensions: ['timestamp', 'TVL'],
				source: [
					[1000, 100],
					[2000, 130],
					[3000, 120]
				]
			},
			inflowsDataset: {
				dimensions: ['timestamp', 'USD Inflows'],
				source: [
					[2000, 30],
					[3000, -10]
				]
			},
			previousTvl: 130,
			previousInflow: 30
		})
		expect(raw).toEqual([
			[1000, 100],
			[2000, 130],
			[3000, 120]
		])
	})

	test('keeps empty datasets dimensioned for their chart configurations', () => {
		expect(buildEtherfiCashTvlData([])).toEqual({
			tvlDataset: { source: [], dimensions: ['timestamp', 'TVL'] },
			inflowsDataset: { source: [], dimensions: ['timestamp', 'USD Inflows'] },
			previousTvl: null,
			previousInflow: null
		})
	})
})
