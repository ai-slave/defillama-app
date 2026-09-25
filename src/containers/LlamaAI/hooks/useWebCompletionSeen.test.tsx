// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import type { ChatAttention } from '~/containers/LlamaAI/chatAttention'
import { canMarkSeen, useWebCompletionSeen, type PendingSeen } from '~/containers/LlamaAI/hooks/useWebCompletionSeen'
import type { WebMobilePreference } from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/test/subscriberSession'

const session = installSubscriberSession('user-1')
const SEEN_PATH = '/mobile-push/completions/'
const ENABLED: WebMobilePreference = { kind: 'known', available: true, enabled: true }
const DISABLED: WebMobilePreference = { kind: 'known', available: true, enabled: false }

let visibility: DocumentVisibilityState = 'visible'
let focused = true

beforeEach(() => {
	visibility = 'visible'
	focused = true
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
	vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.useRealTimers()
})

describe('which pending completion may be marked seen', () => {
	const pending = (patch: Partial<PendingSeen> = {}): PendingSeen => ({
		sessionId: 'session-1',
		messageId: 'message-1',
		attempts: 0,
		expiresAt: Date.now() + 10_000,
		...patch
	})
	const attention = (patch: Partial<ChatAttention> = {}): ChatAttention => ({
		uncovered: true,
		sessionId: 'session-1',
		visibleMessageIds: new Set(['message-1']),
		...patch
	})

	test('only the visible message of the active, uncovered, focused chat', () => {
		expect(canMarkSeen(pending(), attention(), ENABLED)).toBe(true)
		expect(canMarkSeen(pending(), attention({ uncovered: false }), ENABLED)).toBe(false)
		expect(canMarkSeen(pending(), attention({ sessionId: 'session-2' }), ENABLED)).toBe(false)
		expect(canMarkSeen(pending(), attention({ visibleMessageIds: new Set(['other']) }), ENABLED)).toBe(false)
		expect(canMarkSeen(pending({ expiresAt: Date.now() }), attention(), ENABLED)).toBe(false)
		focused = false
		expect(canMarkSeen(pending(), attention(), ENABLED)).toBe(false)
	})

	test('only while the preference is known to be enabled, even when push is unavailable', () => {
		expect(canMarkSeen(pending(), attention(), { kind: 'known', available: false, enabled: true })).toBe(true)
		expect(canMarkSeen(pending(), attention(), DISABLED)).toBe(false)
		expect(canMarkSeen(pending(), attention(), { kind: 'loading' })).toBe(false)
		expect(canMarkSeen(pending(), attention(), { kind: 'signed-out' })).toBe(false)
	})
})

