import type { GetStaticPropsContext } from 'next'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

function setupPageModule({
	routes = [{ ticker: 'NVDA', country: 'US' }],
	redirectSlug = 'NVDA:US',
	pageData = { ticker: 'NVDA', country: 'US', slug: 'NVDA:US', name: 'NVIDIA Corporation', unlocksSlug: 'nvda' }
}: {
	routes?: Array<{ ticker: string; country: string }>
	redirectSlug?: string | null
	pageData?: unknown
}) {
	const getEquitiesTickerPageData = vi.fn().mockResolvedValue(pageData)
	const getEquitiesTickerRedirectSlug = vi.fn().mockResolvedValue(redirectSlug)
	const metadataCache = {
		protocolDisplayNames: new Map([['hyperliquid-perps', 'Hyperliquid Perps']]),
		rwaList: {
			platforms: ['Felix', 'Robinhood']
		},
		emissionsProtocolBySlug: { nvda: 'nvda' },
		equitiesCompanyRoutes: routes,
		equitiesCompanySlugsSet: new Set(routes.map((route) => `${route.ticker}:${route.country}`))
	}

	vi.doMock('~/constants', () => ({
		SKIP_BUILD_STATIC_GENERATION: true
	}))
	vi.doMock('~/utils/metadata', () => ({
		default: metadataCache
	}))
	vi.doMock('~/containers/Equities/queries', () => ({
		getEquitiesTickerPageData,
		getEquitiesTickerPaths: vi.fn().mockResolvedValue([]),
		getEquitiesTickerRedirectSlug
	}))
	vi.doMock('~/containers/Equities/TickerPage', () => ({
		EquityTickerPage: () => null
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

	return {
		getEquitiesTickerPageData,
		getEquitiesTickerRedirectSlug,
		page: import('~/pages/equities/[ticker]')
	}
}

describe('equities ticker page routing', () => {
	it('loads canonical ticker-country slugs', async () => {
		const setup = setupPageModule({})
		const page = await setup.page

		await expect(
			page.getStaticProps({ params: { ticker: 'NVDA:US' } } as GetStaticPropsContext<{ ticker: string }>)
		).resolves.toEqual({
			props: {
				ticker: 'NVDA',
				country: 'US',
				slug: 'NVDA:US',
				name: 'NVIDIA Corporation',
				unlocksSlug: 'nvda'
			},
			revalidate: 123
		})
		expect(setup.getEquitiesTickerPageData).toHaveBeenCalledWith('NVDA', 'US', {
			protocolDisplayNames: new Map([['hyperliquid-perps', 'Hyperliquid Perps']]),
			rwaPlatforms: ['Felix', 'Robinhood'],
			emissionsProtocolBySlug: { nvda: 'nvda' }
		})
		expect(setup.getEquitiesTickerRedirectSlug).not.toHaveBeenCalled()
	})

	it('redirects noncanonical ticker-country slugs to backend-provided casing', async () => {
		const setup = setupPageModule({})
		const page = await setup.page

		await expect(
			page.getStaticProps({ params: { ticker: 'nvda:us' } } as GetStaticPropsContext<{ ticker: string }>)
		).resolves.toEqual({
			redirect: {
				destination: '/equities/NVDA:US',
				permanent: false
			}
		})
		expect(setup.getEquitiesTickerPageData).not.toHaveBeenCalled()
		expect(setup.getEquitiesTickerRedirectSlug).not.toHaveBeenCalled()
	})

	it('redirects lowercase dotted ticker aliases to backend-provided ticker-country casing', async () => {
		const setup = setupPageModule({
			routes: [{ ticker: 'BRK.A', country: 'US' }],
			pageData: { ticker: 'BRK.A', country: 'US', slug: 'BRK.A:US', name: 'Berkshire Hathaway Inc.' }
		})
		const page = await setup.page

		await expect(
			page.getStaticProps({ params: { ticker: 'brk.a:us' } } as GetStaticPropsContext<{ ticker: string }>)
		).resolves.toEqual({
			redirect: {
				destination: '/equities/BRK.A:US',
				permanent: false
			}
		})
		expect(setup.getEquitiesTickerPageData).not.toHaveBeenCalled()
		expect(setup.getEquitiesTickerRedirectSlug).not.toHaveBeenCalled()
	})

	it('redirects old ticker-only slugs when uniquely resolvable', async () => {
		const setup = setupPageModule({ redirectSlug: 'NVDA:US' })
		const page = await setup.page

		await expect(
			page.getStaticProps({ params: { ticker: 'nvda' } } as GetStaticPropsContext<{ ticker: string }>)
		).resolves.toEqual({
			redirect: {
				destination: '/equities/NVDA:US',
				permanent: false
			}
		})
		expect(setup.getEquitiesTickerRedirectSlug).toHaveBeenCalledWith('nvda', [
			{
				ticker: 'NVDA',
				country: 'US'
			}
		])
		expect(setup.getEquitiesTickerPageData).not.toHaveBeenCalled()
	})

	it('404s old ticker-only slugs when they are ambiguous or unknown', async () => {
		const setup = setupPageModule({ redirectSlug: null })
		const page = await setup.page

		await expect(
			page.getStaticProps({ params: { ticker: 'meta' } } as GetStaticPropsContext<{ ticker: string }>)
		).resolves.toEqual({ notFound: true })
	})

	it('404s unknown ticker-country slugs before loading page data', async () => {
		const setup = setupPageModule({})
		const page = await setup.page

		await expect(
			page.getStaticProps({ params: { ticker: 'tsla:us' } } as GetStaticPropsContext<{ ticker: string }>)
		).resolves.toEqual({ notFound: true })
		expect(setup.getEquitiesTickerPageData).not.toHaveBeenCalled()
		expect(setup.getEquitiesTickerRedirectSlug).not.toHaveBeenCalled()
	})
})
