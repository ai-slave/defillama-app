import { beforeEach, describe, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import type { IProtocolMetricsV2Api } from '~/containers/ProtocolOverview/api.types'
import { getStaticProps as getCexStaticProps } from '~/pages/cex/[cex]'
import { getStaticProps as getCexAssetsStaticProps } from '~/pages/cex/assets/[cex]'
import { getStaticProps as getCexStablecoinsStaticProps } from '~/pages/cex/stablecoins/[cex]'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { resolveCexParamFromMetadata } from '../server/routes'
import { cryptoComCexMetadataCache } from './metadataFixture'

vi.mock('~/containers/Markets/server/dataset.server', () => ({
	resolveExchangeByDefillamaCexSlug: async () => null
}))

const metadata = installMetadataSeeder()
const http = installFixtureFetch()
const metrics: IProtocolMetricsV2Api = {
	id: 'crypto-com',
	name: 'Crypto.com',
	symbol: '-',
	url: 'https://crypto.com',
	description: null,
	logo: null,
	gecko_id: null,
	cmcId: null,
	chains: ['Ethereum'],
	currentChainTvls: { Ethereum: 100 },
	mcap: null,
	category: 'CEX',
	tags: ['CEX'],
	chain: 'Ethereum',
	module: 'crypto-com/index.js',
	hacks: [],
	raises: []
}

describe('CEX routes', () => {
	beforeEach(() => {
		metadata.seed({ ...cryptoComCexMetadataCache, emissionsSupplyMetrics: {} })
		http.serve({
			[`${V2_SERVER_URL}/metrics/tvl/protocol/crypto-com`]: metrics,
			[`${V2_SERVER_URL}/metrics/tvl/protocol/crypto.com`]: metrics,
			[`${V2_SERVER_URL}/chart/tvl/protocol/crypto.com`]: [[1, 100]],
			'/lite/protocols2': { protocols: [], chains: [], parentProtocols: [], protocolCategories: [] },
			'/blockExplorers.json': [],
			'/research/sponsors/lookup/cex/crypto-com': { reports: [] }
		})
	})

	test('renders the legacy overview, assets, and stablecoin pages', async () => {
		const overview = await getCexStaticProps({ params: { cex: 'crypto-com' } } as never)
		expect(overview).toMatchObject({ props: { name: 'Crypto.com' }, revalidate: expect.any(Number) })

		const assets = await getCexAssetsStaticProps({ params: { cex: 'crypto-com' } } as never)
		expect(assets).toMatchObject({
			props: { name: 'Crypto.com', metrics: { tvl: true, stablecoins: true } },
			revalidate: expect.any(Number)
		})

		const stablecoins = await getCexStablecoinsStaticProps({ params: { cex: 'crypto-com' } } as never)
		expect(stablecoins).toMatchObject({
			props: { name: 'Crypto.com', metrics: { tvl: true, stablecoins: true } },
			revalidate: expect.any(Number)
		})
	})

	test('redirects CEX aliases to canonical slugs', async () => {
		await expect(getCexStaticProps({ params: { cex: 'Crypto.com' } } as never)).resolves.toEqual({
			redirect: { destination: '/cex/crypto-com', permanent: true }
		})
		await expect(getCexAssetsStaticProps({ params: { cex: 'Crypto.com' } } as never)).resolves.toEqual({
			redirect: { destination: '/cex/assets/crypto-com', permanent: true }
		})
		await expect(getCexStablecoinsStaticProps({ params: { cex: 'Crypto.com' } } as never)).resolves.toEqual({
			redirect: { destination: '/cex/stablecoins/crypto-com', permanent: true }
		})
	})

	test('keeps a metadata-only CEX route valid without list presentation metadata', () => {
		const metadataCache = {
			...cryptoComCexMetadataCache,
			cexRouteIdBySlug: { ...cryptoComCexMetadataCache.cexRouteIdBySlug, websea: 'websea' },
			protocolMetadata: {
				...cryptoComCexMetadataCache.protocolMetadata,
				websea: { name: 'websea', displayName: 'Websea', tvl: true, stablecoins: true, cex: true }
			}
		}

		const route = resolveCexParamFromMetadata('websea', metadataCache as never)

		expect(route).toMatchObject({ id: 'websea', canonicalSlug: 'websea', metadata: { name: 'websea' } })
		expect(route).not.toHaveProperty('cexMetadata')
	})
})
