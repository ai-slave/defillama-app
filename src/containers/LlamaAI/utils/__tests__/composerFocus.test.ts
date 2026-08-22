import { describe, expect, it } from 'vitest'
import { shouldFocusComposerOnSessionChange } from '../composerFocus'

const base = {
	readOnly: false,
	isMobile: false,
	restoringSessionId: null,
	settledSessionId: 'session-b',
	lastFocusedSessionId: 'session-a'
}

describe('shouldFocusComposerOnSessionChange', () => {
	it('focuses the composer after switching to another chat', () => {
		expect(shouldFocusComposerOnSessionChange(base)).toBe(true)
	})

	it('focuses once per switch, not on every render', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, lastFocusedSessionId: 'session-b' })).toBe(false)
	})

	it('waits until the restore settles', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, restoringSessionId: 'session-b' })).toBe(false)
	})

	it('never steals focus on mobile, where it would open the keyboard', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, isMobile: true })).toBe(false)
	})

	it('never focuses a read-only or shared conversation', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, readOnly: true })).toBe(false)
	})

	it('focuses when landing on a new chat', () => {
		expect(shouldFocusComposerOnSessionChange({ ...base, settledSessionId: 'new' })).toBe(true)
	})

	it('focuses again when returning to a chat visited earlier', () => {
		expect(
			shouldFocusComposerOnSessionChange({ ...base, settledSessionId: 'session-a', lastFocusedSessionId: 'session-b' })
		).toBe(true)
	})
})
