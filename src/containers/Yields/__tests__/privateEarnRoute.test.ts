import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { VerifiedRow } from '~/containers/Yields/data/types'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'
import { earnRow } from '~/utils/test/yieldsEarnFixture'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/test/yieldsSnapshotFixture'

const { acquireYieldsSnapshot, validateSubscription } = vi.hoisted(() => ({
	acquireYieldsSnapshot: vi.fn(),
	validateSubscription: vi.fn()
}))
vi.mock('~/containers/Yields/server/dataset.server', () => ({ acquireYieldsSnapshot }))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription }))

import handler from '~/pages/api/private/yields/earn-verified'

installYieldsFixtures()

const verified: VerifiedRow = {
	id: 'pool-a',
	apy: { avg_1d: 2.58, avg_7d: 2.5, avg_30d: 2.4 },
	apy_as_of: new Date().toISOString(),
	apy_confidence: 'high',
	exit: null,
	exit_liquidity: null,
	tvl: null
}

beforeEach(() => {
	acquireYieldsSnapshot
		.mockReset()
		.mockResolvedValue(yieldsSnapshot({ earn: [earnRow('pool-a', 1000)], earnVerified: [verified] }))
	validateSubscription.mockReset()
})

async function call(authorization: string) {
	const res = createMockNextApiResponse()
	await handler({ method: 'GET', query: { page: '1' }, headers: { authorization } } as never, res as never)
	return res
}

describe('/api/private/yields/earn-verified', () => {
	// The counterpart to the public route always being locked: this is where the measurement is
	// allowed out, and it is the only place, so it must never reach a shared cache.
	test('serves an active subscriber the measured rows, privately', async () => {
		validateSubscription.mockResolvedValue({ valid: true, isTrial: false })

		const res = await call('Bearer sub-token')

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json.mock.calls[0][0].rows[0]).toMatchObject({ id: 'pool-a', verified: { apy: verified.apy } })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
	})

	// Authenticated is not the same as subscribed.
	test('refuses a signed-in reader with no active subscription', async () => {
		validateSubscription.mockResolvedValue({ valid: false, status: 403, error: 'Active subscription required' })

		const res = await call('Bearer signed-in-but-free')

		expect(res.status).toHaveBeenCalledWith(403)
		expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('2.58')
	})
})
