import { beforeEach, describe, expect, test, vi } from 'vitest'
import { YIELDS_V2_SERVER_URL } from '~/constants'
import type { VerifiedBlock } from '~/containers/Yields/data/types'
import type { PoolDetail } from '~/containers/Yields/poolDetail/types'
import { handler } from '~/pages/api/private/yields/pool/[id]'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

const http = installFixtureFetch()

const MEASURED: VerifiedBlock = {
	apy: { avg_1d: 2.5, avg_7d: 2.4, avg_30d: 2.3 },
	apy_as_of: '2026-09-01T00:00:00Z',
	apy_confidence: 'high',
	exit: null,
	exit_liquidity: null,
	tvl: null
}

// The route reads through the page's per-id memo, so every case uses its own pools.
let counter = 0
const nextId = () => `b2b2b2b2-0000-4000-8000-${String(++counter).padStart(12, '0')}`
const earnUrl = (id: string) => `${YIELDS_V2_SERVER_URL}/v2/earn/${id}`
const verifiedUrl = (id: string) => `${YIELDS_V2_SERVER_URL}/v2/earn/verified/${id}`
const data = (body: unknown) => ({ data: body })

const detail = (id: string, overrides: Partial<PoolDetail> = {}) =>
	({
		id,
		apy: {
			current: { base: 2.3, reward: null, total: 2.3 },
			avg_7d: { base: 2.2, reward: null, total: 2.2 },
			avg_30d: { base: 2.1, reward: null, total: 2.1 }
		},
		intrinsic: null,
		reward_tokens: [],
		underlying_tokens: [],
		available_history: { supply: false, borrow: false },
		...overrides
	}) as PoolDetail

function servePool(id: string, overrides: Partial<PoolDetail> = {}) {
	http.serve({ [earnUrl(id)]: data(detail(id, overrides)), [verifiedUrl(id)]: data(MEASURED) })
}

/** A pool whose intrinsic leg comes from a measured source pool. */
function servePoolWithSource() {
	const id = nextId()
	const sourceId = nextId()
	servePool(id, {
		intrinsic: {
			apy: { current: { base: 1 }, avg_7d: { base: 1 }, avg_30d: { base: 1 } },
			source_pool: { id: sourceId, pool_token: null, symbol: 'stETH' }
		}
	})
	http.serve({
		[earnUrl(sourceId)]: data(detail(sourceId)),
		[verifiedUrl(sourceId)]: data({ ...MEASURED, apy: { avg_1d: 3.1, avg_7d: 3, avg_30d: 2.9 } })
	})
	return { id, sourceId }
}

async function call(query: Record<string, string>) {
	const res = createMockNextApiResponse()
	await handler({ query } as never, res as never)
	return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] }
}

const historyUrls = () => http.urls().filter((url) => url.includes('/history'))

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('/api/private/yields/pool/[id]', () => {
	test('serves the measured windows, fetching max history once for any requested range', async () => {
		const id = nextId()
		servePool(id, { available_history: { supply: true, borrow: false } })
		http.serve({ [`${earnUrl(id)}/history?range=max`]: data([]), [`${verifiedUrl(id)}/history?range=max`]: data([]) })

		const { status, body } = await call({ id, range: '30d' })

		expect(status).toBe(200)
		expect(body.verifiedWindows).toEqual([
			{ label: '24h', verified: 2.5 },
			{ label: '7d', verified: 2.4 },
			{ label: '30d', verified: 2.3 }
		])
		expect(historyUrls()).toEqual([`${earnUrl(id)}/history?range=max`, `${verifiedUrl(id)}/history?range=max`])
	})

	test("reads the intrinsic source pool's measurement and its max history", async () => {
		const { id, sourceId } = servePoolWithSource()
		const sourceDay = (date: string, pricePerShare: number | null) => ({
			date,
			outcome: null,
			eta_seconds: null,
			confidence: null,
			apy: { avg_1d: null, avg_7d: null, avg_30d: null },
			price_per_share: pricePerShare,
			exit_liquidity: null,
			tvl: null
		})
		http.serve({
			[`${earnUrl(sourceId)}/history?range=max`]: data([]),
			[`${verifiedUrl(sourceId)}/history?range=max`]: data([
				sourceDay('2026-08-01', 1.05),
				sourceDay('2026-08-02', null),
				sourceDay('2026-08-03', 1.052)
			])
		})

		const { status, body } = await call({ id, range: '30d' })

		expect(status).toBe(200)
		expect(http.urls()).toContain(verifiedUrl(sourceId))
		// Days without a measured rate leave a gap instead of a zero.
		expect(body.intrinsicSeries).toEqual({ '2026-08-01': 1.05, '2026-08-03': 1.052 })
		// Always max: the asset band rebases to whatever deposit day the reader picks.
		expect(historyUrls()).toEqual([
			`${earnUrl(sourceId)}/history?range=max`,
			`${verifiedUrl(sourceId)}/history?range=max`
		])
	})

	// The asset band is optional; losing it must not cost the reader the whole measured page.
	test('a source pool whose history cannot be fetched still serves the measured page', async () => {
		const { id, sourceId } = servePoolWithSource()
		http.serve({
			[`${earnUrl(sourceId)}/history?range=max`]: fixtureStatus(500),
			[`${verifiedUrl(sourceId)}/history?range=max`]: data([])
		})

		const { status, body } = await call({ id })

		expect(status).toBe(200)
		expect(body.verified).toEqual(MEASURED)
		expect(body.intrinsicSeries).toBeNull()
	})

	test('an unmeasured pool answers with no measurement, and an unknown one is a 404', async () => {
		const unmeasured = nextId()
		http.serve({ [earnUrl(unmeasured)]: data(detail(unmeasured)), [verifiedUrl(unmeasured)]: fixtureStatus(404) })
		expect(await call({ id: unmeasured })).toEqual({ status: 200, body: { verified: null } })

		const unknown = nextId()
		http.serve({ [earnUrl(unknown)]: fixtureStatus(404), [verifiedUrl(unknown)]: fixtureStatus(404) })
		expect(await call({ id: unknown })).toEqual({ status: 404, body: { error: 'Pool not found' } })
	})
})
