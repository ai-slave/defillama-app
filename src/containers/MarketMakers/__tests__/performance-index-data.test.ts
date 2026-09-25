import { afterEach, describe, expect, test, vi } from 'vitest'
import { getPerformanceIndexProps, mergePerformanceIndex } from '../PerformanceIndex/data'

describe('mergePerformanceIndex', () => {
	test('maps performance rows (incl. engagements/FDV) and keys aggregated by marketMakerId', () => {
		const performance = [
			{
				marketMakerId: 'lhava',
				marketMakerName: 'Lhava',
				marketMakerImageUrl: null,
				composite: 9.5,
				tradingKpis: 9,
				trustIntegration: 8,
				coverageCapabilities: 7,
				uptime: 6,
				integrationLevel: 3,
				integrationStatus: 'full',
				activeEngagementsCount: 12,
				medianEngagementsFdv: 250_000_000
			}
		]
		const aggregated = [
			{
				marketMakerId: 'lhava',
				marketMakerName: 'Lhava',
				marketMakerImageUrl: null,
				bidAskDepth: { value: 1_000_000, percentile: 90, rank: 1 },
				topOfBookSpread: { value: 0.12, percentile: 80, rank: 2 },
				dailyFillVolume: { value: 5_000_000, percentile: 95, rank: 1 },
				combinedUptime: { value: 99.5, percentile: 99, rank: 1 }
			}
		]

		const merged = mergePerformanceIndex(performance, aggregated)

		expect(merged.performanceRows).toHaveLength(1)
		expect(merged.performanceRows[0].composite).toBe(9.5)
		expect(merged.performanceRows[0].activeEngagementsCount).toBe(12)
		expect(merged.performanceRows[0].medianEngagementsFdv).toBe(250_000_000)
		expect(merged.aggregated.lhava.bidAskDepth?.value).toBe(1_000_000)
	})

	test('tolerates missing fields', () => {
		const merged = mergePerformanceIndex([{ marketMakerId: 'gsr', marketMakerName: 'GSR' }], [])
		expect(merged.performanceRows[0].composite).toBeNull()
		expect(merged.performanceRows[0].activeEngagementsCount).toBeNull()
		expect(merged.performanceRows[0].medianEngagementsFdv).toBeNull()
		expect(merged.aggregated.gsr).toBeUndefined()
	})

	test('returns empty structures for non-array payloads', () => {
		const merged = mergePerformanceIndex(null, undefined)
		expect(merged.performanceRows).toEqual([])
		expect(merged.aggregated).toEqual({})
	})
})

describe('getPerformanceIndexProps', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	test('asks both endpoints for the default 30-day window and merges their rows', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date(Date.UTC(2026, 5, 29)))
		const forgdFetch = vi.fn(async (path: string, _query?: Record<string, string | number | undefined>) => {
			if (path === '/market-maker/leaderboard/performance')
				return [{ marketMakerId: 'lhava', marketMakerName: 'Lhava' }]
			return [{ marketMakerId: 'lhava', marketMakerName: 'Lhava', bidAskDepth: { value: 1, percentile: 1, rank: 1 } }]
		})

		const props = await getPerformanceIndexProps(forgdFetch as any)

		const range = { start_date: '2026-05-30', end_date: '2026-06-29' }
		expect(forgdFetch.mock.calls).toEqual([
			['/market-maker/leaderboard/performance', range],
			['/market-maker/leaderboard/aggregated', range]
		])
		expect(props.performanceRows.map((row) => row.marketMakerId)).toEqual(['lhava'])
		expect(Object.keys(props.aggregated)).toEqual(['lhava'])
	})
})
