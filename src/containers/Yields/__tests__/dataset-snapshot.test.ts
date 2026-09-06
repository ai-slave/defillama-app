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
				return path as T
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

		expect(readJson.mock.calls.map(([path]) => path)).toEqual(Object.values(YIELDS_SNAPSHOT_FILES))
	})
})
