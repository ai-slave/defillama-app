// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useForkInitialPrompt } from '~/containers/LlamaAI/hooks/useForkInitialPrompt'

const options = vi.hoisted(() => ({
	initialPrompt: undefined as string | undefined,
	routeSessionId: null as string | null,
	sharedSession: false,
	restoringSessionId: null as string | null,
	sessionId: null as string | null,
	resolveSessionAlias: (id: string) => id,
	submitPrompt: vi.fn()
}))

function Harness() {
	useForkInitialPrompt({
		initialPrompt: options.initialPrompt,
		routeSessionId: options.routeSessionId,
		sharedSession: options.sharedSession,
		restoringSessionId: options.restoringSessionId,
		sessionId: options.sessionId,
		resolveSessionAlias: options.resolveSessionAlias,
		submitPrompt: options.submitPrompt
	})
	return null
}

describe('useForkInitialPrompt', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.useFakeTimers()
		options.initialPrompt = undefined
		options.routeSessionId = null
		options.sharedSession = false
		options.restoringSessionId = null
		options.sessionId = null
		options.submitPrompt.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	test('submits the fork prompt after restore finishes', async () => {
		options.initialPrompt = 'continue this thread'
		options.routeSessionId = 'session-1'
		options.sessionId = 'session-1'
		options.restoringSessionId = 'session-1'
		await act(async () => root.render(<Harness />))
		expect(options.submitPrompt).not.toHaveBeenCalled()

		options.restoringSessionId = null
		await act(async () => root.render(<Harness />))
		await act(async () => {
			vi.runOnlyPendingTimers()
		})

		expect(options.submitPrompt).toHaveBeenCalledWith('continue this thread')
	})

	test('does not submit until the restored session matches the fork target', async () => {
		options.initialPrompt = 'continue this thread'
		options.routeSessionId = 'session-1'
		options.sessionId = 'session-2'
		await act(async () => root.render(<Harness />))
		await act(async () => {
			vi.runOnlyPendingTimers()
		})

		expect(options.submitPrompt).not.toHaveBeenCalled()
	})
})
