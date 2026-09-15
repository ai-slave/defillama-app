import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

function setupPageModule() {
	const loadProfile = vi.fn().mockResolvedValue({ slug: 'coinbase' })
	vi.doMock('~/containers/Exchanges/ExchangeProfile', () => ({ ExchangeProfile: () => null }))
	vi.doMock('~/containers/Exchanges/master.api', () => ({ fetchExchangeVenueSeries: vi.fn() }))
	vi.doMock('~/containers/Exchanges/server/master.loaders', () => ({
		loadMasterExchangeProfile: loadProfile,
		MasterExchangeNotFoundError: class extends Error {}
	}))
	vi.doMock('~/layout', () => ({ default: () => null }))
	vi.doMock('~/utils/maxAgeForNext', () => ({ maxAgeForNext: () => 123 }))
	vi.doMock('~/utils/perf', () => ({ withPerformanceLogging: (_label: string, fn: unknown) => fn }))
	return { loadProfile, page: import('~/pages/exchange/[slug]') }
}

describe('exchange profile route slugs', () => {
	test('matches event names only through the canonical DefiLlama CEX slug', async () => {
		const { page } = setupPageModule()
		const { matchesDefillamaCex } = await page

		expect(matchesDefillamaCex('Binance', 'binance-cex')).toBe(true)
		expect(matchesDefillamaCex('Crypto.com', 'crypto-com')).toBe(true)
		expect(matchesDefillamaCex('Coinbase Pro', 'coinbase')).toBe(false)
	})

	test('derives the native token 24h change from canonical price history', async () => {
		const { page } = setupPageModule()
		const { nativeTokenChange24h } = await page

		expect(
			nativeTokenChange24h(110, 'coingecko:venue', {
				coins: { 'coingecko:venue': { prices: [{ timestamp: 1, price: 100 }] } }
			})
		).toBeCloseTo(10)
		expect(nativeTokenChange24h(110, null, { coins: {} })).toBeNull()
	})

	test('returns notFound for a noncanonical slug without loading a profile', async () => {
		const { loadProfile, page } = setupPageModule()

		await expect((await page).getStaticProps({ params: { slug: 'coinbase.eu' } } as never)).resolves.toEqual({
			notFound: true
		})
		expect(loadProfile).not.toHaveBeenCalled()
	})

	test('loads an exact canonical lowercase slug unchanged', async () => {
		const { loadProfile, page } = setupPageModule()

		await expect((await page).getStaticProps({ params: { slug: 'coinbase' } } as never)).resolves.toMatchObject({
			props: { profile: { slug: 'coinbase' } },
			revalidate: 123
		})
		expect(loadProfile).toHaveBeenCalledWith('coinbase')
	})
})
