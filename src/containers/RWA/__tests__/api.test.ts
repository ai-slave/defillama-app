import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_SERVER_URL } from '~/constants'
import {
	buildRWAAssetBreakdownPath,
	buildRWAAssetChartDataset,
	fetchRWAAssetBreakdownRows,
	fetchRWAAssetChartData,
	fetchRWACurrentListing,
	fetchRWAChartMetricDataByAsset,
	normalizeRWAChartMetricRows,
	rwaRowsInMilliseconds,
	rwaUnixSecondsToMilliseconds
} from '../api'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return { ...actual, fetchJson: mocks.fetchJson }
})

beforeEach(() => {
	mocks.fetchJson.mockReset()
})

const requestedUrls = () => mocks.fetchJson.mock.calls.map(([url]) => url)

describe('RWA api timestamp normalization', () => {
	test('turns the timestamps of chart rows into milliseconds and keeps the values', () => {
		expect(
			rwaRowsInMilliseconds([
				{ timestamp: 1, alpha: 10 },
				{ timestamp: 2, alpha: 20 }
			])
		).toEqual([
			{ timestamp: 1000, alpha: 10 },
			{ timestamp: 2000, alpha: 20 }
		])
	})

	test("converts the API's unix-second timestamps to milliseconds", () => {
		expect(rwaUnixSecondsToMilliseconds(1_774_483_200)).toBe(1_774_483_200_000)
	})
})

describe('RWA metric history normalization', () => {
	test('normalizes only the requested metric and preserves sparse, zero, and negative values', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [
						{ timestamp: 1000, Alpha: 0, Beta: -4 },
						{ timestamp: 2000, Alpha: 5 }
					],
					onChainMcap: [{ timestamp: 1000, Alpha: 100 }],
					defiActiveTvl: [],
					bridgeTvl: []
				},
				'activeMcap'
			)
		).toEqual([
			{ timestamp: 1_000_000, Alpha: 0, Beta: -4 },
			{ timestamp: 2_000_000, Alpha: 5 }
		])
	})

	test('returns an empty history when the selected metric has no rows', () => {
		expect(
			normalizeRWAChartMetricRows(
				{ activeMcap: [], onChainMcap: [], defiActiveTvl: [], bridgeTvl: [] },
				'defiActiveTvl'
			)
		).toEqual([])
	})

	test('subtracts the bridge portion from defiActiveTvl when includeBridgeTvl is false', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [
						{ timestamp: 1000, Alpha: 100, Beta: 40 },
						{ timestamp: 2000, Alpha: 10 }
					],
					bridgeTvl: [
						{ timestamp: 1000, Alpha: 30, Beta: 30 },
						{ timestamp: 2000, Alpha: 0 }
					]
				},
				'defiActiveTvl',
				false
			)
		).toEqual([
			{ timestamp: 1_000_000, Alpha: 70, Beta: 10 },
			{ timestamp: 2_000_000, Alpha: 10 }
		])
	})

	test('rejects an excluded history when its required bridge leg is missing', () => {
		expect(() =>
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [{ timestamp: 1000, Alpha: 100 }]
				},
				'defiActiveTvl',
				false
			)
		).toThrow('RWA bridge TVL history is unavailable')
	})

	test('keeps defiActiveTvl unchanged when includeBridgeTvl is true (default)', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [{ timestamp: 1000, Alpha: 100 }],
					bridgeTvl: [{ timestamp: 1000, Alpha: 30 }]
				},
				'defiActiveTvl'
			)
		).toEqual([{ timestamp: 1_000_000, Alpha: 100 }])
	})
})

describe('RWA asset chart construction', () => {
	test('constructs the canonical positional history once while preserving gaps, negatives, and duplicate timestamps', () => {
		expect(
			buildRWAAssetChartDataset([
				{
					timestamp: 1000,
					defiActiveTvl: null,
					activeMcap: -2,
					onChainMcap: 0,
					totalSupply: null
				},
				{
					timestamp: 1000,
					defiActiveTvl: 3,
					activeMcap: 4,
					onChainMcap: null,
					totalSupply: 5
				}
			])
		).toEqual({
			dimensions: ['timestamp', 'DeFi Active TVL', 'Active AUM', 'Onchain AUM'],
			source: [
				[1_000_000, null, -2, 0],
				[1_000_000, 3, 4, null]
			]
		})
	})
})

