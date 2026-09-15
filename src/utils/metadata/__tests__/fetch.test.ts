import { beforeEach, describe, expect, test, vi } from 'vitest'

type MetadataFetchOptions = {
	method: 'POST'
	headers: Record<string, string>
	body: string
}

type MetadataFetchCall = [url: string, options: MetadataFetchOptions]

const { fetchCoreMetadataSourcesMock, fetchMetadataJsonMock, fetchMetadataRouteIndexesMock } = vi.hoisted(() => ({
	fetchCoreMetadataSourcesMock: vi.fn(),
	fetchMetadataJsonMock: vi.fn<(...args: MetadataFetchCall) => Promise<unknown>>(),
	fetchMetadataRouteIndexesMock: vi.fn()
}))

function getFetchMetadataCall(index: number): MetadataFetchCall {
	const call = fetchMetadataJsonMock.mock.calls[index]
	if (!call) throw new Error(`Missing metadata fetch call at index ${index}`)
	return call
}

vi.mock('../sources', () => ({
	fetchCoreMetadataSources: fetchCoreMetadataSourcesMock
}))

vi.mock('../http', () => ({
	fetchMetadataJson: fetchMetadataJsonMock
}))

vi.mock('../routeIndexes', () => ({
	fetchMetadataRouteIndexes: fetchMetadataRouteIndexesMock
}))

function createCoreMetadataSources(overrides: Record<string, unknown> = {}) {
	return {
		protocols: { 'parent#aave': { name: 'aave', displayName: 'Aave', tvl: true } },
		chains: { Ethereum: { name: 'Ethereum', id: 'ethereum' } },
		categoriesAndTags: { categories: [], tags: [], tagCategoryMap: {}, configs: {} },
		cexsResponse: { cexs: [], cg_volume_cexs: ['binance'] },
		rwaList: { canonicalMarketIds: [], platforms: [], chains: [], categories: [], assetGroups: [], idMap: {} },
		rwaPlatformsIndex: { generatedAt: 0, byPid: {}, platforms: {} },
		rwaProtocolMcapIndex: { generatedAt: 0, protocols: [] },
		rwaPerpsList: { contracts: [], venues: [], categories: [], assets: [], assetGroups: [], total: 0 },
		tokenlistArray: [
			{
				id: 'aave',
				symbol: 'AAVE',
				current_price: 1,
				price_change_24h: null,
				price_change_percentage_24h: null,
				ath: null,
				ath_date: null,
				atl: null,
				atl_date: null,
				market_cap: null,
				fully_diluted_valuation: null,
				total_volume: null,
				total_supply: null,
				circulating_supply: null,
				max_supply: null
			}
		],
		tokenDirectory: { aave: { name: 'Aave', symbol: 'AAVE' } },
		liquidationsResponse: {
			data: {
				aave: {
					Ethereum: [
						{
							owner: '0xowner',
							liqPrice: 1,
							collateral: 'WETH',
							collateralAmount: 1,
							collateralAmountUsd: 1
						}
					]
				}
			},
			tokens: { Ethereum: { WETH: { symbol: 'ETH', decimals: 18 } } },
			validThresholds: [],
			timestamp: 0
		},
		bridgesResponse: {
			bridges: [
				{
					id: 1,
					name: 'Stargate',
					displayName: 'Stargate',
					slug: 'stargate',
					chains: ['Ethereum'],
					destinationChain: 'Arbitrum'
				}
			],
			chains: []
		},
		emissionsProtocolsList: ['aave'],
		emissionsSupplyMetrics: {},
		emissions: [],
		equitiesCompanyRoutes: [{ ticker: 'NVDA', country: 'US' }],
		preIpoCompanyIds: ['anthropic'],
		tokenFilterMetadata: {
			schemaVersion: 2,
			generatedAt: 1,
			sources: { coingeckoCatalogGeneratedAt: 1, rankingsUpdatedAt: null },
			tokens: { aave: { chains: ['ethereum'], primaryChain: 'ethereum', categories: ['governance'] } },
			categories: [{ id: 'governance', label: 'Governance' }]
		},
		...overrides
	}
}

