import { afterEach, describe, expect, it, vi } from 'vitest'
import { isClaimTurnstileEnabled, verifyClaimTurnstile } from '../claimTurnstile'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('verifyClaimTurnstile', () => {
	it('rejects a missing or oversized token without calling Cloudflare', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)

		expect(isClaimTurnstileEnabled()).toBe(true)
		await expect(verifyClaimTurnstile('', '192.0.2.1')).resolves.toEqual({ ok: false, reason: 'invalid' })
		await expect(verifyClaimTurnstile('x'.repeat(2049), '192.0.2.1')).resolves.toEqual({
			ok: false,
			reason: 'invalid'
		})
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('validates the claim action and sends the trusted client ip', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				Response.json({ success: true, action: 'claim', hostname: 'defillama.com', 'error-codes': [] })
			)
		vi.stubGlobal('fetch', fetchMock)

		await expect(verifyClaimTurnstile('claim-token', '192.0.2.2')).resolves.toEqual({ ok: true })

		expect(fetchMock).toHaveBeenCalledWith(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
		)
		const requestBody = fetchMock.mock.calls[0][1].body as FormData
		expect(requestBody.get('secret')).toBe('claim-secret')
		expect(requestBody.get('response')).toBe('claim-token')
		expect(requestBody.get('remoteip')).toBe('192.0.2.2')
	})

	it('rejects a valid token issued for another action', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, action: 'signup' })))

		await expect(verifyClaimTurnstile('signup-token', '192.0.2.3')).resolves.toEqual({
			ok: false,
			reason: 'invalid'
		})
	})

	it('distinguishes invalid challenges from unavailable verification', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ success: false, 'error-codes': ['invalid-input-response'] }))
				.mockResolvedValueOnce(Response.json({ success: false, 'error-codes': ['invalid-input-secret'] }))
				.mockRejectedValueOnce(new Error('network failure'))
		)

		await expect(verifyClaimTurnstile('bad-token', '192.0.2.4')).resolves.toEqual({
			ok: false,
			reason: 'invalid'
		})
		await expect(verifyClaimTurnstile('valid-shape', '192.0.2.4')).resolves.toEqual({
			ok: false,
			reason: 'unavailable'
		})
		await expect(verifyClaimTurnstile('valid-shape', '192.0.2.4')).resolves.toEqual({
			ok: false,
			reason: 'unavailable'
		})
	})

	it('reports unavailable if verification is called without a configured secret', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', '')
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)

		expect(isClaimTurnstileEnabled()).toBe(false)
		await expect(verifyClaimTurnstile('claim-token', 'unknown')).resolves.toEqual({
			ok: false,
			reason: 'unavailable'
		})
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
