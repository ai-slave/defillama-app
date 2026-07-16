import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

const TEST_ASSET = {
	id: 'asset-1',
	slug: 'USDE',
	ticker: 'USDE',
	assetName: 'Ethena USDe'
}

function setupPageModule({
	canonicalMarketIds,
	idMap = { USDE: 'asset-1' },
	assetData = TEST_ASSET,
	yieldsSnapshot = { readJson: vi.fn() }
}: {
	canonicalMarketIds?: string[]
	idMap?: Record<string, string>
	assetData?: unknown
	yieldsSnapshot?: unknown
} = {}) {
	vi.doMock('~/constants', () => ({
		SKIP_BUILD_STATIC_GENERATION: false
	}))
	vi.doMock('~/utils/metadata', () => ({
		default: {
			rwaList: {
				canonicalMarketIds: canonicalMarketIds ?? Object.keys(idMap),
				platforms: [],
				chains: [],
				categories: [],
				assetGroups: [],
				idMap
			}
		}
	}))
	vi.doMock('~/containers/RWA/Asset', () => ({
		RWAAssetPage: () => null
	}))
	vi.doMock('~/containers/RWA/queries', () => ({
		getRWAAssetData: vi.fn().mockResolvedValue(assetData)
	}))
	vi.doMock('~/containers/Yields/server/dataset.server', () => ({
		acquireOptionalYieldsSnapshot: vi.fn().mockResolvedValue(yieldsSnapshot)
	}))
	vi.doMock('~/layout', () => ({
		default: () => null
	}))
	vi.doMock('~/utils/maxAgeForNext', () => ({
		maxAgeForNext: () => 123
	}))
	vi.doMock('~/utils/perf', () => ({
		withPerformanceLogging: (_label: string, fn: any) => fn
	}))

	return import('~/pages/rwa/asset/[asset]')
}

describe('rwa asset page', () => {
	it('getStaticProps resolves an exact canonical asset param', async () => {
		const page = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'USDE' } } as never)).resolves.toEqual({
			props: { asset: TEST_ASSET, canonicalMarketId: 'USDE' },
			revalidate: 123
		})
	})

	it('keeps the asset page when the optional Yields snapshot is unavailable', async () => {
		const page = await setupPageModule({ yieldsSnapshot: null })
		const { getRWAAssetData } = await import('~/containers/RWA/queries')

		await expect(page.getStaticProps({ params: { asset: 'USDE' } } as never)).resolves.toMatchObject({
			props: { asset: TEST_ASSET }
		})
		expect(getRWAAssetData).toHaveBeenCalledWith({ assetId: 'asset-1', yieldsSnapshot: null })
	})

	it('getStaticProps redirects lowercase asset params to the canonical asset', async () => {
		const page = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'usde' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/rwa/asset/USDE',
				permanent: false
			}
		})
	})

	it('getStaticProps redirects mixed-case punctuation asset params to the exact canonical asset', async () => {
		const page = await setupPageModule({ idMap: { 'USDf-Falcon': 'asset-1' }, assetData: TEST_ASSET })

		await expect(page.getStaticProps({ params: { asset: 'usdf-falcon' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/rwa/asset/USDf-Falcon',
				permanent: false
			}
		})
	})

	it('getStaticProps resolves canonical asset ids through differently-cased idMap keys', async () => {
		const page = await setupPageModule({
			canonicalMarketIds: ['USDf-Falcon'],
			idMap: { 'usdf-falcon': 'asset-1' },
			assetData: TEST_ASSET
		})

		await expect(page.getStaticProps({ params: { asset: 'USDf-Falcon' } } as never)).resolves.toEqual({
			props: { asset: TEST_ASSET, canonicalMarketId: 'USDf-Falcon' },
			revalidate: 123
		})
	})

	it('getStaticProps returns notFound when a canonical asset has no detail id', async () => {
		const page = await setupPageModule({
			canonicalMarketIds: ['USDf-Falcon'],
			idMap: {},
			assetData: TEST_ASSET
		})

		await expect(page.getStaticProps({ params: { asset: 'USDf-Falcon' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	it('getStaticProps returns notFound for unknown asset params', async () => {
		const page = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'unknown' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	it('uses the canonical-cased asset slug in the canonical URL', async () => {
		const page = await setupPageModule()

		const element = page.default({ asset: TEST_ASSET, canonicalMarketId: 'USDE' } as never) as ReactElement<{
			canonicalUrl: string
		}>

		expect(element.props.canonicalUrl).toBe('/rwa/asset/USDE')
	})
})
