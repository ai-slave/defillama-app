// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatAttention } from '~/containers/LlamaAI/chatAttention'
import { useStreamNotification } from '~/containers/LlamaAI/hooks/useStreamNotification'

const mocks = vi.hoisted(() => ({
	visibilityState: 'visible' as DocumentVisibilityState,
	hasFocus: true,
	uncovered: true
}))

class FakeAudio {
	volume = 1
	currentTime = 0
	src = ''
	load() {}
	play() {
		return Promise.resolve()
	}
	pause() {}
	removeAttribute() {}
}

describe('useStreamNotification', () => {
	let container: HTMLDivElement
	let root: Root
	let result: ReturnType<typeof useStreamNotification>

	function Harness() {
		result = useStreamNotification({
			soundEnabled: false,
			attention: {
				uncovered: mocks.uncovered,
				sessionId: 'session-1',
				visibleMessageIds: new Set(['message-1'])
			} satisfies ChatAttention
		})
		return null
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.stubGlobal('Audio', FakeAudio)
		vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'denied' }))
		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		mocks.uncovered = true
		document.title = 'DefiLlama'
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => mocks.visibilityState
		})
		vi.spyOn(document, 'hasFocus').mockImplementation(() => mocks.hasFocus)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it('does not badge when the user is attending the chat', () => {
		act(() => result.notify())
		expect(document.title).toBe('DefiLlama')
	})

	it('badges when the tab is hidden', () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		act(() => result.notify())
		expect(document.title).toBe('LlamaAI (1) - DefiLlama')
	})

	it('badges when the window is visible but unfocused', () => {
		mocks.hasFocus = false
		act(() => result.notify())
		expect(document.title).toBe('LlamaAI (1) - DefiLlama')
	})

	it('badges when chat chrome covers the conversation', async () => {
		mocks.uncovered = false
		await act(async () => root.render(<Harness />))
		act(() => result.notify())
		expect(document.title).toBe('LlamaAI (1) - DefiLlama')
	})

	it('clears the badge when the user returns attention to the chat', async () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		act(() => result.notify())
		expect(document.title).toBe('LlamaAI (1) - DefiLlama')

		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		await act(async () => window.dispatchEvent(new Event('focus')))
		expect(document.title).toBe('DefiLlama')
	})

	it('clears the badge when an overlay closes over a focused tab', async () => {
		mocks.uncovered = false
		await act(async () => root.render(<Harness />))
		act(() => result.notify())
		expect(document.title).toBe('LlamaAI (1) - DefiLlama')

		mocks.uncovered = true
		await act(async () => root.render(<Harness />))
		expect(document.title).toBe('DefiLlama')
	})

	it('keeps the badge when an overlay opens while the user is away', async () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		act(() => result.notify())
		expect(document.title).toBe('LlamaAI (1) - DefiLlama')

		mocks.uncovered = false
		await act(async () => root.render(<Harness />))
		expect(document.title).toBe('LlamaAI (1) - DefiLlama')
	})
})
