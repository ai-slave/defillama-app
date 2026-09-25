import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { getCexAnalyticsMarketShare, getCexAnalyticsSnapshot } from '../analytics'

const llamaAny = vi.hoisted(() => vi.fn())
vi.mock('~/server/db/llama', () => ({ llamaDb: { any: llamaAny } }))

const metadata = installMetadataSeeder()

describe('getCexAnalyticsSnapshot', () => {
	beforeEach(() => {
		llamaAny.mockReset()
		metadata.seed({ cexs: [] })
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
				derivativesVolume24h: 1,
				openInterest: 5,
				avgLeverage: null,
				cleanTvl: 3
			},
			{
				loaded_at: '2026-01-01T00:00:00Z',
				venue: 'example',
				spotVolume24h: 1,
				derivativesVolume24h: 1,
				openInterest: 7,
				avgLeverage: null,
				cleanTvl: 6
			},
			{
				loaded_at: '2026-01-01T00:00:00Z',
				venue: 'example',
				spotVolume24h: 1,
				derivativesVolume24h: 1,
				openInterest: null,
				avgLeverage: null,
				cleanTvl: null
			},
			{
				loaded_at: '2026-01-01T00:00:00Z',
				venue: 'zero',
				spotVolume24h: 1,
				derivativesVolume24h: 1,
				openInterest: 0,
				avgLeverage: null,
				cleanTvl: 0
			}
		])
		const result = await getCexAnalyticsSnapshot()

		expect(result.rows.map(({ venue, openInterest, cleanTvl }) => ({ venue, openInterest, cleanTvl }))).toEqual([
			{ venue: 'Example', openInterest: 12, cleanTvl: 9 },
			{ venue: 'Zero', openInterest: 0, cleanTvl: 0 }
		])
		expect(result.summary).toMatchObject({ totalOpenInterest: 12, totalCleanTvl: 9 })
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
		const result = await getCexAnalyticsSnapshot()

		expect(result.summary.loadedAt).toBe('2026-02-01T00:00:00Z')
	})

	test('combines canonical venue aliases before selecting market-share leaders', async () => {
		metadata.seed({ cexs: [{ name: 'Binance', slug: 'binance' }] })
		llamaAny.mockResolvedValue([
			{ date: 1, venue: 'binance', spotVolume: 6, derivativesVolume: 0 },
			{ date: 1, venue: 'Binance', spotVolume: 5, derivativesVolume: 0 },
			{ date: 1, venue: 'competitor', spotVolume: 10, derivativesVolume: 0 }
		])
		const result = await getCexAnalyticsMarketShare('spot', 1)

		expect(result).toEqual([
			{ date: 1, venue: 'Binance', share: (11 / 21) * 100 },
			{ date: 1, venue: 'Other', share: (10 / 21) * 100 }
		])
	})
})
