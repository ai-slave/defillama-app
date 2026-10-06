// @vitest-environment happy-dom

import { act, createRef, type RefObject } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { LlamaAIChromeContext } from '../../chrome'
import type { ChatLandingProps } from '../ChatLanding'
import { ChatSurface } from '../ChatSurface'
import type { ConversationViewModel } from '../ConversationView'

vi.mock('next/router', () => ({
	default: { push: vi.fn() },
	useRouter: () => ({ asPath: '/ai/chat', pathname: '/ai/chat/[[...sessionId]]', query: {}, push: vi.fn() })
}))

const session = installSubscriberSession('reader', { resolved: true })

let host: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver
	session.serve({
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/subscription/trial-available': { trialAvailable: false }
	})
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

const noop = () => {}

// The app hands the landing and the conversation the same composer ref.
function surface(promptInputRef: RefObject<HTMLTextAreaElement | null>, animateLandingTransition: boolean) {
	const landingProps: ChatLandingProps = {
		draftScope: 'new',
		readOnly: false,
		title: 'What can I help you with?',
		handleSubmit: () => true,
		promptInputRef,
		handleStopRequest: noop,
		isStreaming: false,
		mode: 'quick',
		setMode: noop,
		onOpenAlerts: noop,
		isAlertsModalOpen: false,
		enterToSend: true,
		holdWalkthrough: false
	}
	const viewModel: ConversationViewModel = {
		draftScope: 'chat:s1',
		readOnly: false,
		messages: [{ id: 'u1', role: 'user', content: 'What is the TVL of Aave?' }],
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
		error: null,
		onReconnectNow: noop,
		scrollContainerRef: createRef(),
		attachScrollContainer: noop,
		attachScrollContent: noop,
		messagesEndRef: createRef(),
		promptInputRef,
		isScrollAttached: true,
		showScrollToBottom: false,
		scrollToBottom: noop,
		syncScrollAfterLayout: noop,
		handleSubmit: () => true,
		submitMode: { kind: 'direct' },
		handleStopRequest: noop,
		handleActionClick: noop,
		mode: 'quick',
		setMode: noop,
		onOpenAlerts: noop,
		enterToSend: true
	}
	return (
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
				<ChatSurface
					showLanding={false}
					animateLandingTransition={animateLandingTransition}
					animateConversationTransition={false}
					landingOverride={null}
					landingProps={landingProps}
					conversationViewModel={viewModel}
					conversationKey="conversation-0"
				/>
			</LlamaAIChromeContext.Provider>
		</session.Wrapper>
	)
}

/** The composer a reader can reach: the landing's exiting copy is inert. */
function liveComposer() {
	const composers = [...host.querySelectorAll('textarea')].filter((el) => !el.closest('[inert]'))
	expect(composers).toHaveLength(1)
	return composers[0]
}

test('the conversation composer keeps its focus and the shared ref when the landing exit finishes', async () => {
	const promptInputRef = createRef<HTMLTextAreaElement>()
	await act(async () => root.render(surface(promptInputRef, true)))
	// Both the exiting landing and the entering conversation draw a composer during the transition.
	expect(host.querySelectorAll('textarea')).toHaveLength(2)
	const composer = liveComposer()
	expect(promptInputRef.current).toBe(composer)
	await act(async () => composer.focus())
	expect(document.activeElement).toBe(composer)

	await act(async () => root.render(surface(promptInputRef, false)))

	expect(host.querySelectorAll('textarea')).toHaveLength(1)
	expect(liveComposer()).toBe(composer)
	expect(document.activeElement).toBe(composer)
	// The app focuses and resizes the composer through this ref; unmounting the exit copy must not null it.
	expect(promptInputRef.current).toBe(composer)
})
