import { describe, expect, test, vi } from 'vitest'
import type { YieldsSnapshot } from '../data/snapshot'
import {
	readBorrowMarkets,
	readBorrowRoutes,
	readEarn,
	readLoops,
	readTokenKeys,
	readTrends,
	readYieldsDepegs,
	readYieldsExploits,
	readYieldsMeta
} from '../data/snapshot'
import { YIELDS_SNAPSHOT_FILES } from '../data/snapshot.contract'

describe('Yields v2 snapshot reader', () => {
	test('reads every artifact through the same pinned handle', async () => {
		const readJson = vi.fn()
		const snapshot: YieldsSnapshot = {
			generationId: 'test-gen',
			generatedAt: 0,
			async readJson<T>(path: string): Promise<T> {
				readJson(path)
				// `readEarn` joins three artifacts, so the handle has to return real collections.
				return [] as T
			}
		}

		await Promise.all([
			readEarn(snapshot),
			readTrends(snapshot),
			readBorrowMarkets(snapshot),
			readBorrowRoutes(snapshot),
			readLoops(snapshot),
			readTokenKeys(snapshot),
			readYieldsMeta(snapshot),
			readYieldsDepegs(snapshot),
			readYieldsExploits(snapshot)
		])

		// Order-independent: `readEarn` pulls its artifacts in parallel (meta twice: once for its join).
		expect([...new Set(readJson.mock.calls.map(([path]) => path))].sort()).toEqual(
			Object.values(YIELDS_SNAPSHOT_FILES).sort()
		)
	})

	// enrich.server.ts caches by the earn array's identity, so the join has to be stable per handle.
	test('returns one joined earn array for repeated reads of the same handle', async () => {
		const earn = [{ id: 'a' }, { id: 'b' }]
		const verified = [{ id: 'b', apy: { avg_1d: 1 } }]
		const snapshot: YieldsSnapshot = {
			generationId: 'test-gen',
			generatedAt: 0,
			async readJson<T>(path: string): Promise<T> {
				if (path === YIELDS_SNAPSHOT_FILES.meta) return { step_accrual_pool_ids: ['b'] } as T
				return (path === YIELDS_SNAPSHOT_FILES.earn ? earn : verified) as T
			}
		}

		const [first, second] = await Promise.all([readEarn(snapshot), readEarn(snapshot)])

		expect(first).toBe(second)
		expect(first).toBe(await readEarn(snapshot))
		expect(first[0]).toBe(earn[0])
		expect(first[1]).toMatchObject({ id: 'b', verified: { apy: { avg_1d: 1 }, step_accrual: true } })
	})
})
