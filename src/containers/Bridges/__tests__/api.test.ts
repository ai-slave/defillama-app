import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ApiRequest } from '~/server/api/types'
import { fetchJson } from '~/utils/async'
import {
	fetchBridgeDayStats,
	fetchBridgeNetflows,
	fetchBridgeTransactionsClient,
	fetchBridgeVolumeAll,
	fetchBridgeVolumeByChain,
	fetchBridgeVolumeBySlug,
	fetchRawBridgeVolumeByChain
} from '../api'
import { bridgeTransactions } from '../server/api'

const serverMocks = vi.hoisted(() => ({
	fetchWithPoolingOnServer: vi.fn(),
	recordRouteRuntimeError: vi.fn()
}))

vi.mock('~/utils/async', () => ({
	fetchJson: vi.fn()
}))

vi.mock('~/constants', () => ({ BRIDGES_SERVER_URL: 'https://bridges.example.com' }))

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: serverMocks.fetchWithPoolingOnServer
}))

vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: serverMocks.recordRouteRuntimeError
}))

const rawTransaction = {
	tx_hash: '0xhash',
	ts: '2026-08-24T03:47:25.000Z',
	tx_block: 123,
	tx_from: '0xfrom',
	tx_to: '0xto',
	token: 'USDC',
	amount: '1',
	is_deposit: true,
	is_usd_volume: false,
	chain: 'Ethereum',
	bridge_name: 'circle',
	usd_value: null
}

function transactionRequest(query: ApiRequest['query']): ApiRequest {
	return {
		method: 'GET',
		url: '/api/public/bridges/transactions/51',
		headers: {},
		query
	}
}

describe('fetchBridgeDayStats', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
		vi.mocked(fetchJson).mockResolvedValue({
			date: 0,
			totalDepositedUSD: 0,
			totalWithdrawnUSD: 0,
			totalDepositTxs: 0,
			totalWithdrawalTxs: 0,
			totalTokensDeposited: {},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		})
	})

	test('uses UTC midnight in the request URL', async () => {
		const timestamp = Date.parse('2026-07-19T16:42:00Z') / 1000
		const utcMidnight = Date.parse('2026-07-19T00:00:00Z') / 1000

		await fetchBridgeDayStats(timestamp, 'Base')

		expect(fetchJson).toHaveBeenCalledOnce()
		expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining(`/bridgedaystats/${utcMidnight}/Base`))
	})
})

describe('fetchBridgeNetflows', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	test('normalizes finite nonblank numeric strings once at the API boundary', async () => {
		vi.mocked(fetchJson).mockResolvedValue([
			{ chain: 'Base', net_flow: '0.0', deposited_usd: '12.5', withdrawn_usd: '12.5' }
		])

		await expect(fetchBridgeNetflows('day')).resolves.toEqual([
			{ chain: 'Base', netFlow: 0, depositedUsd: 12.5, withdrawnUsd: 12.5 }
		])
	})
})

describe('fetchBridgeVolumeByChain', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	test('normalizes valid chart arrays, including empty arrays', async () => {
		const chart = [{ date: '1784678400', depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }]
		vi.mocked(fetchJson).mockResolvedValueOnce(chart).mockResolvedValueOnce([]).mockResolvedValueOnce(chart)

		await expect(fetchBridgeVolumeByChain('Arbitrum')).resolves.toEqual([
			{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }
		])
		await expect(fetchBridgeVolumeByChain('Zkfair')).resolves.toEqual([])
		await expect(fetchRawBridgeVolumeByChain('Base')).resolves.toBe(chart)
	})
})

describe('fetchBridgeVolumeAll', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	test('normalizes a valid bridge chart array', async () => {
		const chart = [{ date: '1784678400', depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }]
		vi.mocked(fetchJson).mockResolvedValue(chart)

		await expect(fetchBridgeVolumeAll(12)).resolves.toEqual([
			{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }
		])
	})
})

describe('fetchBridgeVolumeBySlug', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	test('normalizes every date in a valid slug response and preserves nullable legs', async () => {
		const response = {
			bridge: { id: 1, displayName: 'Across', slug: 'across', bridgeDbName: 'across' },
			dailyVolumes: [
				{ date: '1784678400', depositUSD: 10, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 },
				{ date: '1784764800', depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 }
			]
		}
		vi.mocked(fetchJson).mockResolvedValue(response)

		await expect(fetchBridgeVolumeBySlug('across')).resolves.toEqual({
			bridge: response.bridge,
			dailyVolumes: [
				{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 },
				{ date: 1_784_764_800, depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 }
			]
		})
	})

	test('preserves zero transaction counts', async () => {
		vi.mocked(fetchJson).mockResolvedValue({
			bridge: { id: 1, displayName: 'Across', slug: 'across', bridgeDbName: 'across' },
			dailyVolumes: [{ date: '1784678400', depositUSD: 0, withdrawUSD: 0, depositTxs: 0, withdrawTxs: 0 }]
		})

		await expect(fetchBridgeVolumeBySlug('across')).resolves.toMatchObject({
			dailyVolumes: [{ date: 1_784_678_400, depositUSD: 0, withdrawUSD: 0, depositTxs: 0, withdrawTxs: 0 }]
		})
	})
})

