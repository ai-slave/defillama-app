import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CARDS_SERVER_URL, COINS_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchCoreMetadata } from '../fetch'
import { serveCoreMetadata as serveSources } from './sourceFixture'

const http = installFixtureFetch()
const serveCoreMetadata = (overrides: Record<string, unknown> = {}) => serveSources(http, overrides)
const priceEndpoint = `${COINS_SERVER_URL}/pro/prices/historical`
const priceRequests = () => http.requests.filter(({ url }) => url.href === priceEndpoint)

describe('fetchCoreMetadata', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	test('returns the core metadata payload shape from upstream sources', async () => {
		serveCoreMetadata()

		const payload = await fetchCoreMetadata()

		expect(payload.cexs).toEqual([])
		expect(payload.cgExchangeIdentifiers).toEqual(['binance'])
		expect(payload.tokenlist.aave?.symbol).toBe('AAVE')
		expect(payload.tokenDirectory.aave?.symbol).toBe('AAVE')
		expect(payload.bridgeProtocolSlugs).toContain('stargate')
		expect(payload.bridgeChainSlugs).toEqual(['ethereum', 'arbitrum'])
		expect(payload.liquidationsTokenSymbols).toEqual(['WETH'])
		expect(payload.emissionsProtocolsList).toEqual(['aave'])
		expect(payload.emissionsSupplyMetrics).toEqual({})
		expect(payload.emissionsHistoricalPrices).toEqual({})
		expect(payload.narrativeCategories.ids).toEqual(['ai'])
		expect(payload.digitalAssetTreasuryRoutes.assetSlugs).toEqual(['bitcoin'])
		expect(payload.stablecoinPeggedAssetSlugs).toEqual(['tether'])
		expect(payload.equitiesCompanyRoutes).toEqual([{ ticker: 'NVDA', country: 'US' }])
		expect(payload.preIpoCompanyIds).toEqual(['anthropic'])
		expect(payload.tokenFilterMetadata.tokens.aave).toEqual({
			chains: ['ethereum'],
			primaryChain: 'ethereum',
			categories: ['governance']
		})
		expect(payload.rwaPlatformsIndex).toEqual({ generatedAt: 0, byPid: {}, platforms: {} })
		expect(priceRequests()).toHaveLength(0)
	})

	test('merges legacy and metadata-only RWA platform routes by canonical slug', async () => {
		serveCoreMetadata({
			rwaList: {
				canonicalMarketIds: [],
				// The legacy list can already carry the new name, which must not leave a second route.
				platforms: ['Legacy Platform', 'Old Active Name', 'Canonical Active Name'],
				chains: [],
				categories: [],
				assetGroups: [],
				idMap: {}
			},
			rwaPlatformsIndex: {
				generatedAt: 1,
				byPid: { '1': 'old-active-name', '2': 'metadata-only' },
				platforms: {
					'old-active-name': { name: 'Canonical Active Name', slug: 'old-active-name' },
					'metadata-only': { name: 'Metadata Only', slug: 'metadata-only', onchainAum: 1 }
				}
			}
		})

		const payload = await fetchCoreMetadata()

		expect(payload.rwaList.platformRoutes).toEqual([
			{ name: 'Legacy Platform', slug: 'legacy-platform' },
			{ name: 'Canonical Active Name', slug: 'old-active-name' },
			{ name: 'Metadata Only', slug: 'metadata-only' }
		])
		expect(payload.rwaList.platforms).toEqual(['Legacy Platform', 'Canonical Active Name', 'Metadata Only'])
		expect(payload.rwaPlatformsIndex).toEqual({
			generatedAt: 1,
			byPid: { '1': 'old-active-name', '2': 'metadata-only' },
			platforms: {
				'old-active-name': { name: 'Canonical Active Name', slug: 'old-active-name' },
				'metadata-only': { name: 'Metadata Only', slug: 'metadata-only', onchainAum: 1 }
			}
		})
	})

	test('gives a platform only the index knows a page when it has AUM or a live perps venue', async () => {
		serveCoreMetadata({
			rwaList: { canonicalMarketIds: [], platforms: ['Ondo'], chains: [], categories: [], assetGroups: [], idMap: {} },
			rwaPlatformsIndex: {
				generatedAt: 1,
				byPid: {},
				platforms: {
					ondo: { name: 'Ondo', slug: 'ondo', onchainAum: 0, activeAum: 0 },
					sivo: { name: 'Sivo', slug: 'sivo', onchainAum: 0, activeAum: 12_500_000 },
					entropy: { name: 'Entropy', slug: 'entropy', onchainAum: 0, activeAum: 0 },
					// A Platforms-sheet row with nothing behind it, e.g. an unpublished perps adapter.
					bitget: { name: 'Bitget', slug: 'bitget', onchainAum: 0, activeAum: 0 }
				}
			},
			rwaPerpsList: { contracts: [], venues: ['Entropy'], categories: [], assets: [], assetGroups: [], total: 0 }
		})

		const payload = await fetchCoreMetadata()

		expect(payload.rwaList.platformRoutes).toEqual([
			{ name: 'Ondo', slug: 'ondo' },
			{ name: 'Sivo', slug: 'sivo' },
			{ name: 'Entropy', slug: 'entropy' }
		])
		expect(payload.rwaList.platforms).toEqual(['Ondo', 'Sivo', 'Entropy'])
	})

	test('gives no RWA tab or retired-TVL redirect onto a platform without a page', async () => {
		serveCoreMetadata({
			protocols: {
				'6378': { name: 'xstocks', displayName: 'xStocks' },
				'5873': { name: 'synthetix', displayName: 'Synthetix', tvl: true },
				'6567': { name: 'aden', displayName: 'ADEN' }
			},
			rwaList: {
				canonicalMarketIds: [],
				platforms: ['xStocks'],
				chains: [],
				categories: [],
				assetGroups: [],
				idMap: {}
			},
			rwaPlatformsIndex: {
				generatedAt: 1,
				byPid: {},
				byProtocolSlug: { xstocks: 'xstocks', synthetix: 'synthetix-perps', aden: 'aden' },
				redirectByProtocolSlug: { xstocks: 'xstocks', synthetix: 'synthetix-perps', aden: 'aden' },
				platforms: {
					xstocks: { name: 'xStocks', slug: 'xstocks', onchainAum: 0, activeAum: 0 },
					'synthetix-perps': { name: 'Synthetix Perps', slug: 'synthetix-perps', onchainAum: 0, activeAum: 0 },
					aden: { name: 'ADEN', slug: 'aden', onchainAum: 0, activeAum: 0 }
				}
			}
		})

		const payload = await fetchCoreMetadata()

		expect(payload.protocols['6378'].rwaPlatformSlug).toBe('xstocks')
		expect(payload.protocols['6378'].rwaPlatformRedirectSlug).toBe('xstocks')
		expect(payload.protocols['5873'].rwaPlatformSlug).toBeUndefined()
		expect(payload.protocols['5873'].rwaPlatformRedirectSlug).toBeUndefined()
		expect(payload.protocols['6567'].rwaPlatformSlug).toBeUndefined()
		expect(payload.protocols['6567'].rwaPlatformRedirectSlug).toBeUndefined()
	})

	test('stamps the declared RWA platform onto its protocol metadata', async () => {
		serveCoreMetadata({
			protocols: {
				'6378': { name: 'xstocks', displayName: 'xStocks' },
				'2272': { name: 'okx', displayName: 'OKX', tvl: true },
				'4980': { name: 'spiko', displayName: 'Spiko', tvl: true }
			},
			rwaPlatformsIndex: {
				generatedAt: 1,
				byPid: {},
				byProtocolSlug: { xstocks: 'xstocks', okx: 'okx' },
				platforms: {}
			}
		})

		const payload = await fetchCoreMetadata()

		expect(payload.protocols['6378'].rwaPlatformSlug).toBe('xstocks')
		expect(payload.protocols['2272'].rwaPlatformSlug).toBe('okx')
		expect(payload.protocols['4980'].rwaPlatformSlug).toBeUndefined()
	})

	test("gives a declared parent's children a redirect target without giving them the RWA tab", async () => {
		// OpenEden declares only the parent. The three children carry the TVL adapters, so retiring
		// those must redirect — but the tab renders the whole parent platform, so they must not host it.
		serveCoreMetadata({
			protocols: {
				'parent#openeden': { name: 'openeden', displayName: 'OpenEden' },
				'3057': { name: 'openeden-tbill', displayName: 'OpenEden TBILL', tvl: true },
				'4980': { name: 'spiko', displayName: 'Spiko', tvl: true }
			},
			rwaPlatformsIndex: {
				generatedAt: 1,
				byPid: {},
				byProtocolSlug: { openeden: 'openeden' },
				redirectByProtocolSlug: { openeden: 'openeden', 'openeden-tbill': 'openeden' },
				platforms: {}
			}
		})

		const payload = await fetchCoreMetadata()

		expect(payload.protocols['parent#openeden'].rwaPlatformSlug).toBe('openeden')
		expect(payload.protocols['parent#openeden'].rwaPlatformRedirectSlug).toBe('openeden')

		expect(payload.protocols['3057'].rwaPlatformSlug).toBeUndefined()
		expect(payload.protocols['3057'].rwaPlatformRedirectSlug).toBe('openeden')

		expect(payload.protocols['4980'].rwaPlatformRedirectSlug).toBeUndefined()
	})

	test('stamps crypto card issuers onto protocol metadata', async () => {
		serveCoreMetadata({
			protocols: { '7480': { name: 'kast-card', displayName: 'Kast Card' } },
			cardsIndex: { cards: [{ id: 'kast', defillama_id: '7480' }] }
		})

		const payload = await fetchCoreMetadata()

		expect(payload.protocols['7480'].cryptoCardIssuer).toBe('kast')
	})

	test('keeps core metadata available when the optional cards index fails', async () => {
		serveCoreMetadata()
		http.serve({ [`${CARDS_SERVER_URL}/index`]: fixtureStatus(503, 'cards unavailable') })
		vi.spyOn(console, 'warn').mockImplementation(() => {})

		await expect(fetchCoreMetadata()).resolves.toMatchObject({ protocols: { 'parent#aave': { name: 'aave' } } })
	})

	test('preserves card tabs and redirects across an index failure, but removes them on a successful empty index', async () => {
		serveCoreMetadata({
			protocols: {
				'parent#ether-fi': { name: 'ether.fi', displayName: 'ether.fi' },
				'6373': { name: 'etherfi-cash-liquid', displayName: 'EtherFi Cash Liquid' }
			},
			cardsIndex: { cards: [{ id: 'etherfi', defillama_id: '6373', defillama_parent_id: 'parent#ether-fi' }] }
		})
		const initial = await fetchCoreMetadata()
		expect(initial.protocols['parent#ether-fi'].cryptoCardIssuer).toBe('etherfi')
		expect(initial.protocols['6373'].cryptoCardRedirectSlug).toBe('ether.fi')

		http.serve({ [`${CARDS_SERVER_URL}/index`]: fixtureStatus(503, 'cards unavailable') })
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		const refreshed = await fetchCoreMetadata(initial.protocols)
		expect(refreshed.protocols['parent#ether-fi'].cryptoCardIssuer).toBe('etherfi')
		expect(refreshed.protocols['6373'].cryptoCardRedirectSlug).toBe('ether.fi')

		http.serve({ [`${CARDS_SERVER_URL}/index`]: { cards: [] } })
		const cleared = await fetchCoreMetadata(refreshed.protocols)
		expect(cleared.protocols['parent#ether-fi'].cryptoCardIssuer).toBeUndefined()
		expect(cleared.protocols['6373'].cryptoCardRedirectSlug).toBeUndefined()
	})

	test('stamps the per-protocol RWA mcap slug only where the protocol issues its own assets', async () => {
		serveCoreMetadata({
			protocols: {
				'3698': { name: 'circle-usyc', displayName: 'Circle USYC' },
				'8111': { name: 'circle-gateway', displayName: 'Circle Gateway', tvl: true },
				// displayName has drifted from the name the server slugged the index entry with
				// (a rename landing in one repo first). Re-deriving the key from displayName
				// would miss this and silently fall back to the parent platform aggregate.
				'6033': { name: 'uranium-io', displayName: 'Uranium.io (Renamed)' }
			},
			rwaPlatformsIndex: {
				generatedAt: 1,
				byPid: {},
				byProtocolSlug: { circle: 'circle' },
				redirectByProtocolSlug: { circle: 'circle', 'circle-usyc': 'circle' },
				platforms: {}
			},
			rwaProtocolMcapIndex: {
				generatedAt: 1,
				protocols: [
					{
						protocolId: '3698',
						slug: 'circle-usyc',
						name: 'Circle USYC',
						onChainMcap: 2_604_139_337,
						activeMcap: 2_604_139_337,
						assets: 1
					},
					{
						protocolId: '6033',
						slug: 'uranium-io',
						name: 'Uranium.io',
						onChainMcap: 1000,
						activeMcap: 1000,
						assets: 1
					}
				]
			}
		})

		const payload = await fetchCoreMetadata()

		// USYC headlines its own $2.6bn, not Circle's $77bn platform book — but it stays a child:
		// no declared platform slug, so still no RWA tab of its own.
		expect(payload.protocols['3698'].rwaProtocolMcapSlug).toBe('circle-usyc')
		expect(payload.protocols['3698'].rwaPlatformSlug).toBeUndefined()
		expect(payload.protocols['3698'].rwaPlatformRedirectSlug).toBe('circle')
		expect(payload.protocols['8111'].rwaProtocolMcapSlug).toBeUndefined()
		// Matched on protocol id despite the drifted display name, and stamped with the index's own
		// slug — the one the chart file is keyed on server-side.
		expect(payload.protocols['6033'].rwaProtocolMcapSlug).toBe('uranium-io')
	})

	test('precomputes emissions historical prices with a 6h POST', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = nowSec - 8 * day
		vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		serveCoreMetadata({
			emissions: [
				{
					name: 'Chainlink',
					token: 'coingecko:chainlink',
					gecko_id: 'chainlink',
					unlockEvents: [],
					events: [
						{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
						{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' },
						{ timestamp: nowSec + day, noOfTokens: [20], category: 'team' }
					]
				}
			]
		})
		http.serve({
			[priceEndpoint]: {
				coins: {
					'coingecko:chainlink': {
						prices: [{ timestamp: lastPastEvent, price: 2 }]
					}
				}
			}
		})

		const payload = await fetchCoreMetadata()
		const { init: requestOptions } = priceRequests()[0]!
		const requestBody = JSON.parse(requestOptions!.body as string)

		expect(priceRequests()).toHaveLength(1)
		expect(requestOptions).toMatchObject({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		})
		expect(requestBody.searchWidth).toBe('6h')
		expect(requestBody.coins['coingecko:chainlink']).toHaveLength(15)
		expect(payload.emissionsHistoricalPrices).toEqual({
			'coingecko:chainlink': {
				prices: [{ timestamp: lastPastEvent, price: 2 }]
			}
		})
	})

	test('batches emissions historical price precomputes', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = nowSec - 8 * day
		const emissions = Array.from({ length: 51 }, (_, index) => ({
			name: `Token ${index}`,
			token: `coingecko:token-${index}`,
			gecko_id: `token-${index}`,
			unlockEvents: [],
			events: [
				{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
				{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' }
			]
		}))
		vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		serveCoreMetadata({ emissions })
		http.serve({
			[priceEndpoint]: (_url: URL, options?: RequestInit) => {
				const body = JSON.parse(options!.body as string)
				const coins: Record<string, { prices: Array<{ timestamp: number; price: number }> }> = {}
				for (const coin in body.coins) {
					coins[coin] = { prices: [{ timestamp: lastPastEvent, price: 2 }] }
				}
				return { coins }
			}
		})

		const payload = await fetchCoreMetadata()
		const firstRequestBody = JSON.parse(priceRequests()[0]!.init!.body as string)
		const secondRequestBody = JSON.parse(priceRequests()[1]!.init!.body as string)
		let firstRequestCoins = 0
		let secondRequestCoins = 0
		let resultCoins = 0
		for (const _coin in firstRequestBody.coins) firstRequestCoins++
		for (const _coin in secondRequestBody.coins) secondRequestCoins++
		for (const _coin in payload.emissionsHistoricalPrices) resultCoins++

		expect(priceRequests()).toHaveLength(2)
		expect(firstRequestCoins).toBe(50)
		expect(secondRequestCoins).toBe(1)
		expect(resultCoins).toBe(51)
		expect(payload.emissionsHistoricalPrices['coingecko:token-50']).toEqual({
			prices: [{ timestamp: lastPastEvent, price: 2 }]
		})
	})

	test('fails metadata generation when emissions historical prices fail', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = nowSec - 8 * day
		vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		serveCoreMetadata({
			emissions: [
				{
					name: 'Chainlink',
					token: 'coingecko:chainlink',
					gecko_id: 'chainlink',
					unlockEvents: [],
					events: [
						{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
						{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' }
					]
				}
			]
		})
		http.serve({ [priceEndpoint]: fixtureStatus(503, 'coins unavailable') })

		await expect(fetchCoreMetadata()).rejects.toThrow('coins unavailable')
	})
})
