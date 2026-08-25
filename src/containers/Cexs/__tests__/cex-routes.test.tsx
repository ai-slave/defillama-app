import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStaticProps as getCexStaticProps } from '~/pages/cex/[cex]'
import { getStaticProps as getCexAssetsStaticProps } from '~/pages/cex/assets/[cex]'
import { getStaticProps as getCexStablecoinsStaticProps } from '~/pages/cex/stablecoins/[cex]'
import { resolveCexParamFromMetadata } from '../server/routes'
import { cryptoComCexMetadataCache } from './metadataFixture'

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
	})

	it('renders the legacy pages even when the venue has an exchange profile', async () => {
		const overview = await getCexStaticProps({ params: { cex: 'crypto-com' } } as never)
		expect(overview).toMatchObject({ props: { name: 'crypto-com' }, revalidate: 123 })

		const assets = await getCexAssetsStaticProps({ params: { cex: 'crypto-com' } } as never)
		expect(assets).toMatchObject({
			props: { name: 'crypto-com', metrics: { tvl: true, stablecoins: true } },
			revalidate: 123
		})

		const stablecoins = await getCexStablecoinsStaticProps({ params: { cex: 'crypto-com' } } as never)
		expect(stablecoins).toMatchObject({
			props: { name: 'crypto-com', metrics: { tvl: true, stablecoins: true } },
			revalidate: 123
		})
	})

	it('redirects CEX aliases to canonical slugs', async () => {
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

	it('keeps a metadata-only CEX route valid without list presentation metadata', () => {
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
