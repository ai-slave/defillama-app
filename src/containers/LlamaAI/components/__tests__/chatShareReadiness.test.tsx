// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIRouteProvider, type LlamaAIRouteState } from '~/contexts/LlamaAIRouteState'
import type { ChatSurface } from '../ChatSurface'

const api = vi.hoisted(() => ({
	fetch: vi.fn(),
	copy: vi.fn(),
	router: {
		query: {},
		pathname: '/ai/chat',
		asPath: '/ai/chat',
		isReady: true,
		push: vi.fn(),
		replace: vi.fn(),
		events: { on: vi.fn(), off: vi.fn() }
	}
}))
vi.mock('next/router', () => ({ default: api.router, useRouter: () => api.router }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: { id: 'reader' }, isAuthenticated: true, authorizedFetch: api.fetch })
}))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
// Keep prompt submission, stream handling, cache reconciliation and Share controls real; omit unrelated surfaces.
vi.mock('../ChatSurface', () => ({
	ChatSurface: ({ landingProps, conversationViewModel }: ComponentProps<typeof ChatSurface>) => (
		<>
			<button type="button" onClick={() => landingProps.handleSubmit('Hello')}>
				Send prompt
			</button>
			<p>{conversationViewModel.error}</p>
		</>
	)
}))
vi.mock('../sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('../AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('../SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('../TokenLimitModal', () => ({ TokenLimitModal: () => null }))
vi.mock('../DeepLinkPromptModal', () => ({ DeepLinkPromptModal: () => null }))
vi.mock('../TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
vi.mock('../ConversationView', () => ({
	LoadingConversationState: () => <p>Loading conversation</p>,
	EmptyConversationErrorState: () => <p>Conversation failed</p>
}))
vi.mock('../AddToArticle/ArticleExportContext', () => ({
	ArticleExportProvider: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('~/containers/LlamaAI/projects/ProjectLanding', () => ({ ProjectLanding: () => null }))
vi.mock('~/containers/LlamaAI/projects/ProjectsGrid', () => ({ ProjectsGrid: () => null }))
vi.mock('~/containers/LlamaAI/hooks/useWebMobilePushPreference', () => ({
	WEB_MOBILE_PUSH_QUERY_KEY: ['push'],
	isWebMobilePushEnabled: () => false,
	useWebMobilePushPreference: () => ({ preference: { kind: 'known', enabled: false } })
}))
vi.mock('~/containers/Subscription/useTopup', () => ({
	AI_BALANCE_QUERY_KEY: 'balance',
	useAiBalance: () => ({ balance: null, totalAvailable: 0 })
}))
vi.mock('~/containers/LlamaAI/hooks/useLlamaAISettings', () => ({
	useLlamaAISetting: () => false,
	useLlamaAISettings: () => ({
		settings: { customInstructions: '', enablePremiumTools: false },
		actions: {},
		queryState: {}
	})
}))

import { AgenticChat } from '../..'

let root: Root
let client: QueryClient
let request: ReturnType<typeof Promise.withResolvers<Response>>
let submittedId: string
let shareRequests: Array<string>

async function mount(route: LlamaAIRouteState = { kind: 'chat-new' }) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<LlamaAIRouteProvider value={route}>
					<AgenticChat />
				</LlamaAIRouteProvider>
			</QueryClientProvider>
		)
	)
}
async function waitFor(check: () => void) {
	await act(async () => {
		await vi.waitFor(check)
	})
}
function shareButtons() {
	const buttons = [...document.querySelectorAll('button')].filter(
		(button) => button.textContent?.trim() === 'Share conversation'
	)
	expect(buttons.length, 'Share controls must remain available').toBeGreaterThan(0)
	return buttons
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	api.copy.mockResolvedValue(undefined)
	api.router.push.mockResolvedValue(true)
	api.router.replace.mockResolvedValue(true)
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: api.copy } })
	client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	request = Promise.withResolvers<Response>()
	shareRequests = []
	api.fetch.mockImplementation((url: string, options?: RequestInit) => {
		const path = new URL(url).pathname
		if (path.endsWith('/agentic')) {
			submittedId = JSON.parse(options!.body as string).sessionId
			return request.promise
		}
		if (path.endsWith('/share')) {
			shareRequests.push(path)
			return Promise.resolve(Response.json({ shareToken: 'shared-chat', isPublic: true }))
		}
		if (path.endsWith('/user/sessions') && options?.method === 'POST') return Promise.resolve(Response.json({}))
		if (path.endsWith('/old-chat/restore'))
			return Promise.resolve(
				Response.json({ messages: [{ id: 'old-answer', role: 'assistant', content: 'An older answer' }] })
			)
		if (path.endsWith('/agentic/active/old-chat'))
			return Promise.resolve(Response.json({ active: false, execution: null }))
		if (path.endsWith('/user/sessions')) return Promise.resolve(Response.json({ sessions: [], hasMore: false }))
		throw new Error(`Unexpected request: ${url}`)
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	document.body.innerHTML = ''
})

test.each(['same', 'different'])(
	'sharing becomes available when the server confirms the %s session ID',
	async (identity) => {
		await mount()
		await act(async () =>
			[...document.querySelectorAll('button')].find((button) => button.textContent === 'Send prompt')!.click()
		)
		await waitFor(() => {
			shareButtons()
		})
		await act(async () => {
			for (const button of shareButtons()) {
				expect(button.getAttribute('aria-disabled')).toBe('true')
				button.click()
			}
		})
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		const confirmedId = identity === 'same' ? submittedId : 'server-session'
		await act(async () =>
			request.resolve(
				new Response(
					[
						{ type: 'session', sessionId: confirmedId },
						{ type: 'title', title: 'Saved conversation' },
						{ type: 'response_chunk', content: 'Hello back' },
						{ type: 'done' }
					]
						.map((event) => `data: ${JSON.stringify(event)}\n\n`)
						.join(''),
					{ headers: { 'Content-Type': 'text/event-stream' } }
				)
			)
		)
		await waitFor(() => {
			for (const button of shareButtons()) expect(button.getAttribute('aria-disabled')).not.toBe('true')
		})
		await act(async () => shareButtons()[0].click())
		await waitFor(() =>
			expect(document.querySelector('input')?.value).toBe('http://localhost:3000/ai/chat/shared/shared-chat')
		)
		expect(shareRequests).toEqual([`/user/sessions/${confirmedId}/share`])
		expect(api.copy.mock.calls).toEqual([['http://localhost:3000/ai/chat/shared/shared-chat']])
	}
)

test('a failed first prompt stays unshareable while an older restored chat outside the list can be shared', async () => {
	await mount()
	await act(async () =>
		[...document.querySelectorAll('button')].find((button) => button.textContent === 'Send prompt')!.click()
	)
	await act(async () => request.resolve(Response.json({ error: 'Prompt rejected' }, { status: 400 })))
	await waitFor(() => expect(document.body.textContent).toContain('Prompt rejected'))
	await act(async () => {
		for (const button of shareButtons()) {
			expect(button.getAttribute('aria-disabled')).toBe('true')
			button.click()
		}
	})
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	await mount({ kind: 'chat-session', sessionId: 'old-chat' })
	await waitFor(() => {
		for (const button of shareButtons()) expect(button.getAttribute('aria-disabled')).not.toBe('true')
	})
	await act(async () => shareButtons()[0].click())
	await waitFor(() =>
		expect(document.querySelector('input')?.value).toBe('http://localhost:3000/ai/chat/shared/shared-chat')
	)
	expect(shareRequests).toEqual(['/user/sessions/old-chat/share'])
})
