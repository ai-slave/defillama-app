import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchWithPoolingOnServer = vi.hoisted(() => vi.fn())

vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer }))

import { fetchAuthenticatedUserId } from './auth'

describe('fetchAuthenticatedUserId', () => {
	beforeEach(() => {
		fetchWithPoolingOnServer.mockReset()
	})

	it('returns the user id only after PocketBase validates the token', async () => {
		fetchWithPoolingOnServer.mockResolvedValue({
			ok: true,
			json: async () => ({ record: { id: 'owner-1' } })
		})

		await expect(fetchAuthenticatedUserId('valid-token')).resolves.toBe('owner-1')
		expect(fetchWithPoolingOnServer).toHaveBeenCalledWith(
			expect.stringContaining('/api/collections/users/auth-refresh'),
			{ method: 'POST', headers: { Authorization: 'Bearer valid-token' } }
		)
	})

	it('does not trust an unvalidated token', async () => {
		fetchWithPoolingOnServer.mockResolvedValue({ ok: false })

		await expect(fetchAuthenticatedUserId('invalid-token')).resolves.toBeNull()
	})
})
