import { describe, expect, it } from 'vitest'
import { readGoogleAuthResult } from '~/auth'

describe('readGoogleAuthResult', () => {
	it('accepts authenticated sessions and preserves new-account state', () => {
		expect(
			readGoogleAuthResult({
				isNew: true,
				kind: 'authenticated',
				token: 'pocketbase-token',
				user: { email: 'person@example.com', id: 'user-1', verified: true }
			})
		).toEqual({
			isNew: true,
			kind: 'authenticated',
			token: 'pocketbase-token',
			user: { email: 'person@example.com', id: 'user-1', verified: true }
		})
	})

	it('treats link confirmation sessions as existing accounts', () => {
		expect(
			readGoogleAuthResult({
				kind: 'authenticated',
				token: 'pocketbase-token',
				user: { email: 'person@example.com', id: 'user-1', verified: true }
			})
		).toMatchObject({ isNew: false, kind: 'authenticated' })
	})

	it('accepts link-verification challenges', () => {
		expect(
			readGoogleAuthResult({
				challengeToken: 'challenge-token',
				expiresAt: '2026-08-20T00:10:00.000Z',
				kind: 'link_verification_required',
				resendAfter: '2026-08-20T00:01:00.000Z'
			})
		).toMatchObject({ challengeToken: 'challenge-token', kind: 'link_verification_required' })
	})

	it('rejects malformed server responses', () => {
		expect(() => readGoogleAuthResult({ kind: 'authenticated', token: '' })).toThrow('Invalid Google sign-in response')
		expect(() => readGoogleAuthResult({ kind: 'link_verification_required' })).toThrow(
			'Invalid Google sign-in response'
		)
		expect(() =>
			readGoogleAuthResult({
				challengeToken: 'challenge-token',
				expiresAt: 'not-a-date',
				kind: 'link_verification_required',
				resendAfter: 'also-not-a-date'
			})
		).toThrow('Invalid Google sign-in response')
	})
})
