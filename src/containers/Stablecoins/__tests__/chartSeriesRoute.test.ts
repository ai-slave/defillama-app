import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test } from 'vitest'
import { parseLimit, parseSeriesSelectionIntent } from '~/containers/Stablecoins/server/api'
import handler from '~/pages/api/public/stablecoins/chart-series'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

// Any upstream request fails the test: every case here is answered before the data is fetched.
installFixtureFetch()
const metadata = installMetadataSeeder()

beforeEach(() => {
	metadata.seed({
		chainRouteKeyBySlug: { ethereum: 'ethereum' },
		chainMetadata: { ethereum: { name: 'Ethereum', id: 'ethereum' } },
		stablecoinPeggedAssetSlugsSet: new Set(['tether'])
	})
})

async function call(query: Record<string, string | Array<string>>) {
	const res = createMockNextApiResponse()
	await handler({ method: 'GET', query } as unknown as NextApiRequest, res)
	return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] }
}

describe('series selection in the chart-series query', () => {
	test('selected or include picks the named series, and a single name is a list of one', () => {
		expect(parseSeriesSelectionIntent({ selected: 'true', series: ['USDT', 'DAI'] })).toEqual({
			mode: 'include',
			names: ['USDT', 'DAI']
		})
		expect(parseSeriesSelectionIntent({ include: 'true', series: 'USDT' })).toEqual({
			mode: 'include',
			names: ['USDT']
		})
	})

	test('an exclusion with no names means select all, not no selection', () => {
		expect(parseSeriesSelectionIntent({ exclude: 'true', series: 'USDT' })).toEqual({
			mode: 'exclude',
			names: ['USDT']
		})
		expect(parseSeriesSelectionIntent({ exclude: 'true' })).toEqual({ mode: 'exclude', names: [] })
	})

	test('no flag is no selection, and both flags together are refused', () => {
		expect(parseSeriesSelectionIntent({ series: 'USDT' })).toBeNull()
		expect(parseSeriesSelectionIntent({ include: 'true', exclude: 'true' })).toBe('invalid')
	})

	test('limit keeps only a positive whole number', () => {
		expect(parseLimit('10')).toBe(10)
		expect(parseLimit('10.7')).toBe(10)
		expect(parseLimit(['5', '9'])).toBe(5)
		expect(parseLimit('0')).toBeUndefined()
		expect(parseLimit('ten')).toBeUndefined()
		expect(parseLimit(undefined)).toBeUndefined()
	})
})

describe('/api/public/stablecoins/chart-series', () => {
	test('combining include and exclude is a 400', async () => {
		expect(
			await call({ scope: 'overview', chain: 'all', chart: 'dominance', include: 'true', exclude: 'true' })
		).toEqual({
			status: 400,
			body: { error: 'include and exclude cannot be combined' }
		})
	})

	test('a chart the scope does not draw is a 400', async () => {
		expect(await call({ scope: 'chains', chart: 'tokenMcaps' })).toEqual({
			status: 400,
			body: { error: 'unsupported chains chart' }
		})
		expect(await call({ scope: 'pools', chart: 'totalMcap' })).toEqual({
			status: 400,
			body: { error: 'unsupported scope' }
		})
	})

	test('an unknown chain or stablecoin is a 404', async () => {
		expect(await call({ scope: 'overview', chain: 'atlantis', chart: 'totalMcap' })).toEqual({
			status: 404,
			body: { error: 'chain not found' }
		})
		expect(await call({ scope: 'asset', stablecoin: 'missing', chart: 'totalCirc' })).toEqual({
			status: 404,
			body: { error: 'stablecoin not found' }
		})
	})
})
