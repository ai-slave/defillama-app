import { describe, expect, it } from 'vitest'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
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
			[2, 82, 23],
			[4, 44, 61]
		])
		expect(buildRuntimePieChartPresentation({ series: result.pieSeries }).chartData).toEqual([
			{ name: 'Solana', value: 61 },
			{ name: 'Ethereum', value: 44 }
		])
		expect(result.chainSeries).toEqual(['Solana', 'Ethereum'])
		expect(result.dominanceCharts.charts.map((chart) => chart.name)).toEqual(['Solana', 'Ethereum'])
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
		expect(buildRuntimePieChartPresentation({ series: result.pieSeries }).chartData).toEqual([
			{ name: 'Solana', value: 75 },
			{ name: 'Ethereum', value: 25 }
		])
		expect(result.chainSeries).toEqual(['Solana', 'Ethereum'])
	})

	it('appends historical chains with no current TVL after the current-TVL ranking', () => {
		const result = buildChainsByCategoryChartPresentation({
			tvlChartsByChain: {
				tvl: {
					Ethereum: { 1: 100, 2: 90 },
					Solana: { 1: 50, 2: 110 },
					Historical: { 1: 25, 2: 0 }
				}
			},
			totalTvlByDate: { tvl: { 1: 175, 2: 200 } },
			colorsByChain: {},
			enabledTvlSettings: []
		})

		expect(result.pieSeries.peers.map((peer) => peer.name)).toEqual(['Solana', 'Ethereum'])
		expect(result.chainSeries).toEqual(['Solana', 'Ethereum', 'Historical'])
		expect(result.dominanceCharts.charts.map((chart) => chart.name)).toEqual(['Solana', 'Ethereum', 'Historical'])
	})
})
