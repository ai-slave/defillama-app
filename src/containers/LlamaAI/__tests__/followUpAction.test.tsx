// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setLlamaAIWalkthroughState } from '~/contexts/LocalStorage'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const api = vi.hoisted(() => ({
	router: {
		query: {} as Record<string, string | Array<string>>,
		pathname: '/ai/chat/[[...sessionId]]',
		asPath: '/ai/chat',
		isReady: true,
		push: vi.fn(async () => true),
		replace: vi.fn(async () => true),
		prefetch: vi.fn(async () => {}),
		events: { on: vi.fn(), off: vi.fn() }
	}
}))
vi.mock('next/router', () => ({ default: api.router, useRouter: () => api.router }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
// Heavy children these tests read nothing from.
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('~/containers/LlamaAI/components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('~/containers/Account/EndTrialModal', () => ({ EndTrialModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

const session = installSubscriberSession('reader')
const agenticBodies = () =>
	session.requests
		.filter((call) => call.url.href === 'https://ai.llama.fi/agentic')
		.map((call) => JSON.parse(call.init!.body as string) as Record<string, unknown>)

// An older answer that offers one follow-up button.
const OLD_CHAT = {
	messages: [
		{ id: 'old-question', role: 'user', content: 'How much did Aave earn?' },
		{
			id: 'old-answer',
			role: 'assistant',
			content: 'Aave earned $1M this week.\n\n[ACTION:Fee trend|Show the fee trend]'
		}
	]
}

let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
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
		'https://ai.llama.fi/agentic/active/': { active: false, execution: null },
		'https://ai.llama.fi/agentic': () =>
			new Response(new ReadableStream(), { headers: { 'Content-Type': 'text/event-stream; cursor=v2' } }),
		'https://ai.llama.fi/user-tips/': { ok: true },
		'/user/sessions': { sessions: [], hasMore: false }
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
	api.router.query = {}
	api.router.asPath = '/ai/chat'
})

const draw = () =>
	act(async () => root.render(<session.Wrapper>{LlamaAIPage.getLayout(<LlamaAIPage />)}</session.Wrapper>))

const openOldChat = (extra: Record<string, unknown> = {}) => {
	api.router.query = { sessionId: ['old-chat'] }
	api.router.asPath = '/ai/chat/old-chat'
	session.serve({ '/user/sessions/old-chat/restore': { ...OLD_CHAT, ...extra } })
}

const button = (text: string) =>
	waitForUi(() => {
		const match = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
		expect(match).toBeDefined()
		return match!
	})
const turnOnResearch = async () => {
	const research = await waitForUi(() => {
		const input = document.querySelector<HTMLInputElement>('input[type="radio"][value="research"]')
		expect(input).not.toBeNull()
		return input!
	})
	await act(async () => research.click())
	await waitForUi(() => expect(research.checked).toBe(true))
}

test('a follow-up button is sent as a quick suggested question even while research mode is on, so it never spends the research report', async () => {
	openOldChat()
	await draw()
	const followUp = await button('Fee trend')
	await turnOnResearch()

	await act(async () => followUp.click())

	await waitForUi(() => expect(agenticBodies()).toHaveLength(1))
	expect(agenticBodies()[0]).toMatchObject({
		message: 'Show the fee trend',
		isSuggestedQuestion: true,
		entrySource: 'follow-up'
	})
	expect(agenticBodies()[0].mode).toBeUndefined()
})

test('a tip prompt is sent as a quick suggested question even while research mode is on', async () => {
	setLlamaAIWalkthroughState('completed')
	session.serve({
		'/user-settings': {
			settings: { customInstructions: '' },
			tip: {
				id: 'tip-yields',
				family: 'prompts',
				variant: 'a',
				title: 'Try a ready-made question',
				placement: 'greeting',
				cta: { kind: 'action', label: 'Top yields on Base', action: 'submit-prompt', prompt: 'Top yields on Base' },
				dismissPolicy: { kind: 'permanent' }
			}
		}
	})
	await draw()
	const tip = await button('Top yields on Base')
	await turnOnResearch()

	await act(async () => tip.click())

	await waitForUi(() => expect(agenticBodies()).toHaveLength(1))
	expect(agenticBodies()[0]).toMatchObject({
		message: 'Top yields on Base',
		isSuggestedQuestion: true,
		entrySource: 'tip'
	})
	expect(agenticBodies()[0].mode).toBeUndefined()
})

test('a follow-up while a queued prompt waits joins the queue as a quick question, even while research mode is on', async () => {
	openOldChat({
		queueRevision: 1,
		queuedMessages: [
			{
				id: 'q1',
				state: 'pending',
				message: 'Queued first',
				researchMode: false,
				client: 'web',
				queuedAt: '2026-10-01T10:00:00.000Z'
			}
		]
	})
	await draw()
	const followUp = await button('Fee trend')
	await turnOnResearch()

	await act(async () => followUp.click())

	const queued = await waitForUi(() => {
		const post = session.requests.find((call) => call.url.pathname === '/agentic/queue' && call.init?.method === 'POST')
		expect(post).toBeDefined()
		return JSON.parse(post!.init!.body as string) as Record<string, unknown>
	})
	expect(queued).toMatchObject({ message: 'Show the fee trend', researchMode: false, factCheckMode: false })
	expect(queued.quotedText).toBeUndefined()
	expect(agenticBodies()).toEqual([])
})
