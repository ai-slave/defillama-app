import { describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'

// Heavy page chrome; these tests only read getStaticProps output.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/RWA', () => ({ RWAOverview: () => null }))

const metadata = installMetadataSeeder()

function seedCategories(categories: Array<string>) {
	metadata.seed({
		rwaList: { canonicalMarketIds: [], idMap: {}, platforms: [], chains: [], categories, assetGroups: [] }
	})
}

describe('rwa category page', () => {
	test('returns notFound for the RWA Perps category route', async () => {
		seedCategories(['Treasuries', 'RWA Perps'])
		const page = await import('~/pages/rwa/category/[category]')

		await expect(page.getStaticProps({ params: { category: 'rwa-perps' } })).resolves.toEqual({ notFound: true })
	})

	test('redirects noncanonical category params to the canonical slug', async () => {
		seedCategories(['Treasuries', 'RWA Perps'])
		const page = await import('~/pages/rwa/category/[category]')

		await expect(page.getStaticProps({ params: { category: 'Treasuries' } })).resolves.toEqual({
			redirect: { destination: '/rwa/category/treasuries', permanent: false }
		})
	})
})
