import { beforeEach, describe, expect, test, vi } from 'vitest'

const { llamaAny, metadata } = vi.hoisted(() => ({
	llamaAny: vi.fn(),
	metadata: { cexs: [] as Array<{ name: string; slug?: string }> }
}))

vi.mock('~/server/db/llama', () => ({ llamaDb: { any: llamaAny } }))
vi.mock('~/utils/metadata', () => ({ default: metadata }))

describe('getCexAnalyticsSnapshot', () => {
	beforeEach(() => {
		llamaAny.mockReset()
		metadata.cexs = []
	})

	test('preserves unavailable stock metrics instead of inventing zero', async () => {
		llamaAny.mockResolvedValue([
			{
				loaded_at: '2026-01-01T00:00:00Z',
				venue: 'example',
				spotVolume24h: 0,
				derivativesVolume24h: 0,
				openInterest: null,
				avgLeverage: null,
				cleanTvl: null
			}
		])
		const { getCexAnalyticsSnapshot } = await import('./analytics')

		const result = await getCexAnalyticsSnapshot()

		expect(result.rows[0]).toMatchObject({ openInterest: null, cleanTvl: null })
		expect(result.summary).toMatchObject({ totalOpenInterest: null, totalCleanTvl: null })
	})

	test('sums known zero and positive stock metrics while ignoring missing contributors', async () => {
		llamaAny.mockResolvedValue([
			{
				loaded_at: '2026-01-01T00:00:00Z',
				venue: 'example',
				spotVolume24h: 1,
				derivativesVolume24h: 2,
				openInterest: null,
				avgLeverage: null,
				cleanTvl: 0
			},
			{
				loaded_at: '2026-01-01T00:00:00Z',
				venue: 'example',
				spotVolume24h: 3,
				derivativesVolume24h: 4,
				openInterest: 5,
				avgLeverage: 2,
				cleanTvl: 6
			}
		])
		const { getCexAnalyticsSnapshot } = await import('./analytics')

		const result = await getCexAnalyticsSnapshot()

		expect(result.rows[0]).toMatchObject({ openInterest: 5, cleanTvl: 6 })
		expect(result.summary).toMatchObject({ totalOpenInterest: 5, totalCleanTvl: 6 })
	})

	test('reports the latest source timestamp for the snapshot', async () => {
		llamaAny.mockResolvedValue([
			{
				loaded_at: '2026-01-01T00:00:00Z',
				venue: 'older',
				spotVolume24h: 0,
				derivativesVolume24h: 0,
				openInterest: null,
				avgLeverage: null,
				cleanTvl: null
			},
			{
				loaded_at: '2026-02-01T00:00:00Z',
				venue: 'newer',
				spotVolume24h: 0,
				derivativesVolume24h: 0,
				openInterest: null,
				avgLeverage: null,
				cleanTvl: null
			}
		])
		const { getCexAnalyticsSnapshot } = await import('./analytics')

		const result = await getCexAnalyticsSnapshot()

		expect(result.summary.loadedAt).toBe('2026-02-01T00:00:00Z')
	})

	test('combines canonical venue aliases before selecting market-share leaders', async () => {
		metadata.cexs = [{ name: 'Binance', slug: 'binance' }]
		llamaAny.mockResolvedValue([
			{ date: 1, venue: 'binance', spotVolume: 6, derivativesVolume: 0 },
			{ date: 1, venue: 'Binance', spotVolume: 5, derivativesVolume: 0 },
			{ date: 1, venue: 'competitor', spotVolume: 10, derivativesVolume: 0 }
		])
		const { getCexAnalyticsMarketShare } = await import('./analytics')

		const result = await getCexAnalyticsMarketShare('spot', 1)

		expect(result).toEqual([
			{ date: 1, venue: 'Binance', share: (11 / 21) * 100 },
			{ date: 1, venue: 'Other', share: (10 / 21) * 100 }
		])
	})
})
