// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FOREGROUND_RECOVERY_POLL_MS, useForegroundRecovery } from '~/containers/LlamaAI/hooks/useForegroundRecovery'
import type { PromptFailure } from '~/containers/LlamaAI/promptFailures'

const mocks = vi.hoisted(() => ({
	readOnly: false,
	isRouteSessionPending: false,
	isStreaming: false,
	sessionId: 'session-1' as string | null,
	hasGenericError: false,
	hasActiveRecovery: false,
	promptFailure: null as PromptFailure | null
}))

function reconnectFailure(): PromptFailure {
	return {
		kind: 'reconnect',
		error: 'Lost connection',
		request: {
			optimisticMessageId: 'user-1',
			mutation: {
				clientMutationId: 'mutation-1'
			} as PromptFailure['request']['mutation']
		}
	}
}

function Harness() {
	useForegroundRecovery({
		readOnly: mocks.readOnly,
		isRouteSessionPending: mocks.isRouteSessionPending,
		isStreaming: mocks.isStreaming,
		sessionId: mocks.sessionId,
		hasGenericError: mocks.hasGenericError,
		promptFailure: mocks.promptFailure,
		getHasActiveRecovery: () => mocks.hasActiveRecovery,
		onResumeRecovery: mocksApi.onResumeRecovery,
		onReplayPrompt: mocksApi.onReplayPrompt,
		onProbeSession: mocksApi.onProbeSession
	})
	return null
}

const mocksApi = vi.hoisted(() => ({
	onResumeRecovery: vi.fn(),
	onReplayPrompt: vi.fn(),
	onProbeSession: vi.fn()
}))

describe('useForegroundRecovery', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.useFakeTimers()
		mocks.readOnly = false
		mocks.isRouteSessionPending = false
		mocks.isStreaming = false
		mocks.sessionId = 'session-1'
		mocks.hasGenericError = false
		mocks.hasActiveRecovery = false
		mocks.promptFailure = null
		mocksApi.onResumeRecovery.mockReset()
		mocksApi.onReplayPrompt.mockReset()
		mocksApi.onProbeSession.mockReset()
		Object.defineProperty(document, 'hidden', { configurable: true, value: false })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	async function rerender() {
		await act(async () => root.render(<Harness />))
	}

	test('resumes an active recovery when the tab becomes visible', async () => {
		mocks.hasActiveRecovery = true
		await rerender()

		Object.defineProperty(document, 'hidden', { configurable: true, value: false })
		act(() => {
			document.dispatchEvent(new Event('visibilitychange'))
		})

		expect(mocksApi.onResumeRecovery).toHaveBeenCalledOnce()
		expect(mocksApi.onReplayPrompt).not.toHaveBeenCalled()
		expect(mocksApi.onProbeSession).not.toHaveBeenCalled()
	})

	test('replays a reconnectable prompt when coming back online', async () => {
		mocks.promptFailure = reconnectFailure()
		await rerender()

		act(() => {
			window.dispatchEvent(new Event('online'))
		})

		expect(mocksApi.onReplayPrompt).toHaveBeenCalledOnce()
		expect(mocksApi.onResumeRecovery).not.toHaveBeenCalled()
	})

	test('probes the session when a generic error is visible', async () => {
		mocks.hasGenericError = true
		await rerender()

		act(() => {
			document.dispatchEvent(new Event('visibilitychange'))
		})

		expect(mocksApi.onProbeSession).toHaveBeenCalledWith('session-1')
	})

	test('polls for a completed result after recovery exhausts', async () => {
		mocks.hasGenericError = true
		await rerender()

		act(() => {
			vi.advanceTimersByTime(FOREGROUND_RECOVERY_POLL_MS)
		})

		expect(mocksApi.onProbeSession).toHaveBeenCalledWith('session-1')
	})

	test('does not poll while the tab is hidden', async () => {
		mocks.hasGenericError = true
		await rerender()
		Object.defineProperty(document, 'hidden', { configurable: true, value: true })

		act(() => {
			vi.advanceTimersByTime(FOREGROUND_RECOVERY_POLL_MS)
		})

		expect(mocksApi.onProbeSession).not.toHaveBeenCalled()
	})
})
