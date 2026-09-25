import { describe, expect, test } from 'vitest'
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
	test('reads each artifact from its own file on the pinned handle', async () => {
		const snapshot: YieldsSnapshot = {
			generationId: 'test-gen',
			generatedAt: 0,
			async readJson<T>(path: string): Promise<T> {
				if (path === YIELDS_SNAPSHOT_FILES.earnVerified) return [] as T
				if (path === YIELDS_SNAPSHOT_FILES.meta) return { from: path } as T
				return [{ from: path }] as T
			}
		}

		expect(
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
		).toEqual([
			[{ from: 'earn.json' }],
			[{ from: 'trends.json' }],
			[{ from: 'borrow-markets.json' }],
			[{ from: 'borrow-routes.json' }],
			[{ from: 'loops.json' }],
			[{ from: 'token-keys.json' }],
			{ from: 'meta.json' },
			[{ from: 'depegs.json' }],
			[{ from: 'exploits.json' }]
		])
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