describe('fetchBridgeTransactionsClient', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	test('versions the first-page cache key with the producer limit and forwards the opaque cursor', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ rows: [], hasMore: false })

		await fetchBridgeTransactionsClient(51, 100, 200)
		await fetchBridgeTransactionsClient(51, 100, 200, 'opaque_cursor-1')

		expect(fetchJson).toHaveBeenNthCalledWith(
			1,
			'/api/public/bridges/transactions/51?starttimestamp=100&endtimestamp=200&limit=10000'
		)
		expect(fetchJson).toHaveBeenNthCalledWith(
			2,
			'/api/public/bridges/transactions/51?starttimestamp=100&endtimestamp=200&limit=10000&cursor=opaque_cursor-1'
		)
	})
})

describe('bridge transactions API route', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test('forwards exact cursor paging and returns normalized metadata with no-store', async () => {
		serverMocks.fetchWithPoolingOnServer.mockResolvedValue(
			new Response(JSON.stringify([rawTransaction]), {
				headers: { 'X-Has-More': 'true', 'X-Next-Cursor': 'next_cursor-2' }
			})
		)

		const result = await bridgeTransactions.handle(
			transactionRequest({ id: '51', starttimestamp: '100', endtimestamp: '200', cursor: 'current_cursor-1' })
		)

		expect(serverMocks.fetchWithPoolingOnServer).toHaveBeenCalledWith(
			'https://bridges.example.com/transactions/51?starttimestamp=100&endtimestamp=200&limit=10000&cursor=current_cursor-1',
			{ cache: 'no-store' }
		)
		expect(result).toEqual({
			status: 200,
			body: { rows: [rawTransaction], hasMore: true, nextCursor: 'next_cursor-2' },
			headers: { 'Cache-Control': 'no-store' }
		})
	})

	test('keeps a successful empty terminal page distinct from failure', async () => {
		serverMocks.fetchWithPoolingOnServer.mockResolvedValue(
			new Response(JSON.stringify([]), { headers: { 'X-Has-More': 'false' } })
		)

		await expect(
			bridgeTransactions.handle(transactionRequest({ id: 'all', starttimestamp: '100', endtimestamp: '200' }))
		).resolves.toEqual({
			status: 200,
			body: { rows: [], hasMore: false },
			headers: { 'Cache-Control': 'no-store' }
		})
	})

	test('rejects missing continuation metadata as upstream failure', async () => {
		serverMocks.fetchWithPoolingOnServer.mockResolvedValue(
			new Response(JSON.stringify([rawTransaction]), { headers: { 'X-Has-More': 'true' } })
		)

		const result = await bridgeTransactions.handle(
			transactionRequest({ id: '51', starttimestamp: '100', endtimestamp: '200' })
		)

		expect(result).toEqual({ status: 502, body: { error: 'Failed to fetch bridge transactions' } })
		expect(serverMocks.recordRouteRuntimeError).toHaveBeenCalledOnce()
	})

	test('rejects invalid route input before calling the producer', async () => {
		await expect(
			bridgeTransactions.handle(transactionRequest({ id: 'circle', starttimestamp: '100', endtimestamp: '200' }))
		).resolves.toEqual({ status: 400, body: { error: 'id parameter must be a bridge id or all' } })
		expect(serverMocks.fetchWithPoolingOnServer).not.toHaveBeenCalled()
	})

	test.each([
		{
			query: { id: '51', starttimestamp: '100.5', endtimestamp: '200' },
			error: 'starttimestamp and endtimestamp must be valid integer seconds'
		},
		{
			query: { id: '51', starttimestamp: '200', endtimestamp: '200' },
			error: 'starttimestamp must be less than endtimestamp'
		},
		{
			query: { id: '51', starttimestamp: '100', endtimestamp: '200', cursor: 'invalid cursor' },
			error: 'cursor parameter is invalid'
		}
	])('rejects invalid transaction query input: $error', async ({ query, error }) => {
		await expect(bridgeTransactions.handle(transactionRequest(query))).resolves.toEqual({
			status: 400,
			body: { error }
		})
		expect(serverMocks.fetchWithPoolingOnServer).not.toHaveBeenCalled()
	})

	test('maps producer non-success responses to unavailable', async () => {
		serverMocks.fetchWithPoolingOnServer.mockResolvedValue(new Response(null, { status: 503 }))

		const result = await bridgeTransactions.handle(
			transactionRequest({ id: '51', starttimestamp: '100', endtimestamp: '200' })
		)

		expect(result).toEqual({ status: 502, body: { error: 'Failed to fetch bridge transactions' } })
		expect(serverMocks.recordRouteRuntimeError).toHaveBeenCalledOnce()
	})
})
