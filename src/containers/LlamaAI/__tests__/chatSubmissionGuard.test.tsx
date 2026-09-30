// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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
// Heavy surfaces this test asserts nothing about; submission, streaming and routing stay real.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/LlamaAI/components/ChatSurface', () => ({
	// Sends the reader's prompt and shows whether the chat took it.
	ChatSurface: ({
		landingProps
	}: {
		landingProps: { handleSubmit: (prompt: string) => boolean | Promise<unknown> }
	}) => (
		<button
			type="button"
			onClick={async () => {
				const taken = await landingProps.handleSubmit(`Prompt ${++sent}`)
				document.querySelector('[data-testid="taken"]')!.textContent = String(taken)
			}}
		>
			Send prompt
		</button>
	)
}))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('~/containers/LlamaAI/components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TokenLimitModal', () => ({ TokenLimitModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

let sent = 0
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
	act(async () =>
		root.render(
			<session.Wrapper>
				<output data-testid="taken" />
				{LlamaAIPage.getLayout(<LlamaAIPage />)}
			</session.Wrapper>
		)
	)

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	sent = 0
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

const taken = () => document.querySelector('[data-testid="taken"]')!.textContent
async function send() {
	const button = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Send prompt')!
	await act(async () => button.click())
}

test('a prompt sent after an answer is done but before its response closes is refused, and goes out once it closes', async () => {
	goTo('/ai/chat')
	await draw()
	await send()
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

	await send()
	expect(taken()).toBe('false')
	expect(agenticPosts()).toEqual(['Prompt 1'])

	await act(async () => {
		answers[0].close()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	await draw()
	await send()
	expect(taken()).toBe('true')
	await waitForUi(() => expect(agenticPosts()).toEqual(['Prompt 1', 'Prompt 3']))
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

	await send()
	expect(taken()).toBe('true')
	await waitForUi(() => expect(agenticPosts()).toEqual(['Prompt 1']))
	await act(async () => probe.resolve(Response.json({ active: false, execution: null })))
})

test('a submission that fails before its request starts says so in the chat', async () => {
	goTo('/ai/chat')
	await draw()
	vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => {
		throw new Error('No randomness available')
	})
	await send()
	await waitForUi(() =>
		expect(document.body.textContent).toContain(
			'The request was interrupted. Reload this conversation before trying again.'
		)
	)
	expect(agenticPosts()).toEqual([])
})
