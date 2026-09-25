import { describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'

// Heavy page chrome; these tests only read getStaticProps output.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/RWA', () => ({ RWAOverview: () => null }))

const metadata = installMetadataSeeder()

describe('rwa group route canonical redirects', () => {
	test.each([
		{
			route: 'asset-group',
			param: 'assetGroup',
			value: 'US Treasuries',
			destination: '/rwa/asset-group/us-treasuries'
		},
		{ route: 'chain', param: 'chain', value: 'Arbitrum One', destination: '/rwa/chain/arbitrum-one' },
		{ route: 'platform', param: 'platform', value: 'Ondo Finance', destination: '/rwa/platform/ondo-finance' }
	])('redirects noncanonical $route params to the canonical slug', async ({ route, param, value, destination }) => {
		metadata.seed({
			rwaList: {
				canonicalMarketIds: [],
				idMap: {},
				platforms: ['Ondo Finance'],
				chains: ['Arbitrum One'],
				categories: [],
				assetGroups: ['US Treasuries']
			},
			rwaPlatformsIndex: { generatedAt: 1, byPid: {}, platforms: {} }
		})
		const pages = {
			'asset-group': () => import('~/pages/rwa/asset-group/[assetGroup]'),
			chain: () => import('~/pages/rwa/chain/[chain]'),
			platform: () => import('~/pages/rwa/platform/[platform]')
		}
		const page = await pages[route as keyof typeof pages]()

		await expect(page.getStaticProps({ params: { [param]: value } } as never)).resolves.toEqual({
			redirect: { destination, permanent: false }
		})
	})
})
