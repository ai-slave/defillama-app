import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { RWAPositionalChartDataset } from '../chartDataset'
import { spotAsset } from '../table/__tests__/fixtures'
import { useRwaChainChartDataset } from '../useChainChartDataset'

const useQueriesMock = vi.fn()
const fetchJsonMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
	useQueries: (options: unknown) => useQueriesMock(options),
	useQuery: vi.fn()
}))

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: Array<unknown>) => fetchJsonMock(...args)
}))

type QueryOptions = { queryKey: Array<unknown>; queryFn: () => Promise<unknown>; enabled: boolean }
type QueryResult = { data: unknown; isLoading: boolean; error: unknown }
type UseQueriesArgs = { queries: Array<QueryOptions>; combine: (results: Array<QueryResult>) => unknown }

/** Runs the hook's combine over one mocked result per query, the way React Query does. */
function mockResults(make: (query: QueryOptions, index: number) => QueryResult) {
	useQueriesMock.mockImplementation(({ queries, combine }: UseQueriesArgs) => combine(queries.map(make)))
}

const total: RWAPositionalChartDataset = {
	dimensions: ['timestamp', 'Total Active Mcap'],
	source: [[1, 800_000]]
}

function Probe(props: Parameters<typeof useRwaChainChartDataset>[0]) {
	const result = useRwaChainChartDataset(props)
	return <pre>{JSON.stringify(result)}</pre>
}

function render(props: Parameters<typeof useRwaChainChartDataset>[0]) {
	const markup = renderToStaticMarkup(<Probe {...props} />)
	return JSON.parse(markup.replace(/^<pre>|<\/pre>$/g, '').replace(/&quot;/g, '"'))
}

beforeEach(() => {
	useQueriesMock.mockReset()
	fetchJsonMock.mockReset()
})

describe('useRwaChainChartDataset', () => {
	test('asks for one chain history per ranked chain through the asset chart route', async () => {
		mockResults(() => ({ data: undefined, isLoading: true, error: null }))
		const result = render({
			metric: 'activeMcap',
			assets: [spotAsset()],
			includeStablecoins: false,
			includeGovernance: true,
			includeBridgeTvl: true,
			total,
			enabled: true
		})
		const { queries } = useQueriesMock.mock.calls[0]![0] as UseQueriesArgs
		expect(queries.map((query) => query.queryKey)).toEqual([
			['rwa-asset-chart', 'chain', 'ethereum', 'activeMcap', false, true, true],
			['rwa-asset-chart', 'chain', 'solana', 'activeMcap', false, true, true]
		])
		expect(queries.every((query) => query.enabled)).toBe(true)
		await queries[0]!.queryFn()
		expect(fetchJsonMock.mock.calls[0]![0]).toBe(
			'/api/public/rwa/asset-breakdown?key=activeMcap&includeStablecoin=false&includeGovernance=true&includeBridgeTvl=true&chain=ethereum'
		)
		expect(result).toEqual({
			chartDataset: { source: [], dimensions: ['timestamp'] },
			isChartLoading: true,
			chartError: null
		})
	})

	test('folds the histories into chain series once every chain has loaded', () => {
		mockResults((query) => ({
			data: [{ timestamp: 1, 'ondo/usdy': query.queryKey[2] === 'ethereum' ? 600_000 : 200_000 }],
			isLoading: false,
			error: null
		}))
		const result = render({
			metric: 'activeMcap',
			assets: [spotAsset()],
			includeStablecoins: false,
			includeGovernance: false,
			includeBridgeTvl: true,
			total,
			enabled: true
		})
		expect(result).toEqual({
			chartDataset: {
				dimensions: ['timestamp', 'Total Active Mcap', 'Ethereum', 'Solana'],
				source: [[1, 800_000, 600_000, 200_000]]
			},
			isChartLoading: false,
			chartError: null
		})
	})

	test('asks for nothing and returns an empty dataset while disabled', () => {
		mockResults(() => ({ data: undefined, isLoading: false, error: null }))
		const result = render({
			metric: 'activeMcap',
			assets: [spotAsset()],
			includeStablecoins: false,
			includeGovernance: false,
			includeBridgeTvl: true,
			total,
			enabled: false
		})
		expect((useQueriesMock.mock.calls[0]![0] as UseQueriesArgs).queries).toEqual([])
		expect(result.chartDataset).toEqual({ source: [], dimensions: ['timestamp'] })
	})

	test('drops a failed chain into Others and errors only when every chain failed', () => {
		mockResults((query, index) =>
			index === 1
				? { data: undefined, isLoading: false, error: new Error(`no ${String(query.queryKey[2])}`) }
				: { data: [{ timestamp: 1, 'ondo/usdy': 600_000 }], isLoading: false, error: null }
		)
		const oneFailed = render({
			metric: 'activeMcap',
			assets: [spotAsset()],
			includeStablecoins: false,
			includeGovernance: false,
			includeBridgeTvl: true,
			total,
			enabled: true
		})
		expect(oneFailed).toEqual({
			chartDataset: {
				dimensions: ['timestamp', 'Total Active Mcap', 'Ethereum', 'Others'],
				source: [[1, 800_000, 600_000, 200_000]]
			},
			isChartLoading: false,
			chartError: null
		})

		mockResults((query) => ({ data: undefined, isLoading: false, error: new Error(`no ${String(query.queryKey[2])}`) }))
		const allFailed = render({
			metric: 'activeMcap',
			assets: [spotAsset()],
			includeStablecoins: false,
			includeGovernance: false,
			includeBridgeTvl: true,
			total,
			enabled: true
		})
		expect(allFailed.chartDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(allFailed.chartError).toBe('no ethereum')
	})

	test('waits for every chain before folding', () => {
		mockResults((query, index) =>
			index === 0
				? { data: [{ timestamp: 1, 'ondo/usdy': 600_000 }], isLoading: false, error: null }
				: { data: undefined, isLoading: true, error: null }
		)
		const result = render({
			metric: 'activeMcap',
			assets: [spotAsset()],
			includeStablecoins: false,
			includeGovernance: false,
			includeBridgeTvl: true,
			total,
			enabled: true
		})
		expect(result.chartDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.isChartLoading).toBe(true)
	})
})
