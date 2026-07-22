import { describe, expect, it } from 'vitest'
import { buildChainsByCategoryChartPresentation } from '../index'

describe('chains by category chart presentation', () => {
	it('uses a sampled latest date for both dominance and pie values', () => {
		const result = buildChainsByCategoryChartPresentation({
			tvlChartsByChain: {
				tvl: {
					Ethereum: { 1: 60, 2: 80, 3: 30, 4: 40 },
					Solana: { 1: 40, 2: 20, 3: 70, 4: 60 }
				},
				staking: {
					Ethereum: { 1: 1, 2: 2, 3: 3, 4: 4 },
					Solana: { 1: 4, 2: 3, 3: 2, 4: 1 }
				}
			},
			totalTvlByDate: {
				tvl: { 1: 100, 2: 100, 3: 100, 4: 100 },
				staking: { 1: 5, 2: 5, 3: 5, 4: 5 }
			},
			colorsByChain: { Ethereum: '#111', Solana: '#222' },
			enabledTvlSettings: ['staking']
		})

		expect(result.dominanceCharts.dataset.source).toEqual([
			[2, (82 / 105) * 100, (23 / 105) * 100],
			[4, (44 / 105) * 100, (61 / 105) * 100]
		])
		expect(result.pieChartData.map(({ name, value }) => ({ name, value }))).toEqual([
			{ name: 'Solana', value: 61 },
			{ name: 'Ethereum', value: 44 }
		])
	})

	it('retains an unsampled latest date for the pie without appending a dominance row', () => {
		const result = buildChainsByCategoryChartPresentation({
			tvlChartsByChain: {
				tvl: {
					Ethereum: { 1: 60, 2: 80, 3: 30, 4: 40, 5: 25 },
					Solana: { 1: 40, 2: 20, 3: 70, 4: 60, 5: 75 }
				}
			},
			totalTvlByDate: { tvl: { 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 } },
			colorsByChain: { Ethereum: '#111', Solana: '#222' },
			enabledTvlSettings: []
		})

		expect(result.dominanceCharts.dataset.source).toEqual([
			[2, 80, 20],
			[4, 40, 60]
		])
		expect(result.pieChartData.map(({ name, value }) => ({ name, value }))).toEqual([
			{ name: 'Solana', value: 75 },
			{ name: 'Ethereum', value: 25 }
		])
	})
})
