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
	projectHomeSignal: 0,
	currentSessionId: null as string | null
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
		resolveSessionAlias: (id) => id,
		projectHomeSignal: mocks.projectHomeSignal,
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
		mocks.projectHomeSignal = 0
		mocks.currentSessionId = null
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

	test('clears the chat when the same project URL is clicked again', async () => {
		mocks.route = { kind: 'project', projectId: 'project-1', initialTab: 'chats' }
		await rerender()
		expect(mocksApi.onClearChat).toHaveBeenCalledOnce()

		mocks.projectHomeSignal = 1
		await rerender()
		expect(mocksApi.onClearChat).toHaveBeenCalledTimes(2)
	})

	test('does not treat a project-home signal as a reset on a chat route', async () => {
		mocks.projectHomeSignal = 1
		await rerender()

		expect(mocksApi.onClearChat).not.toHaveBeenCalled()
		expect(mocksApi.onNewChat).toHaveBeenCalledOnce()
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
