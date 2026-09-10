// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

/** Records what the page hands its layout, so the assertions mount the page instead of calling it. */
const layoutProps: Array<Record<string, unknown>> = []

afterEach(() => {
	layoutProps.length = 0
	vi.clearAllMocks()
	vi.resetModules()
})

/** Mounts a page component the way the app does, so the React Compiler runtime has a render to sit in. */
async function mount(element: ReactNode): Promise<void> {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	await act(async () => root.render(element))
}

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
	canonicalMarketIds?: Array<string>
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
		default: ({ children, ...props }: { children?: ReactNode }) => {
			layoutProps.push(props)
			return children
		}
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
	test('getStaticProps resolves an exact canonical asset param', async () => {
		const page = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'USDE' } } as never)).resolves.toEqual({
			props: { asset: TEST_ASSET, canonicalMarketId: 'USDE' },
			revalidate: 123
		})
	})

	test('keeps the asset page when the optional Yields snapshot is unavailable', async () => {
		const page = await setupPageModule({ yieldsSnapshot: null })
		const { getRWAAssetData } = await import('~/containers/RWA/queries')

		await expect(page.getStaticProps({ params: { asset: 'USDE' } } as never)).resolves.toMatchObject({
			props: { asset: TEST_ASSET }
		})
		expect(getRWAAssetData).toHaveBeenCalledWith({ assetId: 'asset-1', yieldsSnapshot: null })
	})

	test('getStaticProps redirects lowercase asset params to the canonical asset', async () => {
		const page = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'usde' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/rwa/asset/USDE',
				permanent: false
			}
		})
	})

	test('getStaticProps redirects mixed-case punctuation asset params to the exact canonical asset', async () => {
		const page = await setupPageModule({ idMap: { 'USDf-Falcon': 'asset-1' }, assetData: TEST_ASSET })

		await expect(page.getStaticProps({ params: { asset: 'usdf-falcon' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/rwa/asset/USDf-Falcon',
				permanent: false
			}
		})
	})

	test('getStaticProps resolves canonical asset ids through differently-cased idMap keys', async () => {
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

	test('getStaticProps returns notFound when a canonical asset has no detail id', async () => {
		const page = await setupPageModule({
			canonicalMarketIds: ['USDf-Falcon'],
			idMap: {},
			assetData: TEST_ASSET
		})

		await expect(page.getStaticProps({ params: { asset: 'USDf-Falcon' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('getStaticProps returns notFound for unknown asset params', async () => {
		const page = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'unknown' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('uses the canonical-cased asset slug in the canonical URL', async () => {
		const page = await setupPageModule()
		const Page = page.default

		await mount(<Page asset={TEST_ASSET as never} canonicalMarketId="USDE" />)

		expect(layoutProps[0].canonicalUrl).toBe('/rwa/asset/USDE')
	})
})
