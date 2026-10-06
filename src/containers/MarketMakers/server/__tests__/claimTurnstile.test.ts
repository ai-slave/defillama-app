import { afterEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { isClaimTurnstileEnabled, verifyClaimTurnstile } from '../claimTurnstile'

const http = installFixtureFetch()
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('verifyClaimTurnstile', () => {
	test('rejects a missing or oversized token without calling Cloudflare', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')

		expect(isClaimTurnstileEnabled()).toBe(true)
		await expect(verifyClaimTurnstile('', '192.0.2.1')).resolves.toEqual({ ok: false, reason: 'invalid' })
		await expect(verifyClaimTurnstile('x'.repeat(2049), '192.0.2.1')).resolves.toEqual({
			ok: false,
			reason: 'invalid'
		})
		expect(http.urls()).toEqual([])
	})

	test('accepts a claim-action token and forwards the client ip to Cloudflare', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
		http.serve({ [SITEVERIFY]: { success: true, action: 'claim', hostname: 'defillama.com', 'error-codes': [] } })

		await expect(verifyClaimTurnstile('claim-token', '192.0.2.2')).resolves.toEqual({ ok: true })

		const sent = http.requests[0].init?.body as FormData
		expect(sent.get('remoteip')).toBe('192.0.2.2')
	})

	test('rejects a valid token issued for another action', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
		http.serve({ [SITEVERIFY]: { success: true, action: 'signup' } })

		await expect(verifyClaimTurnstile('signup-token', '192.0.2.3')).resolves.toEqual({
			ok: false,
			reason: 'invalid'
		})
	})

	test('distinguishes invalid challenges from unavailable verification', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
		http.serveInOrder(SITEVERIFY, [
			{ success: false, 'error-codes': ['invalid-input-response'] },
			{ success: false, 'error-codes': ['invalid-input-secret'] },
			() => {
				throw new Error('network failure')
			}
		])

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

	test('reports unavailable if verification is called without a configured secret', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', '')

		expect(isClaimTurnstileEnabled()).toBe(false)
		await expect(verifyClaimTurnstile('claim-token', 'unknown')).resolves.toEqual({
			ok: false,
			reason: 'unavailable'
		})
		expect(http.urls()).toEqual([])
	})
})