describe('fetchCoreMetadata', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.resetModules()
		fetchCoreMetadataSourcesMock.mockReset()
		fetchMetadataJsonMock.mockReset()
		fetchMetadataRouteIndexesMock.mockReset()
		fetchMetadataRouteIndexesMock.mockResolvedValue({
			narrativeCategories: { ids: ['ai'], nameById: { ai: 'AI' } },
			oracleRoutes: { oracleNameBySlug: {}, chainNameBySlug: {}, chainSlugsByOracleSlug: {} },
			digitalAssetTreasuryRoutes: { assetSlugs: ['bitcoin'], companySlugs: ['MSTR'] },
			stablecoinPeggedAssetSlugs: ['tether']
		})
	})

	test('returns the core metadata payload shape from upstream sources', async () => {
		fetchCoreMetadataSourcesMock.mockResolvedValue(createCoreMetadataSources())
		const { fetchCoreMetadata } = await import('../fetch')

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
		expect(fetchMetadataJsonMock).not.toHaveBeenCalled()
	})

	test('merges legacy and metadata-only RWA platform routes by canonical slug', async () => {
		fetchCoreMetadataSourcesMock.mockResolvedValue(
			createCoreMetadataSources({
				rwaList: {
					canonicalMarketIds: [],
					platforms: ['Legacy Platform', 'Old Active Name'],
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
						'metadata-only': { name: 'Metadata Only', slug: 'metadata-only' }
					}
				}
			})
		)
		const { fetchCoreMetadata } = await import('../fetch')

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
				'metadata-only': { name: 'Metadata Only', slug: 'metadata-only' }
			}
		})
	})

	test('stamps the declared RWA platform onto its protocol metadata', async () => {
		fetchCoreMetadataSourcesMock.mockResolvedValue(
			createCoreMetadataSources({
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
		)
		const { fetchCoreMetadata } = await import('../fetch')

		const payload = await fetchCoreMetadata()

		expect(payload.protocols['6378'].rwaPlatformSlug).toBe('xstocks')
		expect(payload.protocols['2272'].rwaPlatformSlug).toBe('okx')
		expect(payload.protocols['4980'].rwaPlatformSlug).toBeUndefined()
	})

	test("gives a declared parent's children a redirect target without giving them the RWA tab", async () => {
		// OpenEden declares only the parent. The three children carry the TVL adapters, so retiring
		// those must redirect — but the tab renders the whole parent platform, so they must not host it.
		fetchCoreMetadataSourcesMock.mockResolvedValue(
			createCoreMetadataSources({
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
		)
		const { fetchCoreMetadata } = await import('../fetch')

		const payload = await fetchCoreMetadata()

		expect(payload.protocols['parent#openeden'].rwaPlatformSlug).toBe('openeden')
		expect(payload.protocols['parent#openeden'].rwaPlatformRedirectSlug).toBe('openeden')

		expect(payload.protocols['3057'].rwaPlatformSlug).toBeUndefined()
		expect(payload.protocols['3057'].rwaPlatformRedirectSlug).toBe('openeden')

		expect(payload.protocols['4980'].rwaPlatformRedirectSlug).toBeUndefined()
	})

	test('stamps the per-protocol RWA mcap slug only where the protocol issues its own assets', async () => {
		fetchCoreMetadataSourcesMock.mockResolvedValue(
			createCoreMetadataSources({
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
		)
		const { fetchCoreMetadata } = await import('../fetch')

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
		fetchCoreMetadataSourcesMock.mockResolvedValue(
			createCoreMetadataSources({
				emissions: [
					{
						name: 'Chainlink',
						token: 'coingecko:chainlink',
						gecko_id: 'chainlink',
						events: [
							{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
							{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' },
							{ timestamp: nowSec + day, noOfTokens: [20], category: 'team' }
						]
					}
				]
			})
		)
		fetchMetadataJsonMock.mockResolvedValue({
			coins: {
				'coingecko:chainlink': {
					prices: [{ timestamp: lastPastEvent, price: 2 }]
				}
			}
		})
		const { fetchCoreMetadata } = await import('../fetch')

		const payload = await fetchCoreMetadata()
		const [requestUrl, requestOptions] = getFetchMetadataCall(0)
		const requestBody = JSON.parse(requestOptions.body)

		expect(fetchMetadataJsonMock).toHaveBeenCalledTimes(1)
		expect(requestUrl).toContain('/pro/prices/historical')
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
			events: [
				{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
				{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' }
			]
		}))
		vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		fetchCoreMetadataSourcesMock.mockResolvedValue(createCoreMetadataSources({ emissions }))
		fetchMetadataJsonMock.mockImplementation(async (_url: string, options: RequestInit) => {
			const body = JSON.parse(options.body as string)
			const coins: Record<string, { prices: Array<{ timestamp: number; price: number }> }> = {}
			for (const coin in body.coins) {
				coins[coin] = { prices: [{ timestamp: lastPastEvent, price: 2 }] }
			}
			return { coins }
		})
		const { fetchCoreMetadata } = await import('../fetch')

		const payload = await fetchCoreMetadata()
		const firstRequestBody = JSON.parse(getFetchMetadataCall(0)[1].body)
		const secondRequestBody = JSON.parse(getFetchMetadataCall(1)[1].body)
		let firstRequestCoins = 0
		let secondRequestCoins = 0
		let resultCoins = 0
		for (const _coin in firstRequestBody.coins) firstRequestCoins++
		for (const _coin in secondRequestBody.coins) secondRequestCoins++
		for (const _coin in payload.emissionsHistoricalPrices) resultCoins++

		expect(fetchMetadataJsonMock).toHaveBeenCalledTimes(2)
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
		fetchCoreMetadataSourcesMock.mockResolvedValue(
			createCoreMetadataSources({
				emissions: [
					{
						name: 'Chainlink',
						token: 'coingecko:chainlink',
						gecko_id: 'chainlink',
						events: [
							{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
							{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' }
						]
					}
				]
			})
		)
		fetchMetadataJsonMock.mockRejectedValue(new Error('coins unavailable'))
		const { fetchCoreMetadata } = await import('../fetch')

		await expect(fetchCoreMetadata()).rejects.toThrow('coins unavailable')
	})
})
