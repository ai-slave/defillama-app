import { describe, expect, test } from 'vitest'
import type { RWAPositionalChartDataset } from '../chartDataset'
import { spotAsset } from '../table/__tests__/fixtures'
import { buildRwaChainChartDataset, combineChainQueries } from '../useChainChartDataset'

const total: RWAPositionalChartDataset = { dimensions: ['timestamp', 'Total Active AUM'], source: [[1, 800_000]] }
const chains = ['Ethereum', 'Solana']
const EMPTY = { source: [], dimensions: ['timestamp'] }

const loaded = (value: number) => ({ data: [{ timestamp: 1, 'ondo/usdy': value }], error: null, isLoading: false })
const loading = { data: undefined, error: null, isLoading: true }
const failed = (message: string) => ({ data: undefined, error: new Error(message), isLoading: false })

function chainChart(results: Parameters<typeof combineChainQueries>[0], enabled = true) {
	return buildRwaChainChartDataset({
		enabled,
		chains,
		queries: combineChainQueries(results),
		assets: [spotAsset()],
		total
	})
}

describe('buildRwaChainChartDataset', () => {
	test('folds the histories into chain series once every chain has loaded', () => {
		expect(chainChart([loaded(600_000), loaded(200_000)])).toEqual({
			chartDataset: {
				dimensions: ['timestamp', 'Total Active AUM', 'Ethereum', 'Solana'],
				source: [[1, 800_000, 600_000, 200_000]]
			},
			isChartLoading: false,
			chartError: null
		})
	})

	test('waits for every chain before folding', () => {
		expect(chainChart([loaded(600_000), loading])).toEqual({
			chartDataset: EMPTY,
			isChartLoading: true,
			chartError: null
		})
	})

	test('drops a failed chain into Others', () => {
		expect(chainChart([loaded(600_000), failed('no solana')])).toEqual({
			chartDataset: {
				dimensions: ['timestamp', 'Total Active AUM', 'Ethereum', 'Others'],
				source: [[1, 800_000, 600_000, 200_000]]
			},
			isChartLoading: false,
			chartError: null
		})
	})

	test('errors only when every chain failed', () => {
		expect(chainChart([failed('no ethereum'), failed('no solana')])).toEqual({
			chartDataset: EMPTY,
			isChartLoading: false,
			chartError: 'no ethereum'
		})
	})

	test('returns an empty dataset while disabled', () => {
		expect(chainChart([loaded(600_000), loaded(200_000)], false)).toEqual({
			chartDataset: EMPTY,
			isChartLoading: false,
			chartError: null
		})
	})
})
