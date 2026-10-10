import { describe, expect, test, vi } from 'vitest'
import type { RWAPositionalChartDataset } from '../chartDataset'
import { spotAsset } from '../table/__tests__/fixtures'
import { buildRwaChainChartDataset, combineChainQueries } from '../useChainChartDataset'

const total: RWAPositionalChartDataset = { dimensions: ['timestamp', 'Total Active AUM'], source: [[1, 800_000]] }
const chains = ['Ethereum', 'Solana']
const EMPTY = { source: [], dimensions: ['timestamp'] }

const settledQuery = { isPlaceholderData: false, isLoading: false, isFetching: false, refetch: vi.fn() }
const loaded = (value: number) => ({
	...settledQuery,
	data: [{ timestamp: 1, 'ondo/usdy': value }],
	errorUpdatedAt: 0,
	dataUpdatedAt: 1
})
const loading = {
	...settledQuery,
	data: undefined,
	errorUpdatedAt: 0,
	dataUpdatedAt: 0,
	isLoading: true,
	isFetching: true
}
const failed = () => ({ ...settledQuery, refetch: vi.fn(), data: undefined, errorUpdatedAt: 1, dataUpdatedAt: 0 })
// A retry from an error moves the query back to pending: isLoading again, while the attempt times keep the failure.
const retrying = () => ({ ...failed(), isLoading: true, isFetching: true })

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
			failedRead: null
		})
	})

	test('waits for every chain before folding', () => {
		expect(chainChart([loaded(600_000), loading])).toEqual({
			chartDataset: EMPTY,
			isChartLoading: true,
			failedRead: null
		})
	})

	test('drops a failed chain into Others', () => {
		expect(chainChart([loaded(600_000), failed()])).toEqual({
			chartDataset: {
				dimensions: ['timestamp', 'Total Active AUM', 'Ethereum', 'Others'],
				source: [[1, 800_000, 600_000, 200_000]]
			},
			isChartLoading: false,
			failedRead: null
		})
	})

	test('keeps a chain whose refetch failed over its loaded history', () => {
		expect(chainChart([loaded(600_000), { ...loaded(200_000), errorUpdatedAt: 2 }])).toEqual({
			chartDataset: {
				dimensions: ['timestamp', 'Total Active AUM', 'Ethereum', 'Solana'],
				source: [[1, 800_000, 600_000, 200_000]]
			},
			isChartLoading: false,
			failedRead: null
		})
	})

	test('errors only when every chain failed, and its Try again reruns each chain', () => {
		const ethereum = failed()
		const solana = failed()
		const chart = chainChart([ethereum, solana])
		expect([chart.chartDataset, chart.isChartLoading, chart.failedRead?.isFetching]).toEqual([EMPTY, false, false])
		chart.failedRead?.refetch()
		expect([ethereum.refetch.mock.calls.length, solana.refetch.mock.calls.length]).toEqual([1, 1])
	})

	test('keeps the error while a retry runs', () => {
		const chart = chainChart([retrying(), retrying()])
		expect([chart.chartDataset, chart.failedRead?.isFetching]).toEqual([EMPTY, true])
	})

	test('folds the loaded chains while a retried chain still runs', () => {
		const chart = chainChart([loaded(600_000), retrying()])
		expect([chart.chartDataset.dimensions, chart.failedRead]).toEqual([
			['timestamp', 'Total Active AUM', 'Ethereum', 'Others'],
			null
		])
	})

	test('returns an empty dataset while disabled', () => {
		expect(chainChart([loaded(600_000), loaded(200_000)], false)).toEqual({
			chartDataset: EMPTY,
			isChartLoading: false,
			failedRead: null
		})
	})
})
