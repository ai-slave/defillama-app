import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { withRouteTelemetry } from '~/utils/telemetry'
import { installTelemetrySink } from '~/utils/test/telemetry'
import {
	fetchAdapterChainChartData,
	fetchAdapterChainMetrics,
	fetchAdapterChainProtocolTotals,
	fetchCexVolume
} from '../api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'

const http = installTelemetrySink()

describe('dimension adapter API', () => {
	test.each([
		{
			adapterType: ADAPTER_TYPES.DEXS,
			chain: 'Litecoin',
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
			category: 'Dexes',
			path: '/metrics/dexs/category/dexes/chain/litecoin'
		},
		{ adapterType: ADAPTER_TYPES.DEXS, chain: 'All', dataType: undefined, category: undefined, path: '/metrics/dexs' }
	])('fetches $chain metrics and publishes their dimension context', async ({ path, ...selection }) => {
		http.serve({ [`${V2_SERVER_URL}${path}`]: { protocols: [{ name: 'A', total24h: 25 }], allChains: ['Litecoin'] } })
		const result = await withRouteTelemetry(
			{ route: '/metrics-test', operationType: 'getStaticProps', runtime: 'build' },
			() => fetchAdapterChainMetrics(selection)
		)
		expect(result.protocols).toEqual([{ name: 'A', total24h: 25 }])
		const outbound = (await http.events()).find((event) => event.type === 'outbound_http_request')!
		expect(outbound).toMatchObject({
			status: 'success',
			timeout_ms: 30_000,
			attributes: { adapter_type: selection.adapterType, chain: selection.chain }
		})
		expect(outbound.attributes?.data_type).toBe(selection.dataType)
		expect(outbound.attributes?.category).toBe(selection.category)
		expect(http.requests[0]!.url.searchParams.get('dataType')).toBe(selection.dataType ?? null)
	})

	test('projects only protocol totals needed by chain tables', async () => {
		http.serve({
			[`${V2_SERVER_URL}/metrics/fees`]: {
				allChains: ['Ethereum'],
				protocols: [
					{
						defillamaId: 'chain#ethereum',
						displayName: 'Ethereum',
						total24h: 1,
						total7d: 7,
						total30d: 30,
						methodology: { Fees: 'unused' }
					}
				]
			}
		})
		await expect(fetchAdapterChainProtocolTotals({ adapterType: ADAPTER_TYPES.FEES, chain: 'All' })).resolves.toEqual({
			protocols: [{ defillamaId: 'chain#ethereum', displayName: 'Ethereum', total24h: 1, total7d: 7, total30d: 30 }]
		})
	})

	test('fetches selected chain chart values and publishes dimension context', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chart/derivatives/chain/xdc`]: [
				[1, 20],
				[2, 0]
			]
		})
		const result = await withRouteTelemetry(
			{ route: '/chart-test', operationType: 'getStaticProps', runtime: 'build' },
			() =>
				fetchAdapterChainChartData({
					adapterType: ADAPTER_TYPES.PERPS,
					chain: 'XDC',
					dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME
				})
		)
		expect(result).toEqual([
			[1, 20],
			[2, 0]
		])
		expect((await http.events()).find((event) => event.type === 'outbound_http_request')).toMatchObject({
			timeout_ms: 30_000,
			attributes: { adapter_type: 'derivatives', chain: 'XDC', data_type: 'dailyVolume' }
		})
	})
})

describe('CEX volume in USD', () => {
	test.each([
		{ volume: 0, expected: 0 },
		{ volume: 2, expected: 100_000 },
		{ volume: undefined, expected: null }
	])('preserves $volume BTC volume as $expected USD', async ({ volume, expected }) => {
		http.serve({
			'/api/v3/exchanges': [{ trust_score: 9, trade_volume_24h_btc: volume }],
			'/api/v3/simple/price': { bitcoin: { usd: 50_000 } }
		})
		await expect(fetchCexVolume()).resolves.toBe(expected)
	})
})
