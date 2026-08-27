import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

async function setupPageModule({
	assets = ['S&P 500 Index'],
	data = null
}: { assets?: string[]; data?: unknown } = {}) {
	const getRWAPerpsAssetPage = vi.fn().mockResolvedValue(data)
	vi.doMock('~/constants', () => ({
		SKIP_BUILD_STATIC_GENERATION: false
	}))
	vi.doMock('~/utils/metadata', () => ({
		default: {
			rwaPerpsList: {
				contracts: [],
				venues: [],
				categories: [],
				assets,
				assetGroups: [],
				total: assets.length
			}
		}
	}))
	vi.doMock('~/containers/RWA/Perps/Dashboard', () => ({
		RWAPerpsDashboard: () => null
	}))
	vi.doMock('~/containers/RWA/Perps/queries', () => ({ getRWAPerpsAssetPage }))
	vi.doMock('~/containers/RWA/Perps/TabNav', () => ({
		RWAPerpsTabNav: () => null
	}))
	vi.doMock('~/layout', () => ({
		default: () => null
	}))
	vi.doMock('~/utils/maxAgeForNext', () => ({
		maxAgeForNext: () => 123
	}))
	vi.doMock('~/utils/perf', () => ({
		withPerformanceLogging: (_label: string, fn: unknown) => fn
	}))

	return {
		page: await import('~/pages/rwa/perps/asset/[asset]'),
		getRWAPerpsAssetPage
	}
}

describe('rwa perps asset page', () => {
	it('getStaticPaths slugifies known assets', async () => {
		const { page } = await setupPageModule({ assets: ['S&P 500 Index', 'Gold'] })

		await expect(page.getStaticPaths()).resolves.toEqual({
			paths: [{ params: { asset: 's-p-500-index' } }, { params: { asset: 'gold' } }],
			fallback: 'blocking'
		})
	})

	it('returns notFound before fetching an unknown asset', async () => {
		const { page, getRWAPerpsAssetPage } = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'gold' } } as never)).resolves.toEqual({ notFound: true })
		expect(getRWAPerpsAssetPage).not.toHaveBeenCalled()
	})

	it('uses cached metadata for canonical identity and navigation', async () => {
		const data = { asset: 'S&P 500 Index' }
		const { page, getRWAPerpsAssetPage } = await setupPageModule({ assets: ['S&P 500 Index', 'Gold'], data })

		await expect(page.getStaticProps({ params: { asset: 's-p-500-index' } } as never)).resolves.toEqual({
			props: { data },
			revalidate: 123
		})
		expect(getRWAPerpsAssetPage).toHaveBeenCalledWith({
			asset: 'S&P 500 Index',
			assetLinks: [
				{ label: 'All', to: '/rwa/perps/assets' },
				{ label: 'S&P 500 Index', to: '/rwa/perps/asset/s-p-500-index' },
				{ label: 'Gold', to: '/rwa/perps/asset/gold' }
			],
			activeView: 'timeSeries'
		})
	})

	it('redirects noncanonical asset params', async () => {
		const { page, getRWAPerpsAssetPage } = await setupPageModule()

		await expect(page.getStaticProps({ params: { asset: 'S&P 500 Index' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/rwa/perps/asset/s-p-500-index',
				permanent: false
			}
		})
		expect(getRWAPerpsAssetPage).not.toHaveBeenCalled()
	})
})
