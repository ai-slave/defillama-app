import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RWA_SERVER_URL, SERVER_URL } from '~/constants'
import { clearResultCache } from '~/server/api/resultCache'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { earnRow } from '~/utils/testing/yieldsEarnFixture'
import { yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'
import { subscriptionCoverage } from '../server/api'

const acquire = vi.hoisted(() => vi.fn())
vi.mock('~/containers/Yields/server/dataset.server', async () => ({
	acquireYieldsSnapshot: acquire,
	readEarn: (await import('~/containers/Yields/data/snapshot')).readEarn
}))
const http = installFixtureFetch()
const request = { method: 'GET', url: '/api/public/subscription/coverage', query: {}, headers: {} }
beforeEach(() => {
	clearResultCache()
	vi.useFakeTimers()
	vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
	acquire.mockResolvedValue(yieldsSnapshot({ earn: [earnRow('one', 1000), earnRow('two', 2000)] }))
	http.serve({
		[`${SERVER_URL}/lite/protocols2`]: {
			protocols: [
				{ listedAt: Date.parse('2026-10-07T12:00:00Z') / 1000 },
				{ listedAt: Date.parse('2026-09-30T12:00:01Z') / 1000 },
				{ listedAt: Date.parse('2026-09-30T12:00:00Z') / 1000 },
				{ listedAt: Date.parse('2026-10-08T12:00:00Z') / 1000 },
				{}
			],
			chains: ['Ethereum', 'Solana', 'Base'],
			parentProtocols: [{ id: 'parent#one' }]
		},
		[`${RWA_SERVER_URL}/stats`]: { assetCount: 4231 }
	})
})
afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	clearResultCache()
})

test('counts current datasets without parents and only listings inside the trailing seven days', async () => {
	expect(await subscriptionCoverage.handle(request)).toMatchObject({
		status: 200,
		body: { protocols: 5, protocolsAddedThisWeek: 2, chains: 3, yieldPools: 2, rwaAssets: 4231 }
	})
	// A new snapshot is visible even while the independent upstream totals remain cached.
	acquire.mockResolvedValue(yieldsSnapshot({ earn: [earnRow('one', 1000)] }))
	expect(await subscriptionCoverage.handle(request)).toMatchObject({ status: 200, body: { yieldPools: 1 } })
	vi.advanceTimersByTime(5 * 60 * 1000 + 1)
	http.serve({ [`${RWA_SERVER_URL}/stats`]: { assetCount: 4232 } })
	expect(await subscriptionCoverage.handle(request)).toMatchObject({
		status: 200,
		body: { protocolsAddedThisWeek: 1, rwaAssets: 4232 }
	})
})

test('missing upstream data fails without publishing fictional coverage totals', async () => {
	vi.spyOn(console, 'error').mockImplementation(() => {})
	acquire.mockRejectedValue(new Error('Snapshot unavailable'))
	expect(await subscriptionCoverage.handle(request)).toMatchObject({ status: 502 })
})
