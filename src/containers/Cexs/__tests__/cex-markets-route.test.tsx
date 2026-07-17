import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStaticProps as getCexStaticProps } from '~/pages/cex/[cex]'
import { getStaticProps as getCexAssetsStaticProps } from '~/pages/cex/assets/[cex]'
import { getStaticProps as getRetiredCexMarketsStaticProps } from '~/pages/cex/markets/[cex]'
import { getStaticProps as getCexStablecoinsStaticProps } from '~/pages/cex/stablecoins/[cex]'
import { cryptoComCexMetadataCache } from './metadataFixture'

const { resolveExchangeByDefillamaCexSlugMock } = vi.hoisted(() => ({
	resolveExchangeByDefillamaCexSlugMock: vi.fn()
}))

vi.mock('~/containers/Markets/server/dataset.server', () => ({
	resolveExchangeByDefillamaCexSlug: resolveExchangeByDefillamaCexSlugMock
}))

vi.mock('~/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/constants')>()
	return {
		...actual,
		SKIP_BUILD_STATIC_GENERATION: false
	}
})

vi.mock('~/utils/maxAgeForNext', () => ({
	maxAgeForNext: () => 123
}))

vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: (_label: string, fn: any) => fn
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: cryptoComCexMetadataCache,
	refreshMetadataIfStale: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('~/containers/ProtocolOverview/queries', () => ({
	getProtocolOverviewPageData: vi.fn(({ protocolId }: { protocolId: string }) =>
		Promise.resolve({
			name: protocolId,
			category: 'CEX',
			metrics: { tvl: true, stablecoins: true },
			seoTitle: protocolId,
			seoDescription: 'CEX overview'
		})
	)
}))

vi.mock('~/containers/ProtocolOverview/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/ProtocolOverview/api')>()
	return {
		...actual,
		fetchProtocolOverviewMetrics: vi.fn((slug: string) =>
			Promise.resolve({ name: slug, parentProtocol: null, otherProtocols: [], category: 'CEX' })
		)
	}
})

describe('CEX routes', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resolveExchangeByDefillamaCexSlugMock.mockImplementation((defillamaSlug: string) => {
			const key = defillamaSlug.toLowerCase()
			return key === 'crypto-com' || key === 'crypto.com'
				? Promise.resolve({ exchange: 'crypto-com', defillama_slug: 'Crypto.com' })
				: Promise.resolve(null)
		})
	})

	it('redirects mapped venues to the exchange profile Reserves tab without permanent caching', async () => {
		await expect(getCexStaticProps({ params: { cex: 'crypto-com' } } as never)).resolves.toEqual({
			redirect: { destination: '/exchange/crypto-com?section=reserves', permanent: false }
		})
		await expect(getCexAssetsStaticProps({ params: { cex: 'crypto-com' } } as never)).resolves.toEqual({
			redirect: { destination: '/exchange/crypto-com?section=reserves', permanent: false }
		})
		await expect(getCexStablecoinsStaticProps({ params: { cex: 'crypto-com' } } as never)).resolves.toEqual({
			redirect: { destination: '/exchange/crypto-com?section=reserves&reservesView=stablecoins', permanent: false }
		})
	})

	it('keeps rendering the legacy pages for venues without an exchange mapping', async () => {
		const overview = await getCexStaticProps({ params: { cex: 'no-markets' } } as never)
		expect(overview).toMatchObject({ props: { name: 'no-markets' }, revalidate: 123 })

		const assets = await getCexAssetsStaticProps({ params: { cex: 'no-markets' } } as never)
		expect(assets).toMatchObject({ props: { name: 'no-markets' }, revalidate: 123 })

		const stablecoins = await getCexStablecoinsStaticProps({ params: { cex: 'no-markets' } } as never)
		expect(stablecoins).toMatchObject({ props: { name: 'no-markets' }, revalidate: 123 })
	})

	it('redirects CEX aliases to canonical slugs before the exchange mapping check', async () => {
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

	it('redirects a retired CEX Markets URL to its canonical exchange profile', async () => {
		await expect(getRetiredCexMarketsStaticProps({ params: { cex: 'Crypto.com' } } as never)).resolves.toEqual({
			redirect: { destination: '/exchange/crypto-com', permanent: false }
		})
		expect(resolveExchangeByDefillamaCexSlugMock).toHaveBeenCalledWith('crypto-com')
	})

	it('returns notFound when a retired CEX Markets URL has no exchange mapping', async () => {
		await expect(getRetiredCexMarketsStaticProps({ params: { cex: 'missing' } } as never)).resolves.toEqual({
			notFound: true
		})
	})
})
