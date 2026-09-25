import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { VerifiedRow } from '~/containers/Yields/data/types'
import { earnRow } from '~/utils/test/yieldsEarnFixture'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/test/yieldsSnapshotFixture'

const acquireYieldsSnapshot = vi.hoisted(() => vi.fn())
vi.mock('../server/dataset.server', () => ({ acquireYieldsSnapshot }))

import { yieldsEarnDataset } from '../server/api'

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

const snapshotWithVerifiedPool = () => yieldsSnapshot({ earn: [earnRow('pool-a', 1000)], earnVerified: [verified] })

const request = (headers: Record<string, string> = {}) => ({
	method: 'GET',
	url: '/api/public/yields/earn?page=1',
	query: { page: '1' },
	headers
})

beforeEach(() => {
	acquireYieldsSnapshot.mockReset()
})

describe('/api/public/yields/earn', () => {
	// One CDN-cached body serves everyone, so it can never carry the measurement. Subscribers read
	// /api/private/yields/earn-verified.
	test('serves the page with measured figures locked, even to a caller presenting a subscriber token', async () => {
		acquireYieldsSnapshot.mockResolvedValue(snapshotWithVerifiedPool())

		const result = await yieldsEarnDataset.handle(request({ authorization: 'Bearer subscriber-token' }))

		expect(result).toMatchObject({
			status: 200,
			body: { total: 1, rows: [{ id: 'pool-a', verified: null, verifiedApy: null, verifiedLocked: true }] }
		})
		expect(result.headers).toBeUndefined()
	})

	test('a snapshot that cannot be acquired is a 502', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		acquireYieldsSnapshot.mockRejectedValue(new Error('refresh failed'))

		expect(await yieldsEarnDataset.handle(request())).toMatchObject({ status: 502 })
	})
})