describe('useWebCompletionSeen', () => {
	let container: HTMLDivElement
	let root: Root
	let result: ReturnType<typeof useWebCompletionSeen>
	let props: { attention: ChatAttention; preference: WebMobilePreference }
	let failures: Array<Error | number>
	const seenRequests = () => session.requests.filter((request) => request.url.pathname.startsWith(SEEN_PATH))

	function Harness() {
		result = useWebCompletionSeen(props)
		return null
	}

	async function render(patch: Partial<ChatAttention> & { preference?: WebMobilePreference } = {}) {
		const { preference = props.preference, ...attention } = patch
		props = { attention: { ...props.attention, ...attention }, preference }
		await act(async () =>
			root.render(
				<session.Wrapper>
					<Harness />
				</session.Wrapper>
			)
		)
	}

	async function mark(sessionId = 'session-1', messageId = 'message-1') {
		await act(async () => result.markCompletionSeen(sessionId, messageId))
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		failures = []
		session.serve({
			[`${AI_SERVER}${SEEN_PATH}`]: () => {
				const failure = failures.shift()
				if (failure === undefined) return { ok: true, seen: true }
				if (typeof failure === 'number') return Response.json({ error: 'down' }, { status: failure })
				throw failure
			}
		})
		props = {
			attention: { uncovered: true, sessionId: 'session-1', visibleMessageIds: new Set(['message-1']) },
			preference: ENABLED
		}
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await render()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('marks the attended completion seen on the server', async () => {
		await mark()

		await vi.waitFor(() => expect(seenRequests()).toHaveLength(1))
		expect(seenRequests()[0]!.url.pathname).toBe('/mobile-push/completions/session-1/messages/message-1/seen')
		expect(seenRequests()[0]!.init?.method).toBe('POST')
	})

	test('waits for focus after the tab was hidden', async () => {
		visibility = 'hidden'
		focused = false
		await mark()
		expect(seenRequests()).toHaveLength(0)

		visibility = 'visible'
		focused = true
		await act(async () => window.dispatchEvent(new Event('focus')))

		await vi.waitFor(() => expect(seenRequests()).toHaveLength(1))
	})

	test('waits until the message scrolls into view', async () => {
		await render({ visibleMessageIds: new Set() })
		await mark()
		expect(seenRequests()).toHaveLength(0)

		await render({ visibleMessageIds: new Set(['message-1']) })

		await vi.waitFor(() => expect(seenRequests()).toHaveLength(1))
	})

	test('does not let another session’s pending completion block the active one', async () => {
		await act(async () => {
			result.markCompletionSeen('session-2', 'message-2')
			result.markCompletionSeen('session-1', 'message-1')
		})

		await vi.waitFor(() => expect(seenRequests()).toHaveLength(1))
		expect(seenRequests()[0]!.url.pathname).toContain('/session-1/messages/message-1/')
	})

	test('holds a completion while the preference loads and sends it once enabled', async () => {
		await render({ preference: { kind: 'loading' } })
		await mark()
		await render({ visibleMessageIds: new Set(['message-1', 'other-message']) })
		expect(seenRequests()).toHaveLength(0)

		await render({ preference: ENABLED })

		await vi.waitFor(() => expect(seenRequests()).toHaveLength(1))
	})

	test.each([
		['marked while disabled', { kind: 'known', available: true, enabled: false }],
		['marked while unavailable and disabled', { kind: 'known', available: false, enabled: false }]
	] as const)('never sends a completion %s', async (_name, preference) => {
		await render({ preference })
		await mark()
		await render({ preference: ENABLED })

		expect(seenRequests()).toHaveLength(0)
	})

	test('drops held completions when the preference turns off or loading resolves to off', async () => {
		await render({ preference: { kind: 'loading' } })
		await mark()
		await render({ preference: DISABLED })
		await render({ preference: ENABLED })

		expect(seenRequests()).toHaveLength(0)
	})

	test('drops held completions when a different account signs in', async () => {
		visibility = 'hidden'
		focused = false
		await mark()

		const token = `e30.${btoa(JSON.stringify({ id: 'user-2', exp: 4_102_444_800 }))}.signature`
		session.serve({
			'/api/collections/users/auth-refresh': {
				token,
				record: { id: 'user-2', collectionId: 'u', collectionName: 'users' }
			}
		})
		await act(async () => pb.authStore.save(token, { id: 'user-2', collectionId: 'u', collectionName: 'users' }))
		visibility = 'visible'
		focused = true
		await act(async () => window.dispatchEvent(new Event('focus')))

		expect(seenRequests()).toHaveLength(0)
	})

	test('retries a transient failure on the 750ms and 2s ladder, then gives up', async () => {
		vi.useFakeTimers()
		failures = [new TypeError('network unavailable'), 503, 503]

		await mark()
		await act(async () => vi.advanceTimersByTimeAsync(0))
		expect(seenRequests()).toHaveLength(1)

		await act(async () => vi.advanceTimersByTimeAsync(750))
		expect(seenRequests()).toHaveLength(2)

		await act(async () => vi.advanceTimersByTimeAsync(2000))
		expect(seenRequests()).toHaveLength(3)

		await act(async () => vi.advanceTimersByTimeAsync(10_000))
		expect(seenRequests()).toHaveLength(3)
	})

	test('does not retry a client error', async () => {
		vi.useFakeTimers()
		failures = [400]

		await mark()
		await act(async () => vi.advanceTimersByTimeAsync(10_000))

		expect(seenRequests()).toHaveLength(1)
	})

	test('does not schedule a retry whose request timeout would cross the grace period', async () => {
		vi.useFakeTimers()
		let failLate: (() => void) | null = null
		session.serve({
			[`${AI_SERVER}${SEEN_PATH}`]: () =>
				new Promise<Response>((_resolve, reject) => (failLate = () => reject(new TypeError('late failure'))))
		})

		await mark()
		await act(async () => vi.advanceTimersByTimeAsync(0))
		expect(seenRequests()).toHaveLength(1)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(7500)
			failLate!()
		})
		await act(async () => vi.advanceTimersByTimeAsync(10_000))

		expect(seenRequests()).toHaveLength(1)
	})
})
