import { describe, expect, it } from 'vitest'
import { buildEtherfiCashTvlData } from './api'

describe('Ether.fi chart data', () => {
	it('derives TVL and signed inflows from the production tuple response', () => {
		const raw = [
			[1_000, 100],
			[2_000, 130],
			[3_000, 120]
		] as const
		const result = buildEtherfiCashTvlData([...raw])

		expect(result).toEqual({
			tvlDataset: {
				dimensions: ['timestamp', 'TVL'],
				source: [
					{ timestamp: 1_000, TVL: 100 },
					{ timestamp: 2_000, TVL: 130 },
					{ timestamp: 3_000, TVL: 120 }
				]
			},
			inflowsDataset: {
				dimensions: ['timestamp', 'USD Inflows'],
				source: [
					{ timestamp: 2_000, 'USD Inflows': 30 },
					{ timestamp: 3_000, 'USD Inflows': -10 }
				]
			},
			previousTvl: 130,
			previousInflow: 30
		})
		expect(raw).toEqual([
			[1_000, 100],
			[2_000, 130],
			[3_000, 120]
		])
	})

	it('keeps empty datasets dimensioned for their chart configurations', () => {
		expect(buildEtherfiCashTvlData([])).toEqual({
			tvlDataset: { source: [], dimensions: ['timestamp', 'TVL'] },
			inflowsDataset: { source: [], dimensions: ['timestamp', 'USD Inflows'] },
			previousTvl: null,
			previousInflow: null
		})
	})
})
