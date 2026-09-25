import {
	CATEGORY_INFO_API,
	V2_SERVER_URL,
	TRADFI_API,
	STABLECOINS_SERVER_URL,
	SERVER_URL,
	DATASETS_SERVER_URL,
	RWA_SERVER_URL,
	RWA_PERPS_SERVER_URL,
	LIQUIDATIONS_SERVER_URL_V2,
	BRIDGES_SERVER_URL,
	EQUITIES_SERVER_URL,
	PRE_IPO_SERVER_URL
} from '~/constants'
import type { installFixtureFetch } from '~/utils/test/fixtureFetch'
export function serveCoreMetadata(
	http: Pick<ReturnType<typeof installFixtureFetch>, 'serve'>,
	overrides: Record<string, unknown> = {}
) {
	const sources = {
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
	http.serve({
		[`${SERVER_URL}/config/smol/appMetadata-protocols.json`]: sources.protocols,
		[`${SERVER_URL}/config/smol/appMetadata-chains.json`]: sources.chains,
		[`${SERVER_URL}/config/smol/appMetadata-categoriesAndTags.json`]: sources.categoriesAndTags,
		[`${SERVER_URL}/chains2`]: { categories: ['EVM'] },
		[`${SERVER_URL}/cexs`]: sources.cexsResponse,
		[`${RWA_SERVER_URL}/list`]: sources.rwaList,
		[`${RWA_SERVER_URL}/rwa/platforms`]: sources.rwaPlatformsIndex,
		[`${RWA_SERVER_URL}/protocol-mcap`]: sources.rwaProtocolMcapIndex,
		[`${RWA_PERPS_SERVER_URL}/list`]: sources.rwaPerpsList,
		[`${DATASETS_SERVER_URL}/tokenlist/rankings.json`]: sources.tokenlistArray,
		[`${DATASETS_SERVER_URL}/tokenlist/filters.json`]: sources.tokenFilterMetadata,
		'https://api.llama.fi/config/smol/token.json': sources.tokenDirectory,
		[`${LIQUIDATIONS_SERVER_URL_V2}/all`]: sources.liquidationsResponse,
		[`${BRIDGES_SERVER_URL}/bridges`]: sources.bridgesResponse,
		[`${DATASETS_SERVER_URL}/emissionsProtocolsList`]: sources.emissionsProtocolsList,
		[`${DATASETS_SERVER_URL}/emissionsSupplyMetrics`]: sources.emissionsSupplyMetrics,
		[`${SERVER_URL}/emissions`]: sources.emissions,
		[`${EQUITIES_SERVER_URL}/companies-list`]: sources.equitiesCompanyRoutes,
		[`${PRE_IPO_SERVER_URL}/companies-list`]: { data: sources.preIpoCompanyIds.map((id) => ({ id })) },
		[CATEGORY_INFO_API]: [{ id: 'ai', name: 'AI' }],
		[`${V2_SERVER_URL}/metrics/oracle`]: { oracles: {}, chainsByOracle: {}, protocolsByOracleChain: {} },
		[`${TRADFI_API}/institutions`]: {
			assetMetadata: { Bitcoin: { totalUsdValue: 1 } },
			institutions: [{ institutionId: 1 }],
			institutionMetadata: { '1': { institutionId: 1, ticker: 'MSTR' } }
		},
		[`${STABLECOINS_SERVER_URL}/config`]: { Tether: 'pegged-1' }
	})
}
