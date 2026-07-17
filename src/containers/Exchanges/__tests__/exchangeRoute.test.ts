import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

function setupPageModule() {
	const loadProfile = vi.fn().mockResolvedValue({ slug: 'coinbase-eu' })
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
	it('returns notFound for a noncanonical slug without loading a profile', async () => {
		const { loadProfile, page } = setupPageModule()

		await expect((await page).getStaticProps({ params: { slug: 'coinbase.eu' } } as never)).resolves.toEqual({
			notFound: true
		})
		expect(loadProfile).not.toHaveBeenCalled()
	})

	it('loads an exact canonical lowercase slug unchanged', async () => {
		const { loadProfile, page } = setupPageModule()

		await expect((await page).getStaticProps({ params: { slug: 'coinbase-eu' } } as never)).resolves.toMatchObject({
			props: { profile: { slug: 'coinbase-eu' } },
			revalidate: 123
		})
		expect(loadProfile).toHaveBeenCalledWith('coinbase-eu')
	})
})
