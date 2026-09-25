import { expect, test } from 'vitest'
import categoriesHandler from '~/pages/api/public/page-data/categories/charts'
import chainsHandler from '~/pages/api/public/page-data/chains/charts'
import adaptersHandler from '~/pages/api/public/page-data/dimension-adapters/chains-chart'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { installTelemetrySink } from '~/utils/testing/telemetry'
const http = installTelemetrySink()
const metadata = installMetadataSeeder()

test('serializes category values and reuses the response for equivalent extra-TVL queries', async () => {
	http.serve({ '/categories': { categories: { Dexs: {} }, chart: { '2': { Dexs: { tvl: 100, staking: 12 } } } } })
	for (const extraTvlTypes of ['staking,borrowed', ['staking', 'borrowed']]) {
		const res = createMockNextApiResponse()
		// oxlint-disable-next-line no-await-in-loop -- Sequential requests prove cache reuse.
		await categoriesHandler(createMockNextApiRequest({ method: 'GET', query: { extraTvlTypes } }), res)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('public, s-maxage='))
		expect(JSON.parse(res.send.mock.calls[0][0])).toEqual({
			chartSource: [{ timestamp: 2000, Dexs: 100 }],
			extraTvlCharts: { Dexs: { staking: { '2000': 12 }, borrowed: { '2000': 0 } } }
		})
	}
	expect(http.requests.filter((request) => request.url.pathname === '/categories')).toHaveLength(1)
})
test('returns normalized chain TVL values through the serialized route response', async () => {
	http.serve({
		'https://api.llama.fi/chains2/': {
			stackedDataset: [['1', { Ethereum: { t: 100, d: 20, l: 30, dl: 5 } }]],
			tvlTypes: { tvl: 't', doublecounted: 'd', liquidstaking: 'l', dcAndLsOverlap: 'dl' }
		}
	})
	const res = createMockNextApiResponse()
	await chainsHandler(createMockNextApiRequest({ method: 'GET', query: { category: 'All' } }), res)
	expect(res.status).toHaveBeenCalledWith(200)
	expect(JSON.parse(res.send.mock.calls[0][0])).toEqual({
		tvlChartsByChain: { tvl: { Ethereum: { '1000': 55 } } },
		totalTvlByDate: { tvl: { '1000': 55 } }
	})
})
test('returns adapter chart timestamps and measured chain values', async () => {
	metadata.seed({ chainMetadata: { ethereum: { id: 'ethereum', name: 'Ethereum', dexs: true } } })
	http.serve({ '/v2/chart/dexs/chain-breakdown': [[1, { Ethereum: 100 }]] })
	const res = createMockNextApiResponse()
	await adaptersHandler(
		createMockNextApiRequest({ method: 'GET', query: { adapterType: 'dexs', dataType: 'dailyVolume' } }),
		res
	)
	expect(res.status).toHaveBeenCalledWith(200)
	expect(JSON.parse(res.send.mock.calls[0][0])).toEqual({
		dimensions: ['timestamp', 'Ethereum'],
		source: [[1000, 100]]
	})
})
test('returns an uncached gateway error when the category source fails', async () => {
	http.serve({ '/categories': fixtureStatus(503) })
	const res = createMockNextApiResponse()
	await categoriesHandler(createMockNextApiRequest({ method: 'GET', query: { extraTvlTypes: 'vesting' } }), res)
	expect(res.status).toHaveBeenCalledWith(502)
	expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
	expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch categories chart data' })
})
