import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { getEarnPage, acquireYieldsSnapshot, validateSubscription } = vi.hoisted(() => ({
	getEarnPage: vi.fn(),
	acquireYieldsSnapshot: vi.fn(),
	validateSubscription: vi.fn()
}))
vi.mock('~/containers/Yields/data/earn.server', () => ({ getEarnPage }))
vi.mock('~/containers/Yields/server/dataset.server', () => ({ acquireYieldsSnapshot }))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription }))

import handler from '~/pages/api/private/yields/earn-verified'

const VERIFIED_ROW = {
	id: 'p',
	apy: 2.58,
	apyBase: 2.58,
	verifiedApy: 2.58,
	reportedApyBase: 2.38,
	verified: { apy: { avg_1d: 2.58 }, confidence: 'high' }
}

function request(headers: Record<string, string> = {}) {
	return { method: 'GET', query: { page: '1' }, headers } as never
}

beforeEach(() => {
	vi.clearAllMocks()
	acquireYieldsSnapshot.mockResolvedValue({ generationId: 'g' })
	getEarnPage.mockResolvedValue({ rows: [VERIFIED_ROW], total: 1, page: 1, pageSize: 50, hasMore: false })
})

describe('/api/private/yields/earn-verified', () => {
	// The counterpart to the public route always being redacted: this is where the measurement is
	// allowed out, and it is the only place.
	test('serves the measured rows to an active subscriber', async () => {
		validateSubscription.mockResolvedValue({ valid: true, isTrial: false })
		const res = createMockNextApiResponse()

		await handler(request({ authorization: 'Bearer sub-token' }), res as never)

		expect(getEarnPage).toHaveBeenCalledWith(expect.anything(), { page: '1' }, { verifiedAccess: true })
		expect(res.status).toHaveBeenCalledWith(200)
		expect(JSON.stringify(res.json.mock.calls[0][0])).toContain('"verified"')
	})

	// Authenticated is not the same as subscribed.
	test('refuses a signed-in reader with no active subscription, without computing the page', async () => {
		validateSubscription.mockResolvedValue({ valid: false, status: 403, error: 'Active subscription required' })
		const res = createMockNextApiResponse()

		await handler(request({ authorization: 'Bearer signed-in-but-free' }), res as never)

		expect(res.status).toHaveBeenCalledWith(403)
		expect(getEarnPage).not.toHaveBeenCalled()
	})

	test('never lets the measured page into a shared cache', async () => {
		validateSubscription.mockResolvedValue({ valid: true, isTrial: false })
		const res = createMockNextApiResponse()

		await handler(request({ authorization: 'Bearer sub-token' }), res as never)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
	})
})
