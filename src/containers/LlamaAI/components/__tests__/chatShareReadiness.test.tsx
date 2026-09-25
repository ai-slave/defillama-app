// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIRouteProvider, type LlamaAIRouteState } from '~/contexts/LlamaAIRouteState'
import { SessionAliasProvider } from '~/contexts/SessionAliasRegistry'
import type { ChatSurface } from '../ChatSurface'
import type { AgenticSidebar } from '../sidebar/AgenticSidebar'

const api = vi.hoisted(() => ({
	copy: vi.fn(),
	router: {
		query: {},
		pathname: '/ai/chat/[[...sessionId]]',
		asPath: '/ai/chat',
		isReady: true,
		push: vi.fn(),
		replace: vi.fn(),
		events: { on: vi.fn(), off: vi.fn() }
	}
}))
vi.mock('next/router', () => ({ default: api.router, useRouter: () => api.router }))
// Keep prompt submission, stream handling, cache reconciliation and Share controls real; omit unrelated surfaces.
vi.mock('../ChatSurface', () => ({
	ChatSurface: ({ landingProps, conversationViewModel }: ComponentProps<typeof ChatSurface>) => (
		<>
			<button type="button" onClick={() => landingProps.handleSubmit('Hello')}>
				Send prompt
			</button>
			<p>{conversationViewModel.error}</p>
			<output data-testid="streaming">{String(conversationViewModel.isStreaming)}</output>
		</>
	)
}))
vi.mock('../sidebar/AgenticSidebar', () => ({
	AgenticSidebar: ({ onNewChat }: ComponentProps<typeof AgenticSidebar>) => (
		<button type="button" onClick={onNewChat}>
			New Chat
		</button>
	)
}))
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
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { AgenticChat } from '../..'

const session = installSubscriberSession('reader')
const aiCalls = () => session.requests.filter((call) => call.url.hostname === 'ai.llama.fi')
const sharePaths = () => aiCalls().flatMap((call) => (call.url.pathname.endsWith('/share') ? [call.url.pathname] : []))
/** The session ID the client generated for its first prompt. */
const submittedId = () =>
	JSON.parse(aiCalls().find((call) => call.url.pathname === '/agentic')!.init!.body as string).sessionId as string

let root: Root
let request: ReturnType<typeof Promise.withResolvers<Response>>
let routeStartListeners: Set<(url: string) => void>

function startNavigation(url: string) {
	for (const listener of routeStartListeners) listener(url)
}

async function mount(route: LlamaAIRouteState = { kind: 'chat-new' }) {
	api.router.pathname = route.kind === 'project' ? '/ai/projects/[id]' : '/ai/chat/[[...sessionId]]'
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SessionAliasProvider userId="reader">
					<LlamaAIRouteProvider value={route}>
						<AgenticChat />
					</LlamaAIRouteProvider>
				</SessionAliasProvider>
			</session.Wrapper>
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
	routeStartListeners = new Set()
	api.router.events.on.mockImplementation((event, listener) => {
		if (event === 'routeChangeStart') routeStartListeners.add(listener)
	})
	api.router.events.off.mockImplementation((event, listener) => {
		if (event === 'routeChangeStart') routeStartListeners.delete(listener)
	})
	api.router.push.mockImplementation(async (url: string) => {
		startNavigation(url)
		return true
	})
	api.router.replace.mockImplementation(async (url: string) => {
		startNavigation(url)
		return true
	})
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: api.copy } })
	session.client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	request = Promise.withResolvers<Response>()
	session.serve({
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '0',
			toppedUpBalance: '0',
			freeLimit: '1',
			freeSpent: '1'
		},
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/mobile-push/web-notifications': { available: false, enabled: false },
		'https://ai.llama.fi/agentic/active/': { active: false, execution: null },
		'/agentic': () => request.promise,
		// Lists and creates sessions; creation ignores the body.
		'/user/sessions': { sessions: [], hasMore: false },
		// Every other session path here is a share request for a session whose ID the test does not know upfront.
		'https://ai.llama.fi/user/sessions/': { shareToken: 'shared-chat', isPublic: true },
		'/user/sessions/old-chat/restore': {
			messages: [{ id: 'old-answer', role: 'assistant', content: 'An older answer' }]
		},
		'/projects/project-1/sessions': { sessions: [] }
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
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
		const confirmedId = identity === 'same' ? submittedId() : 'server-session'
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
		expect(sharePaths()).toEqual([`/user/sessions/${confirmedId}/share`])
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
	expect(sharePaths()).toEqual(['/user/sessions/old-chat/share'])
})

