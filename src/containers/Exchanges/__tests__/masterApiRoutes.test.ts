import { describe, expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
const http = installFixtureFetch()

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
	test('keeps the exact execution symbol with token slippage', async () => {
		const { masterExchangeExecutionSlippage } = await import('../server/master.api')
		http.serve({
			'/exchanges/execution-quality.json': {
				venues: {
					binance: {
						pairs: {
							BTC: {
								symbol: 'BTCUSDT',
								predicted_slippage_bps_10k: 0.03,
								realized_slippage_bps_10k: 0.05
							}
						}
					}
				}
			}
		})
		const request = { method: 'GET', url: '/api/public/exchanges/execution-slippage', headers: {}, query: {} }

		const response = await masterExchangeExecutionSlippage.handle(request)

		expect(response).toMatchObject({
			status: 200,
			body: {
				venues: {
					binance: {
						BTC: { symbol: 'BTCUSDT', predictedBps: 0.03, realizedBps: 0.05 }
					}
				}
			}
		})
	})

	test('loads global chart parts independently', async () => {
		const { masterExchangeChart } = await import('../server/master.api')
		http.serve({
			'/charts/volume/all.json': { days: [1], series: [[10]] },
			'/charts/oi/all.json': { days: [1], series: [[20]] }
		})
		const request = { method: 'GET', url: '/api/public/exchanges/charts', headers: {} }

		const volume = await masterExchangeChart.handle({ ...request, query: { part: 'volume' } })
		const oi = await masterExchangeChart.handle({ ...request, query: { part: 'oi' } })
		const invalid = await masterExchangeChart.handle({ ...request, query: { part: 'future-shape' } })

		expect(http.requests).toHaveLength(2)
		expect(volume.status).toBe(200)
		expect('serializedJson' in volume && JSON.parse(volume.serializedJson)).toEqual({ days: [1], series: [[10]] })
		expect(oi.status).toBe(200)
		expect('serializedJson' in oi && JSON.parse(oi.serializedJson)).toEqual({ days: [1], series: [[20]] })
		expect(invalid).toEqual({ status: 400, body: { error: 'Unknown exchange chart' } })
	})

	test('loads per-venue history from its canonical series file', async () => {
		const { masterExchangeHistory } = await import('../server/master.api')
		http.serve({
			'/exchanges/coinbase/series/all.json': {
				days: [1, 3],
				key: ['spot_volume'],
				series: [[10, 30]],
				last_updated: '2026-07-13T00:00:00Z'
			}
		})
		const request = { method: 'GET', url: '/api/public/exchanges/history', headers: {} }

		const response = await masterExchangeHistory.handle({ ...request, query: { exchange: 'coinbase' } })

		expect(http.urls()).toEqual([`${MARKETS_SERVER_URL}/exchanges/coinbase/series/all.json`])
		expect('serializedJson' in response && JSON.parse(response.serializedJson)).toMatchObject({
			series: { spot_volume: [10, 30] }
		})
	})

	test('rejects invalid exchange and country URL values before fetching', async () => {
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
		expect(http.requests).toHaveLength(0)
	})

	test('omits metadata for unavailable countries and loads it for offered countries', async () => {
		const { masterExchangeRegionalMetadata } = await import('../server/master.api')
		http.serve({
			[MARKETS_SERVER_URL]: (requestUrl: URL) => {
				const url = requestUrl.href
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
			}
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
		expect(http.urls()).not.toContain(`${MARKETS_SERVER_URL}/exchanges/coinbase/metadata/eea.json`)
	})
})
