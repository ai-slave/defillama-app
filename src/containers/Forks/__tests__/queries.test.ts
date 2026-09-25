import { beforeEach, describe, expect, test } from 'vitest'
import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { installFixtureFetch, fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { getForksByProtocolPageData, getForksListPageData } from '../queries'

const unmeasuredFork = {
	name: 'Unmeasured Fork',
	symbol: 'FORK',
	logo: null,
	url: '',
	chains: [],
	chainTvls: {},
	tvl: null,
	tvlPrevDay: null,
	tvlPrevWeek: null,
	tvlPrevMonth: null,
	mcap: null,
	defillamaId: 'unmeasured-fork',
	geckoId: null,
	category: 'Dexs',
	forkedFrom: ['Aave V3']
} satisfies ProtocolLite

const http = installFixtureFetch()
const metadata = installMetadataSeeder()
beforeEach(() => {
	metadata.seed({
		chainMetadata: {},
		protocolMetadata: {
			aave: { name: 'aave-v3', displayName: 'Aave V3', forks: true }
		},
		protocolRouteIdBySlug: { 'aave-v3': 'aave' }
	})
	http.serve({
		'/lite/protocols2': { protocols: [], parentProtocols: [], chains: [], protocolCategories: [] },
		'/v2/metrics/fork': { 'Aave V3': ['Seamless V1'], Curve: ['Convex'] },
		'/v2/chart/fork/protocol-breakdown': [{ timestamp: 1, 'Aave V3': 5, Curve: 10 }],
		'/v2/metrics/fees': { protocols: [], allChains: [] },
		'/v2/metrics/dexs': { protocols: [], allChains: [] },
		'/v2/chart/dexs': [],
		'/emissionsBreakdownAggregated': { protocols: [] }
	})
})

describe('getForksListPageData', () => {
	test('treats omitted current default TVL as zero', async () => {
		http.serve({
			'/v2/metrics/fork': { Omitted: [], Explicit: [] },
			'/v2/chart/fork/protocol-breakdown': [{ timestamp: 1, Explicit: 0 }]
		})

		const result = await getForksListPageData()

		expect(result?.tableData).toEqual([
			{
				name: 'Omitted',
				logo: null,
				deprecated: false,
				tvl: 0,
				forkedProtocols: 0,
				parentTvl: null,
				ftot: null
			},
			{ name: 'Explicit', logo: null, deprecated: false, tvl: 0, forkedProtocols: 0, parentTvl: null, ftot: null }
		])
	})

	test('counts current Fork relationships even when the metrics cache has no measurement', async () => {
		http.serve({ '/v2/metrics/fork': { 'Aave V3': [] } })
		http.serve({
			'/lite/protocols2': {
				protocols: [unmeasuredFork],
				parentProtocols: [],
				chains: [],
				protocolCategories: []
			}
		})
		http.serve({ '/v2/chart/fork/protocol-breakdown': [] })

		const result = await getForksListPageData()

		expect(result?.tableData[0]?.forkedProtocols).toBe(1)
	})
})

describe('getForksByProtocolPageData', () => {
	test('resolves a route slug to the producer canonical Fork identity', async () => {
		metadata.seed({
			protocolMetadata: {
				aave: { name: 'aave-v3', displayName: 'Aave V3', forks: true },
				'unmeasured-fork': {
					name: 'unmeasured-fork',
					displayName: 'Unmeasured Fork',
					chains: ['Ethereum'],
					category: 'Dexs'
				},
				unrelated: { name: 'unrelated', displayName: 'Unrelated', chains: ['Ethereum'], category: 'Dexs' }
			}
		})
		http.serve({
			'/lite/protocols2': {
				protocols: [
					unmeasuredFork,
					{ ...unmeasuredFork, name: 'Unrelated', defillamaId: 'unrelated', forkedFrom: ['Curve'], tvl: 1000 }
				],
				parentProtocols: [],
				chains: [],
				protocolCategories: []
			}
		})
		const result = await getForksByProtocolPageData({ fork: 'aave-v3' })

		expect(result).toMatchObject({
			status: 'success',
			data: {
				fork: 'Aave V3',
				forkLinks: [
					{ label: 'All', to: '/forks' },
					{ label: 'Curve', to: '/forks/curve' },
					{ label: 'Aave V3', to: '/forks/aave-v3' }
				],
				protocolTableData: [{ name: 'Unmeasured Fork', tvl: { default: { tvl: 0 } } }],
				chartData: [[1, 5]]
			}
		})
	})

	test('returns not-found from metadata before requesting producer data', async () => {
		await expect(getForksByProtocolPageData({ fork: 'unknown-fork' })).resolves.toEqual({ status: 'not-found' })
		expect(http.requests).toHaveLength(0)
	})

	test('keeps metadata and producer identity drift unavailable', async () => {
		http.serve({ '/v2/metrics/fork': { Curve: ['Convex'] } })

		await expect(getForksByProtocolPageData({ fork: 'aave-v3' })).resolves.toEqual({ status: 'unavailable' })
		expect(http.requests.map(({ url }) => url.pathname)).toEqual(['/v2/metrics/fork'])
	})

	test('keeps a metadata-valid all-extra Fork available with empty default history', async () => {
		http.serve({ '/v2/chart/fork/protocol-breakdown': [{ timestamp: 1, Curve: 10 }] })

		const result = await getForksByProtocolPageData({ fork: 'aave-v3' })

		expect(result).toMatchObject({
			status: 'success',
			data: { fork: 'Aave V3', chartData: [] }
		})
	})

	test('keeps a required source failure distinct from not-found', async () => {
		http.serve({ '/v2/chart/fork/protocol-breakdown': fixtureStatus(503) })

		await expect(getForksByProtocolPageData({ fork: 'Aave V3' })).resolves.toEqual({ status: 'unavailable' })
	})
})
