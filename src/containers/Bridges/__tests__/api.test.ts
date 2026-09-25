import { beforeEach, describe, expect, test } from 'vitest'
import { BRIDGES_SERVER_URL } from '~/constants'
import type { ApiRequest } from '~/server/api/types'
import { installTelemetrySink } from '~/utils/test/telemetry'
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

const telemetry = installTelemetrySink()

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
		telemetry.serve({
			[BRIDGES_SERVER_URL]: {
				date: 0,
				totalDepositedUSD: 0,
				totalWithdrawnUSD: 0,
				totalDepositTxs: 0,
				totalWithdrawalTxs: 0,
				totalTokensDeposited: {},
				totalTokensWithdrawn: {},
				totalAddressDeposited: {},
				totalAddressWithdrawn: {}
			}
		})
	})

	test('uses UTC midnight in the request URL', async () => {
		const timestamp = Date.parse('2026-07-19T16:42:00Z') / 1000
		const utcMidnight = Date.parse('2026-07-19T00:00:00Z') / 1000

		await fetchBridgeDayStats(timestamp, 'Base')

		expect(telemetry.requests).toHaveLength(1)
		expect(telemetry.urls()[0]).toContain(`/bridgedaystats/${utcMidnight}/Base`)
	})
})

describe('fetchBridgeNetflows', () => {
	test('normalizes finite nonblank numeric strings once at the API boundary', async () => {
		telemetry.serve({
			[BRIDGES_SERVER_URL]: [{ chain: 'Base', net_flow: '0.0', deposited_usd: '12.5', withdrawn_usd: '12.5' }]
		})

		await expect(fetchBridgeNetflows('day')).resolves.toEqual([
			{ chain: 'Base', netFlow: 0, depositedUsd: 12.5, withdrawnUsd: 12.5 }
		])
	})
})

describe('fetchBridgeVolumeByChain and fetchBridgeVolumeAll', () => {
	test('normalizes valid chart arrays, including empty arrays', async () => {
		const chart = [{ date: '1784678400', depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }]
		telemetry.serve({
			[`${BRIDGES_SERVER_URL}/bridgevolume/Arbitrum`]: chart,
			[`${BRIDGES_SERVER_URL}/bridgevolume/Zkfair`]: [],
			[`${BRIDGES_SERVER_URL}/bridgevolume/Base`]: chart,
			[`${BRIDGES_SERVER_URL}/bridgevolume/all`]: chart
		})

		await expect(fetchBridgeVolumeByChain('Arbitrum')).resolves.toEqual([
			{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }
		])
		await expect(fetchBridgeVolumeAll(12)).resolves.toEqual([
			{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }
		])
		await expect(fetchBridgeVolumeByChain('Zkfair')).resolves.toEqual([])
		await expect(fetchRawBridgeVolumeByChain('Base')).resolves.toEqual(chart)
	})
})

describe('fetchBridgeVolumeBySlug', () => {
	test('normalizes every date in a valid slug response and preserves nullable legs', async () => {
		const response = {
			bridge: { id: 1, displayName: 'Across', slug: 'across', bridgeDbName: 'across' },
			dailyVolumes: [
				{ date: '1784678400', depositUSD: 10, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 },
				{ date: '1784764800', depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 }
			]
		}
		telemetry.serve({ [BRIDGES_SERVER_URL]: response })

		await expect(fetchBridgeVolumeBySlug('across')).resolves.toEqual({
			bridge: response.bridge,
			dailyVolumes: [
				{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 },
				{ date: 1_784_764_800, depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 }
			]
		})
	})
})

describe('fetchBridgeTransactionsClient', () => {
	test('versions the first-page cache key with the producer limit and forwards the opaque cursor', async () => {
		telemetry.serve({ ['/api/public/bridges/transactions/51']: { rows: [], hasMore: false } })

		await fetchBridgeTransactionsClient(51, 100, 200)
		await fetchBridgeTransactionsClient(51, 100, 200, 'opaque_cursor-1')

		expect(telemetry.requests.map(({ url }) => url.pathname + url.search)).toEqual([
			'/api/public/bridges/transactions/51?starttimestamp=100&endtimestamp=200&limit=10000',
			'/api/public/bridges/transactions/51?starttimestamp=100&endtimestamp=200&limit=10000&cursor=opaque_cursor-1'
		])
	})
})

describe('bridge transactions API route', () => {
	test('forwards exact cursor paging and returns normalized metadata with no-store', async () => {
		telemetry.serve({
			[BRIDGES_SERVER_URL]: () =>
				new Response(JSON.stringify([rawTransaction]), {
					headers: { 'X-Has-More': 'true', 'X-Next-Cursor': 'next_cursor-2' }
				})
		})

		const result = await bridgeTransactions.handle(
			transactionRequest({ id: '51', starttimestamp: '100', endtimestamp: '200', cursor: 'current_cursor-1' })
		)

		expect(telemetry.urls()[0]).toBe(
			`${BRIDGES_SERVER_URL}/transactions/51?starttimestamp=100&endtimestamp=200&limit=10000&cursor=current_cursor-1`
		)
		expect(telemetry.requests[0].init?.cache).toBe('no-store')
		expect(result).toEqual({
			status: 200,
			body: { rows: [rawTransaction], hasMore: true, nextCursor: 'next_cursor-2' },
			headers: { 'Cache-Control': 'no-store' }
		})
	})

	test('keeps a successful empty terminal page distinct from failure', async () => {
		telemetry.serve({
			[BRIDGES_SERVER_URL]: () => new Response(JSON.stringify([]), { headers: { 'X-Has-More': 'false' } })
		})

		await expect(
			bridgeTransactions.handle(transactionRequest({ id: 'all', starttimestamp: '100', endtimestamp: '200' }))
		).resolves.toEqual({
			status: 200,
			body: { rows: [], hasMore: false },
			headers: { 'Cache-Control': 'no-store' }
		})
	})

	test('rejects missing continuation metadata as upstream failure', async () => {
		telemetry.serve({
			[BRIDGES_SERVER_URL]: () => new Response(JSON.stringify([rawTransaction]), { headers: { 'X-Has-More': 'true' } })
		})

		const result = await bridgeTransactions.handle(
			transactionRequest({ id: '51', starttimestamp: '100', endtimestamp: '200' })
		)

		expect(result).toEqual({ status: 502, body: { error: 'Failed to fetch bridge transactions' } })
		expect((await telemetry.events()).filter((event) => event.type === 'runtime_error')).toHaveLength(1)
	})

	test('rejects invalid route input before calling the producer', async () => {
		await expect(
			bridgeTransactions.handle(transactionRequest({ id: 'circle', starttimestamp: '100', endtimestamp: '200' }))
		).resolves.toEqual({ status: 400, body: { error: 'id parameter must be a bridge id or all' } })
		expect(telemetry.requests).toHaveLength(0)
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
		expect(telemetry.requests).toHaveLength(0)
	})

	test('maps producer non-success responses to unavailable', async () => {
		telemetry.serve({ [BRIDGES_SERVER_URL]: () => new Response(null, { status: 503 }) })

		const result = await bridgeTransactions.handle(
			transactionRequest({ id: '51', starttimestamp: '100', endtimestamp: '200' })
		)

		expect(result).toEqual({ status: 502, body: { error: 'Failed to fetch bridge transactions' } })
		expect((await telemetry.events()).filter((event) => event.type === 'runtime_error')).toHaveLength(1)
	})
})
