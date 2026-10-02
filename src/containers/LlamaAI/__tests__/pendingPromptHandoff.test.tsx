// @vitest-environment happy-dom
import { act, StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
	consumePendingPrompt,
	setPendingEntrySource,
	setPendingPrompt,
	setPendingSuggestedFlag
} from '~/containers/LlamaAI/pendingPrompt'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const api = vi.hoisted(() => ({
	router: {
		query: {} as Record<string, string | Array<string>>,
		pathname: '/ai/chat/[[...sessionId]]',
		asPath: '/ai/chat',
		isReady: true,
		push: vi.fn(),
		replace: vi.fn(),
		prefetch: vi.fn(async () => {}),
		events: { on: vi.fn(), off: vi.fn() }
	}
}))
vi.mock('next/router', () => ({ default: api.router, useRouter: () => api.router }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('~/containers/LlamaAI/components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TokenLimitModal', () => ({ TokenLimitModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

const session = installSubscriberSession('reader', { account: 'free', resolved: true })
const QUESTION = 'Why did Aave TVL jump today?'
let root: Root

function goTo(url: string) {
	const { pathname } = new URL(url, 'https://defillama.com')
	const sessionId = pathname.split('/')[3]
	api.router.asPath = pathname
	api.router.query = sessionId ? { sessionId: [sessionId] } : {}
}

const agenticRequests = () => session.requests.filter((call) => call.url.href === 'https://ai.llama.fi/agentic')

// The tree as next dev renders it: React StrictMode mounts, unmounts and remounts once.
const tree = () => (
	<StrictMode>
		<session.Wrapper>{LlamaAIPage.getLayout(<LlamaAIPage />)}</session.Wrapper>
	</StrictMode>
)

async function mount() {
	await act(async () => root.render(tree()))
	// The chat takes the handover one task after mount.
	await act(async () => new Promise((resolve) => setTimeout(resolve)))
}

function answer(_url: URL, init?: RequestInit): Response {
	const { sessionId } = JSON.parse(init!.body as string) as { sessionId: string }
	const events = [
		{ type: 'session', sessionId },
		{ type: 'title', title: 'Aave TVL' },
		{ type: 'response_chunk', content: 'Deposits rose after the rate cut.' },
		{ type: 'done' }
	]
	return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
		headers: { 'Content-Type': 'text/event-stream' }
	})
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	goTo('/ai/chat')
	const navigate = async (url: string) => {
		goTo(url)
		return true
	}
	api.router.push.mockImplementation(navigate)
	api.router.replace.mockImplementation(navigate)
	session.client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
	session.serve({
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '1',
			toppedUpBalance: '0',
			freeLimit: '1',
			freeSpent: '0'
		},
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/mobile-push/web-notifications': { available: false, enabled: false },
		'https://ai.llama.fi/agentic/active/': { active: false, execution: null },
		'https://ai.llama.fi/agentic': answer,
		'/user/sessions': { sessions: [], hasMore: false }
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
	consumePendingPrompt()
})

test('a question handed over from the homepage is answered when the chat mounts twice, as next dev mounts it', async () => {
	setPendingPrompt(QUESTION)
	setPendingSuggestedFlag()
	setPendingEntrySource('daily-brief')
	await mount()

	await waitForUi(() => expect(document.body.textContent).toContain('Deposits rose after the rate cut.'))
	expect(document.body.textContent).toContain(QUESTION)
	const bodies = agenticRequests().map((call) => JSON.parse(call.init!.body as string) as Record<string, unknown>)
	expect(bodies).toHaveLength(1)
	expect(bodies[0]).toMatchObject({ message: QUESTION, isSuggestedQuestion: true, entrySource: 'daily-brief' })
})

test('opening an existing chat while the chat mounts twice still restores its messages', async () => {
	goTo('/ai/chat/old-chat')
	session.serve({
		'/user/sessions/old-chat/restore': {
			messages: [
				{ id: 'q', role: 'user', content: 'An older question' },
				{ id: 'a', role: 'assistant', content: 'An older answer' }
			]
		}
	})
	await mount()

	await waitForUi(() => expect(document.body.textContent).toContain('An older answer'))
	expect(document.body.textContent).toContain('An older question')
})

test('leaving the chat before it takes the handed-over question keeps the question waiting', () => {
	setPendingPrompt(QUESTION)
	act(() => root.render(tree()))
	act(() => root.unmount())
	root = createRoot(document.createElement('div'))

	expect(consumePendingPrompt()).toBe(QUESTION)
	expect(agenticRequests()).toEqual([])
})
