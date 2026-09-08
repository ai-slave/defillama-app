// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useWebCompletionSeen } from '~/containers/LlamaAI/hooks/useWebCompletionSeen'
import type { WebMobilePreference } from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'

const mocks = vi.hoisted(() => ({
	markSeen: vi.fn(),
	authorizedFetch: vi.fn(),
	userId: 'user-1' as string | null,
	visibilityState: 'visible' as DocumentVisibilityState,
	hasFocus: true,
	sessionId: 'session-1' as string | null,
	uncovered: true,
	visibleMessageIds: new Set(['message-1']) as ReadonlySet<string>,
	preference: { kind: 'known', available: true, enabled: true } as WebMobilePreference
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: mocks.authorizedFetch,
		isAuthenticated: !!mocks.userId,
		user: mocks.userId ? { id: mocks.userId } : null
	})
}))

vi.mock('~/containers/LlamaAI/api/mobilePush', () => ({
	COMPLETION_SEEN_REQUEST_TIMEOUT_MS: 2000,
	markWebCompletionSeen: mocks.markSeen
}))

describe('useWebCompletionSeen', () => {
	let container: HTMLDivElement
	let root: Root
	let result: ReturnType<typeof useWebCompletionSeen>

	function Harness() {
		result = useWebCompletionSeen({
			attention: {
				uncovered: mocks.uncovered,
				sessionId: mocks.sessionId,
				visibleMessageIds: mocks.visibleMessageIds
			},
			preference: mocks.preference
		})
		return null
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		mocks.userId = 'user-1'
		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		mocks.sessionId = 'session-1'
		mocks.uncovered = true
		mocks.visibleMessageIds = new Set(['message-1'])
		mocks.preference = { kind: 'known', available: true, enabled: true }
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => mocks.visibilityState
		})
		vi.spyOn(document, 'hasFocus').mockImplementation(() => mocks.hasFocus)
		mocks.markSeen.mockResolvedValue(true)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await renderHook()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	async function renderHook() {
		await act(async () => root.render(<Harness />))
	}

	test('marks seen while attending the active visible message', async () => {
		act(() => result.markCompletionSeen('session-1', 'message-1'))

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
		expect(mocks.markSeen).toHaveBeenCalledWith(mocks.authorizedFetch, 'session-1', 'message-1')
	})

	test('waits for focus after the tab was hidden', async () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		await renderHook()

		act(() => result.markCompletionSeen('session-1', 'message-1'))
		expect(mocks.markSeen).not.toHaveBeenCalled()

		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		await act(async () => window.dispatchEvent(new Event('focus')))

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
	})

	test('waits until the chat is uncovered', async () => {
		mocks.uncovered = false
		await renderHook()

		act(() => result.markCompletionSeen('session-1', 'message-1'))
		expect(mocks.markSeen).not.toHaveBeenCalled()

		mocks.uncovered = true
		await renderHook()

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
	})

	test('waits until the message is in visibleMessageIds', async () => {
		mocks.visibleMessageIds = new Set()
		await renderHook()

		act(() => result.markCompletionSeen('session-1', 'message-1'))
		expect(mocks.markSeen).not.toHaveBeenCalled()

		mocks.visibleMessageIds = new Set(['message-1'])
		await renderHook()

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
	})

	test('does not let another-session pending completion block the active session', async () => {
		act(() => {
			result.markCompletionSeen('session-2', 'message-2')
			result.markCompletionSeen('session-1', 'message-1')
		})

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
		expect(mocks.markSeen).toHaveBeenCalledWith(mocks.authorizedFetch, 'session-1', 'message-1')
	})

	test('retries a transient failure within the ten-second grace period', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		mocks.markSeen.mockRejectedValueOnce(new TypeError('network unavailable')).mockResolvedValueOnce(true)

		act(() => result.markCompletionSeen('session-1', 'message-1'))

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledTimes(2), { timeout: 2000 })
	})

	test('walks the whole retry ladder and then gives up', async () => {
		vi.useFakeTimers()
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		mocks.markSeen.mockRejectedValue(new TypeError('network unavailable'))

		act(() => result.markCompletionSeen('session-1', 'message-1'))
		await act(async () => vi.advanceTimersByTimeAsync(0))
		expect(mocks.markSeen).toHaveBeenCalledOnce()

		await act(async () => vi.advanceTimersByTimeAsync(750))
		expect(mocks.markSeen).toHaveBeenCalledTimes(2)

		await act(async () => vi.advanceTimersByTimeAsync(2000))
		expect(mocks.markSeen).toHaveBeenCalledTimes(3)

		await act(async () => vi.advanceTimersByTimeAsync(10_000))
		expect(mocks.markSeen).toHaveBeenCalledTimes(3)
		expect(vi.getTimerCount()).toBe(0)
	})

	test('does not POST while the preference is disabled', async () => {
		mocks.preference = { kind: 'known', available: true, enabled: false }
		await renderHook()

		act(() => result.markCompletionSeen('session-1', 'message-1'))

		expect(mocks.markSeen).not.toHaveBeenCalled()
	})

	test('holds a pending completion while the preference is loading', async () => {
		mocks.preference = { kind: 'loading' }
		await renderHook()
		act(() => result.markCompletionSeen('session-1', 'message-1'))
		expect(mocks.markSeen).not.toHaveBeenCalled()

		mocks.visibleMessageIds = new Set(['message-1', 'other-message'])
		await renderHook()
		expect(mocks.markSeen).not.toHaveBeenCalled()

		mocks.preference = { kind: 'known', available: true, enabled: true }
		await renderHook()

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
	})

	test('marks seen when the preference is unavailable but still enabled', async () => {
		mocks.preference = { kind: 'known', available: false, enabled: true }
		await renderHook()

		act(() => result.markCompletionSeen('session-1', 'message-1'))

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
	})

	test('does not enqueue when the preference is unavailable and disabled', async () => {
		mocks.preference = { kind: 'known', available: false, enabled: false }
		await renderHook()
		act(() => result.markCompletionSeen('session-1', 'message-1'))

		mocks.preference = { kind: 'known', available: true, enabled: true }
		await renderHook()

		expect(mocks.markSeen).not.toHaveBeenCalled()
	})

	test('does not enqueue a completion marked while the preference is disabled', async () => {
		mocks.preference = { kind: 'known', available: true, enabled: false }
		await renderHook()
		act(() => result.markCompletionSeen('session-1', 'message-1'))

		mocks.preference = { kind: 'known', available: true, enabled: true }
		await renderHook()

		expect(mocks.markSeen).not.toHaveBeenCalled()
	})

	test('clears pending completions when the preference becomes disabled', async () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		await renderHook()
		act(() => result.markCompletionSeen('session-1', 'message-1'))

		mocks.preference = { kind: 'known', available: true, enabled: false }
		await renderHook()
		mocks.preference = { kind: 'known', available: true, enabled: true }
		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		await renderHook()
		await act(async () => window.dispatchEvent(new Event('focus')))

		expect(mocks.markSeen).not.toHaveBeenCalled()
	})

	test('drops a held completion when loading resolves to disabled', async () => {
		mocks.preference = { kind: 'loading' }
		await renderHook()
		act(() => result.markCompletionSeen('session-1', 'message-1'))

		mocks.preference = { kind: 'known', available: true, enabled: false }
		await renderHook()
		mocks.preference = { kind: 'known', available: true, enabled: true }
		await renderHook()

		expect(mocks.markSeen).not.toHaveBeenCalled()
	})

	test('clears pending completions when the authenticated user changes', async () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		await renderHook()
		act(() => result.markCompletionSeen('session-1', 'message-1'))

		mocks.userId = 'user-2'
		await renderHook()
		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		await renderHook()
		await act(async () => window.dispatchEvent(new Event('focus')))

		expect(mocks.markSeen).not.toHaveBeenCalled()
	})

	test('marks a live completion when its streaming draft id is visible', async () => {
		mocks.visibleMessageIds = new Set(['streaming-message-1'])
		await renderHook()

		act(() => result.markCompletionSeen('session-1', 'streaming-message-1'))

		await vi.waitFor(() => expect(mocks.markSeen).toHaveBeenCalledOnce())
	})

	test('does not POST an around-restore completion outside the loaded window', async () => {
		mocks.visibleMessageIds = new Set(['different-message'])
		await renderHook()

		act(() => result.markCompletionSeen('session-1', 'restored-message'))

		expect(mocks.markSeen).not.toHaveBeenCalled()
	})

	test('does not schedule a retry whose request timeout would cross expiresAt', async () => {
		vi.useFakeTimers()
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		let rejectRequest: ((error: Error) => void) | null = null
		mocks.markSeen.mockImplementationOnce(() => new Promise<boolean>((_resolve, reject) => (rejectRequest = reject)))

		act(() => result.markCompletionSeen('session-1', 'message-1'))
		await act(async () => Promise.resolve())
		expect(mocks.markSeen).toHaveBeenCalledOnce()

		await act(async () => {
			await vi.advanceTimersByTimeAsync(7500)
			rejectRequest?.(new TypeError('late network failure'))
			await Promise.resolve()
		})
		expect(vi.getTimerCount()).toBe(0)
		await act(async () => vi.advanceTimersByTimeAsync(10_000))
		expect(mocks.markSeen).toHaveBeenCalledOnce()
	})
})
