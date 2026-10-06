// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setLlamaAIWalkthroughState } from '~/contexts/LocalStorage'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { liveComposer, sendFromComposer, stopButton } from './chatComposer'

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
// Heavy surfaces this test asserts nothing about; the composer, submission, streaming and routing stay real.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('~/containers/LlamaAI/components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('~/containers/Account/EndTrialModal', () => ({ EndTrialModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

const session = installSubscriberSession('reader')
const agenticPosts = () =>
	session.requests
		.filter((call) => call.url.href === 'https://ai.llama.fi/agentic')
		.map((call) => (JSON.parse(call.init!.body as string) as { message: string }).message)

/** One answer stream per POST /agentic; the test writes its events and decides when the body closes. */
type Answer = { write: (...events: Array<object>) => void; close: () => void }
let answers: Array<Answer>
function answerStream(): Response {
	const encoder = new TextEncoder()
	let controller!: ReadableStreamDefaultController<Uint8Array>
	const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) })
	answers.push({
		write: (...events) =>
			controller.enqueue(encoder.encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''))),
		close: () => controller.close()
	})
	return new Response(body, { headers: { 'Content-Type': 'text/event-stream; cursor=v2' } })
}
/** Answers the resume probe that runs when a saved chat opens; the default answers at once. */
let answerProbe: () => Promise<Response> | object

let root: Root

function goTo(url: string) {
	const parsed = new URL(url, 'https://defillama.com')
	api.router.asPath = `${parsed.pathname}${parsed.search}`
	const sessionId = parsed.pathname.split('/')[3]
	api.router.query = { ...(sessionId ? { sessionId: [sessionId] } : {}), ...Object.fromEntries(parsed.searchParams) }
}

const draw = () =>
	act(async () => root.render(<session.Wrapper>{LlamaAIPage.getLayout(<LlamaAIPage />)}</session.Wrapper>))

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	// A returning subscriber: the first-visit walkthrough would open its own dialog over the composer.
	setLlamaAIWalkthroughState('completed')
	answers = []
	answerProbe = () => ({ active: false, execution: null })
	api.router.push.mockImplementation(async (url: string) => {
		goTo(url)
		return true
	})
	api.router.replace.mockImplementation(async (url: string) => {
		goTo(url)
		return true
	})
	session.client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
	session.serve({
		'/subscription/status': { subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } },
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '1',
			toppedUpBalance: '0',
			freeLimit: '1',
			freeSpent: '0'
		},
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/mobile-push/web-notifications': { available: false, enabled: false },
		'https://ai.llama.fi/agentic/active/': () => answerProbe(),
		'https://ai.llama.fi/agentic': () => answerStream(),
		'/user/sessions': { sessions: [], hasMore: false },
		'/user/sessions/old-chat/restore': {
			messages: [{ id: 'old-answer', role: 'assistant', content: 'An older answer' }]
		}
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

test('a prompt sent after an answer is done but before its response closes is refused, and goes out once it closes', async () => {
	goTo('/ai/chat')
	await draw()
	await sendFromComposer('Prompt 1')
	await waitForUi(() => expect(answers).toHaveLength(1))
	await act(async () => {
		answers[0].write(
			{ type: 'session', sessionId: 'new-chat', startedAt: 1, streamCursor: 0 },
			{ type: 'user_message_id', messageId: 'question-1' },
			{ type: 'message_id', messageId: 'answer-1' },
			{ type: 'response_chunk', content: 'An answer' },
			{ type: 'done', streamCursor: 5 }
		)
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	await draw()

	// A refused prompt stays in the composer for the reader to send again.
	await sendFromComposer('Prompt 2')
	expect(liveComposer()!.value).toBe('Prompt 2')
	expect(agenticPosts()).toEqual(['Prompt 1'])

	await act(async () => {
		answers[0].close()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	await draw()
	await sendFromComposer('Prompt 3')
	await waitForUi(() => expect(agenticPosts()).toEqual(['Prompt 1', 'Prompt 3']))
	expect(liveComposer()!.value).toBe('')
})

test('a prompt sent while a saved chat checks for a running answer goes out instead of waiting for the check', async () => {
	const probe = Promise.withResolvers<Response>()
	answerProbe = () => probe.promise
	goTo('/ai/chat/old-chat')
	await draw()
	await waitForUi(() =>
		expect(session.requests.some((call) => call.url.href.startsWith('https://ai.llama.fi/agentic/active/'))).toBe(true)
	)
	await draw()

	await sendFromComposer('Prompt 1')
	await waitForUi(() => expect(agenticPosts()).toEqual(['Prompt 1']))
	expect(liveComposer()!.value).toBe('')
	await act(async () => probe.resolve(Response.json({ active: false, execution: null })))
})

test('a submission that fails before its request starts says so in the chat, and the next prompt goes out', async () => {
	goTo('/ai/chat/old-chat')
	await draw()
	await waitForUi(() => expect(document.body.textContent).toContain('An older answer'))
	vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => {
		throw new Error('No randomness available')
	})
	await sendFromComposer('Prompt 1')
	await waitForUi(() =>
		expect(document.body.textContent).toContain(
			'The request was interrupted. Reload this conversation before trying again.'
		)
	)
	expect(agenticPosts()).toEqual([])
	expect(stopButton()).toBeUndefined()

	await sendFromComposer('Prompt 2')
	await waitForUi(() => expect(agenticPosts()).toEqual(['Prompt 2']))
	expect(stopButton()).toBeDefined()
})