describe('fetchRWACurrentListing', () => {
	const listingRow = { id: '1', canonicalMarketId: 'alpha', ticker: 'ALPHA', stablecoin: false, governance: false }

	test('reads the listing and fills in the empty values it leaves out', async () => {
		mocks.fetchJson.mockResolvedValueOnce([
			listingRow,
			{ ...listingRow, id: '2', price: 1.5, onChainMcap: { Ethereum: 3 } }
		])

		const rows = await fetchRWACurrentListing()

		expect(requestedUrls()).toEqual([`${RWA_SERVER_URL}/current?lite=true`])
		expect(rows[0]).toEqual({ ...listingRow, price: null, onChainMcap: {}, defiActiveTvl: {}, bridgeTvlBreakdown: {} })
		expect(rows[1]).toMatchObject({ price: 1.5, onChainMcap: { Ethereum: 3 }, defiActiveTvl: {} })
	})
})

describe('buildRWAAssetBreakdownPath', () => {
	test('forwards both inclusion flags to the scope asset-breakdown route', () => {
		expect(
			buildRWAAssetBreakdownPath({
				target: { kind: 'category', slug: 'rwa-yield-wrapper' },
				includeStablecoins: false,
				includeGovernance: true
			})
		).toBe('/chart/category/rwa-yield-wrapper/asset-breakdown?includeStablecoin=false&includeGovernance=true')
	})

	test('reads every asset from the all-chains route', () => {
		expect(
			buildRWAAssetBreakdownPath({ target: { kind: 'all' }, includeStablecoins: true, includeGovernance: true })
		).toBe('/chart/chain/all/asset-breakdown?includeStablecoin=true&includeGovernance=true')
	})
})

describe('fetchRWAAssetBreakdownRows', () => {
	const path = '/chart/chain/ethereum/asset-breakdown?includeStablecoin=true&includeGovernance=false'
	const request = {
		target: { kind: 'chain', slug: 'ethereum' },
		includeStablecoins: true,
		includeGovernance: false
	} as const

	test('asks for the one metric and returns its rows as served', async () => {
		mocks.fetchJson.mockResolvedValueOnce([{ timestamp: 1, alpha: 10 }])

		await expect(fetchRWAAssetBreakdownRows({ ...request, metric: 'activeMcap' })).resolves.toEqual([
			{ timestamp: 1, alpha: 10 }
		])
		expect(requestedUrls()).toEqual([`${RWA_SERVER_URL}${path}&key=activeMcap`])
	})

	test('subtracts the bridge rows when bridge TVL is left out of DeFi TVL', async () => {
		mocks.fetchJson.mockImplementation((url: string) =>
			Promise.resolve(
				url.endsWith('key=bridgeTvl') ? [{ timestamp: 1, alpha: 7 }] : [{ timestamp: 1, alpha: 20, beta: 5 }]
			)
		)

		await expect(
			fetchRWAAssetBreakdownRows({ ...request, metric: 'defiActiveTvl', includeBridgeTvl: false })
		).resolves.toEqual([{ timestamp: 1, alpha: 13, beta: 5 }])
		expect(requestedUrls()).toEqual([
			`${RWA_SERVER_URL}${path}&key=defiActiveTvl`,
			`${RWA_SERVER_URL}${path}&key=bridgeTvl`
		])
	})
})

describe('fetchRWAAssetChartData', () => {
	const liteRow = { timestamp: 1000, onChainMcap: 12, activeMcap: 10, defiActiveTvl: 2, totalSupply: 12 }
	const dataset = {
		dimensions: ['timestamp', 'DeFi Active TVL', 'Active AUM', 'Onchain AUM'],
		source: [[1_000_000, 2, 10, 12]]
	}

	test('asks for the chart without the chain maps', async () => {
		mocks.fetchJson.mockResolvedValueOnce([liteRow])

		await expect(fetchRWAAssetChartData('USDT 1')).resolves.toEqual(dataset)
		expect(requestedUrls()).toEqual([`${RWA_SERVER_URL}/chart/asset/USDT%201?excludeChains=true`])
	})
})

describe('fetchRWAChartMetricDataByAsset', () => {
	test('answers null and names the failing chain in the log when the history fails', async () => {
		const log = vi.spyOn(console, 'error').mockImplementationOnce(() => {})
		mocks.fetchJson.mockRejectedValueOnce(new Error('[500] upstream'))

		await expect(
			fetchRWAChartMetricDataByAsset({
				target: { kind: 'chain', slug: 'solana' },
				metric: 'activeMcap',
				includeStablecoins: true,
				includeGovernance: true
			})
		).resolves.toBeNull()
		expect(log.mock.calls[0]?.[0]).toContain('solana')
	})
})
