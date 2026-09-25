import { describe, expect, test } from 'vitest'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'
import { getEarnPage } from '../earn.server'
import { apyOf, pool } from './earnSnapshot'

installYieldsFixtures()

const withTvl = (id: string, tvl: number) => pool(id, { tvl_usd: tvl, apy: apyOf(1) })

// Page rows are built once per prepared table, so the same row object across calls means the
// second call sliced the memoized table instead of preparing it again.
describe('getEarnPage prepared-rows memoization', () => {
	test('prepares once per (generation, filters) and slices every page from it', async () => {
		const snapshot = yieldsSnapshot({
			earn: Array.from({ length: 120 }, (_, index) => withTvl(`p${index}`, 1000 - index))
		})

		const first = await getEarnPage(snapshot, { pageSize: '50' })
		const second = await getEarnPage(snapshot, { page: '2', pageSize: '50' })
		const firstAgain = await getEarnPage(snapshot, { pageSize: '50' })

		expect(first.rows.map((row) => row.id).slice(0, 2)).toEqual(['p0', 'p1'])
		expect(second.rows.map((row) => row.id).slice(0, 2)).toEqual(['p50', 'p51'])
		expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(100)
		expect(firstAgain.rows[0]).toBe(first.rows[0])
	})

	test('re-prepares when filters change and when the generation changes', async () => {
		const earn = [withTvl('a', 10), withTvl('b', 5)]
		const snapshot = yieldsSnapshot({ earn })

		const all = await getEarnPage(snapshot, {})
		const filtered = await getEarnPage(snapshot, { minTvl: '7' })
		const nextGeneration = await getEarnPage(yieldsSnapshot({ earn }), {})

		expect(filtered.rows.map((row) => row.id)).toEqual(['a'])
		expect(filtered.rows[0]).not.toBe(all.rows[0])
		expect(nextGeneration.rows[0]).not.toBe(all.rows[0])
	})

	test('signs page/pageSize out but sort in', async () => {
		const snapshot = yieldsSnapshot({ earn: [withTvl('a', 10), withTvl('b', 5)] })

		const desc = await getEarnPage(snapshot, {})
		const asc = await getEarnPage(snapshot, { sortBy: 'tvl', sortDesc: 'false' })

		expect(desc.rows.map((row) => row.id)).toEqual(['a', 'b'])
		expect(asc.rows.map((row) => row.id)).toEqual(['b', 'a'])
	})

	test('keeps the wire contract for clamped pages and pageSize=all', async () => {
		const snapshot = yieldsSnapshot({ earn: Array.from({ length: 7 }, (_, index) => withTvl(`p${index}`, 7 - index)) })

		const clamped = await getEarnPage(snapshot, { page: '99', pageSize: '3' })
		expect(clamped).toMatchObject({ page: 3, pageSize: 3, total: 7, hasMore: false })
		expect(clamped.rows).toHaveLength(1)

		const all = await getEarnPage(snapshot, { pageSize: 'all' })
		expect(all).toMatchObject({ page: 1, pageSize: 7, total: 7, hasMore: false })
		expect(all.rows).toHaveLength(7)
	})
})
