import { beforeEach, describe, expect, test } from 'vitest'
import { CATEGORY_INFO_API, V2_SERVER_URL, TRADFI_API, STABLECOINS_SERVER_URL } from '~/constants'
import { installFixtureFetch, fixtureStatus } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

function createDATResponse() {
	return {
		assetMetadata: {
			Bitcoin: {
				name: 'Bitcoin',
				ticker: 'BTC',
				geckoId: 'bitcoin',
				companies: 1,
				totalAmount: 1,
				totalUsdValue: 1,
				circSupplyPerc: 1
			}
		},
		institutionMetadata: {
			1: {
				institutionId: 1,
				ticker: 'MSTR',
				name: 'Strategy',
				type: 'Public',
				price: 1,
				priceChange24h: null,
				volume24h: 1,
				mcapRealized: null,
				mcapRealistic: null,
				mcapMax: null,
				realized_mNAV: null,
				realistic_mNAV: null,
				max_mNAV: null,
				totalUsdValue: 1,
				totalCost: 1,
				holdings: {}
			}
		},
		institutions: [{ institutionId: 1, totalUsdValue: 1, totalCost: 1 }],
		assets: {},
		totalCompanies: 1,
		flows: {},
		mNAV: {}
	}
}

describe('fetchMetadataRouteIndexes', () => {
	beforeEach(() => {
		http.serve({
			[CATEGORY_INFO_API]: [{ id: 'ai', name: 'AI', mcap: 1, volume1D: null, nbCoins: 1 }],
			[`${V2_SERVER_URL}/metrics/oracle`]: {
				oracles: { Chainlink: ['Aave'] },
				oraclesTVS: { Chainlink: {} },
				chainsByOracle: { Chainlink: ['Ethereum'] },
				protocolsByOracleChain: { Chainlink: { Ethereum: ['Aave'] } }
			},
			[`${TRADFI_API}/institutions`]: createDATResponse(),
			[`${STABLECOINS_SERVER_URL}/config`]: { Tether: 'pegged-1' }
		})
	})

	test('fetches and builds all optional route indexes when upstreams are available', async () => {
		const { fetchMetadataRouteIndexes } = await import('../routeIndexes')

		await expect(fetchMetadataRouteIndexes()).resolves.toEqual({
			narrativeCategories: { ids: ['ai'], nameById: { ai: 'AI' } },
			oracleRoutes: {
				oracleNameBySlug: { chainlink: 'Chainlink' },
				chainNameBySlug: { ethereum: 'Ethereum' },
				chainSlugsByOracleSlug: { chainlink: ['ethereum'] }
			},
			digitalAssetTreasuryRoutes: { assetSlugs: ['bitcoin'], companySlugs: ['MSTR'] },
			stablecoinPeggedAssetSlugs: ['tether']
		})
	})

	test.each(['narrative', 'oracle', 'DAT', 'stablecoin'] as const)(
		'rejects rather than publishing incomplete routes when %s fails',
		async (source) => {
			const endpoints = {
				narrative: CATEGORY_INFO_API,
				oracle: `${V2_SERVER_URL}/metrics/oracle`,
				DAT: `${TRADFI_API}/institutions`,
				stablecoin: `${STABLECOINS_SERVER_URL}/config`
			}
			http.serve({ [endpoints[source]]: fixtureStatus(404) })
			const { fetchMetadataRouteIndexes } = await import('../routeIndexes')
			await expect(fetchMetadataRouteIndexes()).rejects.toThrow(/404/)
		}
	)
})
