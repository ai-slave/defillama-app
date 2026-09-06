import { describe, expect, test } from 'vitest'
import { shouldFocusComposerOnSessionChange } from '../composerFocus'

const base = {
	readOnly: false,
	isMobile: false,
	restoringSessionId: null,
	settledSessionId: 'session-b',
	lastFocusedSessionId: 'session-a'
}

describe('shouldFocusComposerOnSessionChange', () => {
	test('focuses the composer after switching to another chat', () => {
		expect(shouldFocusComposerOnSessionChange(base)).toBe(true)
	})

	test('focuses once per switch, not on every render', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, lastFocusedSessionId: 'session-b' })).toBe(false)
	})

	test('waits until the restore settles', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, restoringSessionId: 'session-b' })).toBe(false)
	})

	test('never steals focus on mobile, where it would open the keyboard', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, isMobile: true })).toBe(false)
	})

	test('never focuses a read-only or shared conversation', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, readOnly: true })).toBe(false)
	})

	test('focuses when landing on a new chat', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, settledSessionId: 'new' })).toBe(true)
	})

	test('focuses again when returning to a chat visited earlier', () => {
		expect(
			shouldFocusComposerOnSessionChange({ ...base, settledSessionId: 'session-a', lastFocusedSessionId: 'session-b' })
		).toBe(true)
	})
})
