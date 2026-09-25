import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { getStaticProps as bridgeAggregatorProps } from '~/pages/bridge-aggregators/chains'
import { getStaticProps as dexAggregatorProps } from '~/pages/dex-aggregators/chains'
import { getStaticProps as dexsProps } from '~/pages/dexs/chains'
import { getStaticProps as normalizedProps } from '~/pages/normalized-volume/chains'
import { getStaticProps as notionalProps } from '~/pages/options/notional-volume/chains'
import { getStaticProps as premiumProps } from '~/pages/options/premium-volume/chains'
import { getStaticProps as perpsAggregatorProps } from '~/pages/perps-aggregators/chains'
import { getStaticProps as perpsProps } from '~/pages/perps/chains'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'

const { serve } = installFixtureFetch()
const { seed } = installMetadataSeeder()

const adapterChainRankingRoutes = [
	{
		route: '/dexs/chains',
		adapterType: ADAPTER_TYPES.DEXS,
		dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
		getStaticProps: dexsProps
	},
	{
		route: '/perps/chains',
		adapterType: ADAPTER_TYPES.PERPS,
		dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
		getStaticProps: perpsProps
	},
	{
		route: '/dex-aggregators/chains',
		adapterType: ADAPTER_TYPES.AGGREGATORS,
		dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
		getStaticProps: dexAggregatorProps
	},
	{
		route: '/perps-aggregators/chains',
		adapterType: ADAPTER_TYPES.PERPS_AGGREGATOR,
		dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
		getStaticProps: perpsAggregatorProps
	},
	{
		route: '/options/premium-volume/chains',
		adapterType: ADAPTER_TYPES.OPTIONS,
		dataType: ADAPTER_DATA_TYPES.DAILY_PREMIUM_VOLUME,
		getStaticProps: premiumProps
	},
	{
		route: '/options/notional-volume/chains',
		adapterType: ADAPTER_TYPES.OPTIONS,
		dataType: ADAPTER_DATA_TYPES.DAILY_NOTIONAL_VOLUME,
		getStaticProps: notionalProps
	},
	{
		route: '/bridge-aggregators/chains',
		adapterType: ADAPTER_TYPES.BRIDGE_AGGREGATORS,
		dataType: ADAPTER_DATA_TYPES.DAILY_BRIDGE_VOLUME,
		getStaticProps: bridgeAggregatorProps
	},
	{
		route: '/normalized-volume/chains',
		adapterType: ADAPTER_TYPES.NORMALIZED_VOLUME,
		dataType: ADAPTER_DATA_TYPES.DAILY_NORMALIZED_VOLUME,
		getStaticProps: normalizedProps
	}
] as const

describe('adapter metric chain ranking routes', () => {
	test.each(adapterChainRankingRoutes)('returns $route rankings from the correct metric', async (row) => {
		seed({
			chainMetadata: {
				ethereum: {
					id: 'ethereum',
					name: 'Ethereum',
					dexs: true,
					perps: true,
					dexAggregators: true,
					perpsAggregators: true,
					optionsPremiumVolume: true,
					optionsNotionalVolume: true,
					bridgeAggregators: true,
					normalizedVolume: true,
					dimAgg: {
						dexs: { dv: { '24h': 101 } },
						derivatives: { dv: { '24h': 202 } },
						aggregators: { dv: { '24h': 303 } },
						'aggregator-derivatives': { dv: { '24h': 404 } },
						options: { dpv: { '24h': 505 }, dnv: { '24h': 606 } },
						'bridge-aggregators': { dbv: { '24h': 707 } },
						'normalized-volume': { dnvol: { '24h': 808 } }
					}
				}
			}
		})
		const expected = {
			'/dexs/chains': 101,
			'/perps/chains': 202,
			'/dex-aggregators/chains': 303,
			'/perps-aggregators/chains': 404,
			'/options/premium-volume/chains': 505,
			'/options/notional-volume/chains': 606,
			'/bridge-aggregators/chains': 707,
			'/normalized-volume/chains': 808
		}[row.route]
		serve({
			[`${V2_SERVER_URL}/chart/${row.adapterType}/chain-breakdown?dataType=${row.dataType}`]: [
				[1_700_000_000, { Ethereum: expected }]
			]
		})
		const result = await row.getStaticProps({})
		expect(result).toMatchObject({
			props: {
				adapterType: row.adapterType,
				dataType: row.dataType,
				chains: [expect.objectContaining({ name: 'Ethereum', total24h: expected })]
			}
		})
	})
})
