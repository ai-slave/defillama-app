// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useAgenticRouteTransition } from '~/containers/LlamaAI/hooks/useAgenticRouteTransition'
import type { LlamaAIRouteState } from '~/contexts/LlamaAIRouteState'

const mocks = vi.hoisted(() => ({
	route: { kind: 'chat-new' } as LlamaAIRouteState,
	readOnly: false,
	sharedSession: false,
	currentSessionId: null as string | null,
	aliases: new Map<string, string>()
}))

const mocksApi = vi.hoisted(() => ({
	onNewChat: vi.fn(),
	onOpenSession: vi.fn(),
	onClearChat: vi.fn()
}))

function Harness() {
	useAgenticRouteTransition({
		route: mocks.route,
		readOnly: mocks.readOnly,
		sharedSession: mocks.sharedSession,
		resolveSessionAlias: (id) => mocks.aliases.get(id) ?? id,
		getCurrentSessionId: () => mocks.currentSessionId,
		onNewChat: mocksApi.onNewChat,
		onOpenSession: mocksApi.onOpenSession,
		onClearChat: mocksApi.onClearChat
	})
	return null
}

describe('useAgenticRouteTransition', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.route = { kind: 'chat-new' }
		mocks.readOnly = false
		mocks.sharedSession = false
		mocks.currentSessionId = null
		mocks.aliases.clear()
		mocksApi.onNewChat.mockReset()
		mocksApi.onOpenSession.mockReset()
		mocksApi.onClearChat.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	async function rerender() {
		await act(async () => root.render(<Harness />))
	}

	test('opens a new chat once for the same route', async () => {
		expect(mocksApi.onNewChat).toHaveBeenCalledOnce()

		await rerender()

		expect(mocksApi.onNewChat).toHaveBeenCalledOnce()
		expect(mocksApi.onOpenSession).not.toHaveBeenCalled()
		expect(mocksApi.onClearChat).not.toHaveBeenCalled()
	})

	test('opens a session and does not restore the same session twice', async () => {
		mocks.route = { kind: 'chat-session', sessionId: 'session-1' }
		await rerender()

		expect(mocksApi.onOpenSession).toHaveBeenCalledWith('session-1', undefined)
		expect(mocksApi.onNewChat).toHaveBeenCalledOnce()

		mocks.currentSessionId = 'session-1'
		await rerender()

		expect(mocksApi.onOpenSession).toHaveBeenCalledOnce()
	})

	test('passes a message anchor when opening a session', async () => {
		mocks.route = { kind: 'chat-session', sessionId: 'session-1', aroundMessageId: 'message-a' }
		await rerender()

		expect(mocksApi.onOpenSession).toHaveBeenCalledWith('session-1', 'message-a')
	})

	test('clears the chat on project and project-list routes', async () => {
		mocks.route = { kind: 'project-list' }
		await rerender()
		expect(mocksApi.onClearChat).toHaveBeenCalledOnce()

		mocks.route = { kind: 'project', projectId: 'project-1', initialTab: 'chats' }
		await rerender()
		expect(mocksApi.onClearChat).toHaveBeenCalledTimes(2)
	})

	test('keeps the same project landing and resets when switching projects or returning from a chat', async () => {
		mocks.route = { kind: 'project', projectId: 'project-1', initialTab: 'chats' }
		await rerender()
		mocks.route = { ...mocks.route }
		await rerender()
		expect(mocksApi.onClearChat).toHaveBeenCalledOnce()
		mocks.route = { kind: 'project', projectId: 'project-2', initialTab: 'chats' }
		await rerender()
		expect(mocksApi.onClearChat).toHaveBeenCalledTimes(2)
		mocks.route = { kind: 'chat-session', sessionId: 'session-1' }
		await rerender()
		mocks.route = { kind: 'project', projectId: 'project-2', initialTab: 'chats' }
		await rerender()
		expect(mocksApi.onClearChat).toHaveBeenCalledTimes(3)
	})

	test.each(['chat-new', 'project'] as const)(
		'publishes a chat started from %s without restoring over its stream',
		async (kind) => {
			mocks.route = kind === 'project' ? { kind, projectId: 'project-1', initialTab: 'chats' } : { kind }
			await rerender()
			mocks.currentSessionId = 'new-session'
			mocks.route = { kind: 'chat-session', sessionId: 'new-session' }
			await rerender()
			expect(mocksApi.onOpenSession).not.toHaveBeenCalled()
			mocks.route = { kind: 'chat-session', sessionId: 'new-session', aroundMessageId: 'message-1' }
			await rerender()
			expect(mocksApi.onOpenSession).toHaveBeenCalledWith('new-session', 'message-1')
		}
	)

	test('keeps the live conversation when the server replaces its temporary session ID', async () => {
		mocks.currentSessionId = 'temporary-id'
		mocks.route = { kind: 'chat-session', sessionId: 'temporary-id' }
		await rerender()
		mocks.aliases.set('temporary-id', 'saved-id')
		mocks.currentSessionId = 'saved-id'
		mocks.route = { kind: 'chat-session', sessionId: 'saved-id' }
		await rerender()
		expect(mocksApi.onOpenSession).not.toHaveBeenCalled()
	})

	test('does not run route side effects in read-only or shared views', async () => {
		await act(async () => root.unmount())
		mocksApi.onNewChat.mockReset()
		mocks.readOnly = true
		root = createRoot(container)
		await act(async () => root.render(<Harness />))

		expect(mocksApi.onNewChat).not.toHaveBeenCalled()
		expect(mocksApi.onOpenSession).not.toHaveBeenCalled()
		expect(mocksApi.onClearChat).not.toHaveBeenCalled()
	})
})
