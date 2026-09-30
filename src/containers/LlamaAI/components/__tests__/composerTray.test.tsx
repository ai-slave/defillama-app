// @vitest-environment happy-dom

import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { LlamaAIChromeContext } from '../../chrome'
import type { Message } from '../../types'
import { ConversationView, type ConversationViewModel } from '../ConversationView'
import type { PromptSubmitMode } from '../PromptInput'

const session = installSubscriberSession('reader', { resolved: true })

const messages: Array<Message> = [
	{ id: 'u1', role: 'user', content: 'What is the TVL of Aave?' },
	{ id: 'a1', role: 'assistant', content: 'About $38B.' },
	{ id: 'local-u2', role: 'user', content: 'Compare Aave and Uniswap fees' }
]

let host: HTMLDivElement
let root: Root
let handleSubmit: ReturnType<typeof vi.fn<() => boolean>>

async function draw(submitMode: PromptSubmitMode) {
	const noop = () => {}
	const viewModel: ConversationViewModel = {
		draftScope: 'chat:s1',
		readOnly: false,
		messages,
		sessionId: 's1',
		isLlama: false,
		isStreaming: false,
		isQueuedUserMessagePending: false,
		steps: [],
		spawnProgress: new Map(),
		spawnStartTime: 0,
		todos: [],
		todosStartTime: 0,
		executionStartedAt: 0,
		spawnIsResearchMode: false,
		streamingDraft: null,
		isCompacting: false,
		paginationState: { hasMore: false, cursor: null, isLoadingMore: false },
		paginationError: null,
		recovery: { status: 'idle', startedAt: null, attemptCount: 0, lastErrorMessage: null },
		error: 'Failed to get response',
		onReconnectNow: noop,
		scrollContainerRef: createRef(),
		attachScrollContainer: noop,
		attachScrollContent: noop,
		messagesEndRef: createRef(),
		promptInputRef: createRef(),
		isScrollAttached: true,
		showScrollToBottom: false,
		scrollToBottom: noop,
		syncScrollAfterLayout: noop,
		handleSubmit,
		submitMode,
		handleStopRequest: noop,
		handleActionClick: noop,
		mode: 'quick',
		setMode: noop,
		onOpenAlerts: noop,
		enterToSend: true
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<LlamaAIChromeContext.Provider
					value={{
						toggleSidebar: noop,
						hideSidebar: noop,
						toggleFullscreen: noop,
						isFullscreen: false,
						fullscreenLocked: false,
						sidebarVisible: false,
						toggleDashboardPanel: noop,
						isDashboardPanelOpen: false
					}}
				>
					<ConversationView viewModel={viewModel} animateActiveExchange={false} />
				</LlamaAIChromeContext.Provider>
			</session.Wrapper>
		)
	)
}

/** The strip docked on the composer: its text and its buttons. */
function tray() {
	const strip = [...host.querySelectorAll('[role="status"]')].find((el) => el.nextElementSibling?.tagName === 'FORM')
	return strip
		? { text: strip.textContent, buttons: [...strip.querySelectorAll('button')].map((el) => el.textContent) }
		: null
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver
	handleSubmit = vi.fn(() => true)
	// The tip banner above the composer reads the reader's settings.
	session.serve({ '/user-settings': { settings: { customInstructions: '' }, tip: null } })
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

test('a failed prompt is retried or discarded from the strip on the composer, and Enter sends nothing meanwhile', async () => {
	const failure = {
		label: 'Retry' as const,
		notice: 'Your last prompt failed.',
		onActivate: vi.fn(),
		onDiscard: vi.fn()
	}
	await draw({ kind: 'blocked', failure })
	expect(tray()).toEqual({ text: 'Your last prompt failed.RetryDiscard', buttons: ['Retry', 'Discard'] })

	const button = (text: string) => [...host.querySelectorAll('button')].find((el) => el.textContent === text)!
	await act(async () => button('Retry').click())
	await act(async () => button('Discard').click())
	expect(failure.onActivate).toHaveBeenCalledOnce()
	expect(failure.onDiscard).toHaveBeenCalledOnce()

	const composer = host.querySelector('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(composer, 'Next question')
		composer.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
	expect(handleSubmit).not.toHaveBeenCalled()
	expect(composer.value).toBe('Next question')
})

test('a prompt that may still be running offers Reconnect and nothing to discard', async () => {
	await draw({
		kind: 'blocked',
		failure: { label: 'Reconnect', notice: 'Your last prompt may still be running.', onActivate: () => {} }
	})
	expect(tray()).toEqual({ text: 'Your last prompt may still be running.Reconnect', buttons: ['Reconnect'] })
})

test('a full queue says so on the composer', async () => {
	await draw({
		kind: 'queue',
		atCapacity: true,
		capacityMessage: 'Queue is full (max 5). Wait for a message to send first.'
	})
	expect(tray()).toEqual({ text: 'Queue is full (max 5). Wait for a message to send first.', buttons: [] })
})
