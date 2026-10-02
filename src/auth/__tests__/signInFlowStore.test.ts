// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from 'vitest'
import { createSignInFlowStore, type GoogleLinkChallenge } from '../signInFlowStore'

function challenge(overrides: Partial<GoogleLinkChallenge> = {}): GoogleLinkChallenge {
	return {
		challengeToken: 'challenge-token',
		expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
		kind: 'link_verification_required',
		resendAfter: new Date(Date.now() + 60_000).toISOString(),
		...overrides
	}
}

describe('sign-in flow', () => {
	beforeEach(() => window.sessionStorage.clear())

	test('resumes the same Google challenge after using another method', () => {
		const store = createSignInFlowStore()
		const pendingChallenge = challenge()
		store.dispatch({ challenge: pendingChallenge, kind: 'googleLinkRequired' })
		store.dispatch({ kind: 'useAnotherMethod' })

		expect(store.getSnapshot()).toEqual({ kind: 'signin', pendingGoogleLink: pendingChallenge })

		store.dispatch({ kind: 'resumeGoogleLink' })
		expect(store.getSnapshot()).toEqual({ challenge: pendingChallenge, kind: 'googleLink' })
	})

	test('restores the latest resent challenge when the dialog reopens', () => {
		const store = createSignInFlowStore()
		const resentChallenge = challenge({ challengeToken: 'resent-token' })
		store.dispatch({ challenge: challenge(), kind: 'googleLinkRequired' })
		store.dispatch({ challenge: resentChallenge, kind: 'googleLinkUpdated' })

		expect(createSignInFlowStore().getSnapshot()).toEqual({
			challenge: resentChallenge,
			kind: 'googleLink'
		})
	})

	test('ignores an expired challenge when the dialog reopens', () => {
		const store = createSignInFlowStore()
		const now = Date.now()
		store.dispatch({
			challenge: challenge({
				expiresAt: new Date(now - 1).toISOString(),
				resendAfter: new Date(now - 60_000).toISOString()
			}),
			kind: 'googleLinkRequired'
		})

		expect(createSignInFlowStore().getSnapshot()).toEqual({ kind: 'signin' })
		expect(window.sessionStorage.getItem('google-link-challenge')).toBeNull()
	})

	test('clears the challenge after authentication', () => {
		const store = createSignInFlowStore()
		store.dispatch({ challenge: challenge(), kind: 'googleLinkRequired' })
		store.dispatch({ kind: 'authenticated' })

		expect(store.getSnapshot()).toEqual({ kind: 'signin', finished: true })
		expect(createSignInFlowStore().getSnapshot()).toEqual({ kind: 'signin' })
	})
})
