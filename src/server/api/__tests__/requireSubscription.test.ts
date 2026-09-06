import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { validateSubscriptionMock } = vi.hoisted(() => ({
	validateSubscriptionMock: vi.fn()
}))

vi.mock('~/utils/apiAuth', () => ({
	validateSubscription: validateSubscriptionMock
}))

import { requireSubscription } from '../requireSubscription'

beforeEach(() => {
	vi.clearAllMocks()
})

describe('requireSubscription', () => {
	test('returns valid subscription auth without writing a response', async () => {
		const auth = { valid: true, isTrial: false }
		const res = createMockNextApiResponse()
		validateSubscriptionMock.mockResolvedValue(auth)

		await expect(requireSubscription('Bearer ok', res)).resolves.toBe(auth)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.status).not.toHaveBeenCalled()
		expect(res.json).not.toHaveBeenCalled()
	})

	test('sends the subscription failure response and returns null', async () => {
		const res = createMockNextApiResponse()
		validateSubscriptionMock.mockResolvedValue({
			valid: false,
			status: 403,
			error: 'Active subscription required'
		})

		await expect(requireSubscription('Bearer bad', res)).resolves.toBeNull()

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer bad')
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Active subscription required' })
	})

	test('lets validation errors bubble to the caller', async () => {
		const error = new Error('Auth service unavailable')
		const res = createMockNextApiResponse()
		validateSubscriptionMock.mockRejectedValue(error)

		await expect(requireSubscription(undefined, res)).rejects.toBe(error)

		expect(res.status).not.toHaveBeenCalled()
		expect(res.json).not.toHaveBeenCalled()
	})
})
