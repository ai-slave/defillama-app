import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/constants')>()
	return { ...actual, MARKETS_SERVER_URL: 'https://master-routes.example.com' }
})

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return { ...actual, fetchJson: fetchJsonMock }
})

beforeEach(() => {
	vi.resetModules()
	vi.clearAllMocks()
})

const metadata = {
	slug: 'coinbase',
	display_name: 'Coinbase',
	type: 'cex',
	directory_visibility: 'listed',
	profile_mode: 'markets',
	scope: { kind: 'global' },
	parent_entity: null,
	related_entities: [],
	liquidity: { spot: { mode: 'own' }, linear_perp: null, inverse_perp: null },
	links: { profile: '/exchange/coinbase', website: null, defillama: null },
	native_token: null,
	promotions: [],
	kpis: [],
	groups: [],
	last_updated: '2026-07-18T00:00:00.000Z'
}

describe('master Exchanges API routes', () => {
	it('loads global chart parts independently', async () => {
		const { masterExchangeChart } = await import('../server/master.api')
		fetchJsonMock.mockImplementation(async (url: string) => ({ url }))
		const request = { method: 'GET', url: '/api/public/exchanges/charts', headers: {} }

		await masterExchangeChart.handle({ ...request, query: { part: 'volume' } })
		await masterExchangeChart.handle({ ...request, query: { part: 'oi' } })
		const invalid = await masterExchangeChart.handle({ ...request, query: { part: 'future-shape' } })

		expect(fetchJsonMock).toHaveBeenCalledTimes(2)
		expect(invalid).toEqual({ status: 400, body: { error: 'Unknown exchange chart' } })
	})

	it('loads per-venue history from its canonical series file', async () => {
		const { masterExchangeHistory } = await import('../server/master.api')
		fetchJsonMock.mockResolvedValue({
			days: [1, 3],
			key: ['spot_volume'],
			series: [[10, 30]],
			last_updated: '2026-07-13T00:00:00Z'
		})
		const request = { method: 'GET', url: '/api/public/exchanges/history', headers: {} }

		const response = await masterExchangeHistory.handle({ ...request, query: { exchange: 'coinbase' } })

		expect(fetchJsonMock).toHaveBeenCalledWith('https://master-routes.example.com/exchanges/coinbase/series/all.json')
		expect('serializedJson' in response && JSON.parse(response.serializedJson)).toMatchObject({
			series: { spot_volume: [10, 30] }
		})
	})

	it('rejects invalid exchange and country URL values before fetching', async () => {
		const { masterExchangeHistory, masterExchangeRegionalMetadata } = await import('../server/master.api')
		const request = { method: 'GET', url: '/api/public/exchanges', headers: {} }

		const exchange = await masterExchangeHistory.handle({
			...request,
			query: { exchange: 'coinbase--eu' }
		})
		const country = await masterExchangeRegionalMetadata.handle({
			...request,
			query: { exchange: 'coinbase', country: 'germany' }
		})

		expect(exchange).toEqual({ status: 400, body: { error: 'Invalid exchange' } })
		expect(country).toEqual({ status: 400, body: { error: 'Invalid country' } })
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})

	it('omits metadata for unavailable countries and loads it for offered countries', async () => {
		const { masterExchangeRegionalMetadata } = await import('../server/master.api')
		fetchJsonMock.mockImplementation(async (url: string) => {
			if (url.endsWith('/exchanges/regions.json')) {
				return {
					version: '2026-07-18',
					countries: ['DE', 'US'],
					country_regions: { DE: 'eea', US: 'us' },
					regions: {
						eea: { label: 'EU / EEA', continent: 'Europe', countries: ['DE'] },
						us: { label: 'United States', continent: 'North America', countries: ['US'] }
					},
					last_updated: '2026-07-18T00:00:00.000Z'
				}
			}
			if (url.endsWith('/exchanges/coinbase/metadata/regions.json')) {
				return {
					variants: {
						eea: {
							status: 'available',
							segments: ['spot'],
							note: null,
							source: null,
							country_overrides: { DE: { status: 'unavailable', note: 'Service ended.' } }
						},
						us: { status: 'restricted', segments: ['spot'], note: null, source: null, country_overrides: {} },
						global: { status: 'available', segments: ['spot'], note: null, source: null, country_overrides: {} }
					},
					last_updated: '2026-07-18T00:00:00.000Z'
				}
			}
			if (url.endsWith('/exchanges/coinbase/metadata/us.json')) return metadata
			throw new Error(`Unexpected URL: ${url}`)
		})
		const request = { method: 'GET', url: '/api/public/exchanges/coinbase/metadata', headers: {} }

		const unavailable = await masterExchangeRegionalMetadata.handle({
			...request,
			query: { exchange: 'coinbase', country: 'DE' }
		})
		const restricted = await masterExchangeRegionalMetadata.handle({
			...request,
			query: { exchange: 'coinbase', country: 'US' }
		})

		expect(unavailable).toMatchObject({
			status: 200,
			body: { availability: 'unavailable', segments: [], note: 'Service ended.' }
		})
		expect((unavailable as { body: object }).body).not.toHaveProperty('metadata')
		expect(restricted).toMatchObject({
			status: 200,
			body: { availability: 'restricted', segments: ['spot'], metadata: { slug: 'coinbase' } }
		})
		expect(fetchJsonMock).not.toHaveBeenCalledWith(
			'https://master-routes.example.com/exchanges/coinbase/metadata/eea.json'
		)
	})
})
