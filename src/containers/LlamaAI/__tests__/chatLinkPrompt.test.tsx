// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { liveComposer, submitComposer } from './chatComposer'

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
// Heavy surfaces this test asserts nothing about; the composer, prompt submission, restore and routing stay real.
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
		.map((call) => JSON.parse(call.init!.body as string) as { message: string; shareToken?: string })

let root: Root
let subscription: ReturnType<typeof Promise.withResolvers<Response>>
/** Answers each POST /agentic; the default leaves it open. */
let answerPrompt: () => Promise<Response>

/** The router moved to `url`, as a shallow replace does. */
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
	api.router.replace.mockImplementation(async (url: string) => {
		goTo(url)
		return true
	})
	session.client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
	subscription = Promise.withResolvers<Response>()
	answerPrompt = () => new Promise<Response>(() => {})
	session.serve({
		'/subscription/status': () => subscription.promise,
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '1',
			toppedUpBalance: '0',
			freeLimit: '1',
			freeSpent: '0'
		},
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/mobile-push/web-notifications': { available: false, enabled: false },
		'https://ai.llama.fi/agentic/active/': { active: false, execution: null },
		'https://ai.llama.fi/agentic': () => answerPrompt(),
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

test("a chat link's prompt fills the composer once the account loads, and the prompt and its share token go out when the reader sends it", async () => {
	goTo('/ai/chat/old-chat?prompt=Compare%20these&shareToken=shared-1&view=terminal')
	await draw()
	// The subscription read is still out, so the chat has not mounted; a frame passes meanwhile.
	await act(async () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))))
	await draw()

	await act(async () =>
		subscription.resolve(Response.json({ subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } }))
	)
	// Only the prompt leaves the URL; the share token waits for the first message sent.
	// The chat mounts once the account loads, importing its lazy modules; a cold import alone can pass a second.
	await waitForUi(() => expect(api.router.asPath).toBe('/ai/chat/old-chat?shareToken=shared-1&view=terminal'), {
		timeout: 5000
	})
	// The shallow replace re-renders the page with the new URL.
	await draw()
	await waitForUi(() => expect(liveComposer()?.value).toBe('Compare these'))
	expect(agenticPosts()).toEqual([])

	await submitComposer()
	await waitForUi(() => expect(agenticPosts()).toMatchObject([{ message: 'Compare these', shareToken: 'shared-1' }]))
	await waitForUi(() => expect(api.router.asPath).toBe('/ai/chat/old-chat?view=terminal'))
})