test('a preparation failure clears streaming, displays the error, and permits another submission', async () => {
	await mount({ kind: 'chat-session', sessionId: 'old-chat' })
	await waitFor(() => expect(document.querySelector('[data-testid="streaming"]')).not.toBeNull())
	const uuid = vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => {
		throw new Error('UUID unavailable')
	})
	const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
	try {
		await act(async () =>
			[...document.querySelectorAll('button')].find((button) => button.textContent === 'Send prompt')!.click()
		)
		expect(document.body.textContent).toContain('The request was interrupted.')
		expect(document.querySelector('[data-testid="streaming"]')?.textContent).toBe('false')
		await act(async () =>
			[...document.querySelectorAll('button')].find((button) => button.textContent === 'Send prompt')!.click()
		)
		await waitFor(() => expect(aiCalls().some((call) => call.url.pathname.endsWith('/agentic'))).toBe(true))
		expect(document.querySelector('[data-testid="streaming"]')?.textContent).toBe('true')
	} finally {
		uuid.mockRestore()
		consoleError.mockRestore()
	}
})

test.each(['chat-new', 'project'] as const)(
	'moves a prompt from %s to its chat URL without restarting the request',
	async (kind) => {
		await mount(kind === 'project' ? { kind, projectId: 'project-1', initialTab: 'chats' } : { kind })
		await act(async () =>
			[...document.querySelectorAll('button')].find((button) => button.textContent === 'Send prompt')!.click()
		)
		await waitFor(() =>
			expect(api.router.push).toHaveBeenCalledWith(`/ai/chat/${submittedId()}`, undefined, {
				shallow: kind !== 'project',
				scroll: false
			})
		)
		await mount({ kind: 'chat-session', sessionId: submittedId() })
		expect(document.querySelector('[data-testid="streaming"]')?.textContent).toBe('true')
		expect(aiCalls().some((call) => call.url.pathname.endsWith('/restore'))).toBe(false)
		const prompts = aiCalls().filter((call) => call.url.pathname.endsWith('/agentic'))
		expect(prompts).toHaveLength(1)
		expect(JSON.parse(prompts[0].init!.body as string).projectId).toBe(kind === 'project' ? 'project-1' : undefined)
		await act(async () =>
			request.resolve(
				new Response(
					'data: {"type":"session","sessionId":"server-session"}\n\ndata: {"type":"title","title":"Saved conversation"}\n\ndata: {"type":"done"}\n\n',
					{
						headers: { 'Content-Type': 'text/event-stream' }
					}
				)
			)
		)
		await waitFor(() =>
			expect(api.router.replace).toHaveBeenCalledWith('/ai/chat/server-session', undefined, {
				shallow: true,
				scroll: false
			})
		)
		expect(api.router.push).toHaveBeenCalledTimes(1)
	}
)

test.each(['/ai/projects/project-1', '/ai/chat/another-session'])(
	'a late session ID does not override pending navigation to %s',
	async (destination) => {
		await mount()
		await act(async () =>
			[...document.querySelectorAll('button')].find((button) => button.textContent === 'Send prompt')!.click()
		)
		await waitFor(() => expect(api.router.push).toHaveBeenCalledTimes(1))
		await mount({ kind: 'chat-session', sessionId: submittedId() })
		const navigation = Promise.withResolvers<boolean>()
		api.router.push.mockImplementationOnce((url: string) => {
			startNavigation(url)
			return navigation.promise
		})
		await act(async () => {
			void api.router.push(destination)
		})
		// Keep the old route mounted until after the response arrives.
		await act(async () =>
			request.resolve(
				new Response(
					'data: {"type":"session","sessionId":"late-session"}\n\ndata: {"type":"response_chunk","content":"Hello back"}\n\ndata: {"type":"done"}\n\n',
					{ headers: { 'Content-Type': 'text/event-stream' } }
				)
			)
		)
		await waitFor(() => expect(routeStartListeners.size).toBe(0))
		expect(api.router.replace).not.toHaveBeenCalled()
		navigation.resolve(true)
	}
)
