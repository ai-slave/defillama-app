import { describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import { resolveRWAAssetRoute } from '../assetRoute'

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		const { pathname } = new URL(url)
		if (pathname.endsWith('/rwa/asset-1'))
			return {
				id: 'asset-1',
				ticker: 'USDE',
				assetName: 'Ethena USDe',
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: { Ethereum: { Morpho: 10 } }
			}
		if (pathname.endsWith('/chart/asset/asset-1')) return []
		if (pathname.includes('explorer')) return []
		throw new Error(`Unrouted upstream request: ${url}`)
	}
}))
vi.mock('~/containers/Yields/server/dataset.server', () => ({ acquireOptionalYieldsSnapshot: async () => null }))
// Heavy page chrome; these tests only read getStaticProps output.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/RWA/Asset', () => ({ RWAAssetPage: () => null }))

const metadata = installMetadataSeeder()

function seedAssets(canonicalMarketIds: Array<string>, idMap: Record<string, string>) {
	metadata.seed({
		rwaList: { canonicalMarketIds, idMap, platforms: [], chains: [], categories: [], assetGroups: [] }
	})
}

describe('resolveRWAAssetRoute', () => {
	test('matches the asset param to its canonical market id case-insensitively', () => {
		const rwaList = { canonicalMarketIds: ['USDf-Falcon'], idMap: { 'USDf-Falcon': 'asset-1' } }

		expect(resolveRWAAssetRoute('USDf-Falcon', rwaList)).toEqual({
			assetId: 'asset-1',
			canonicalMarketId: 'USDf-Falcon'
		})
		expect(resolveRWAAssetRoute('usdf-falcon', rwaList)).toEqual({
			assetId: 'asset-1',
			canonicalMarketId: 'USDf-Falcon'
		})
	})

	test('finds the detail id through a differently-cased idMap key', () => {
		expect(
			resolveRWAAssetRoute('USDf-Falcon', { canonicalMarketIds: ['USDf-Falcon'], idMap: { 'usdf-falcon': 'asset-1' } })
		).toEqual({ assetId: 'asset-1', canonicalMarketId: 'USDf-Falcon' })
	})

	test('returns null for unknown assets and canonical assets without a detail id', () => {
		expect(resolveRWAAssetRoute('unknown', { canonicalMarketIds: ['USDE'], idMap: { USDE: 'asset-1' } })).toBeNull()
		expect(resolveRWAAssetRoute('USDf-Falcon', { canonicalMarketIds: ['USDf-Falcon'], idMap: {} })).toBeNull()
	})
})

describe('rwa asset page', () => {
	test('serves the canonical asset even when the optional Yields snapshot is unavailable', async () => {
		seedAssets(['USDE'], { USDE: 'asset-1' })
		const page = await import('~/pages/rwa/asset/[asset]')

		const result = await page.getStaticProps({ params: { asset: 'USDE' } })

		expect(result).toMatchObject({
			props: { canonicalMarketId: 'USDE', asset: { ticker: 'USDE', assetName: 'Ethena USDe' } },
			revalidate: expect.any(Number)
		})
	})

	test('redirects a noncanonical asset param to the exact canonical asset', async () => {
		seedAssets(['USDf-Falcon'], { 'USDf-Falcon': 'asset-1' })
		const page = await import('~/pages/rwa/asset/[asset]')

		await expect(page.getStaticProps({ params: { asset: 'usdf-falcon' } })).resolves.toEqual({
			redirect: { destination: '/rwa/asset/USDf-Falcon', permanent: false }
		})
	})

	test('returns notFound for unknown asset params', async () => {
		seedAssets(['USDE'], { USDE: 'asset-1' })
		const page = await import('~/pages/rwa/asset/[asset]')

		await expect(page.getStaticProps({ params: { asset: 'unknown' } })).resolves.toEqual({ notFound: true })
	})
})
