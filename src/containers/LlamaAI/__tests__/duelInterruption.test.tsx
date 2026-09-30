// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIRouteProvider } from '~/contexts/LlamaAIRouteState'
import { SessionAliasProvider } from '~/contexts/SessionAliasRegistry'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ChatSurface } from '../components/ChatSurface'

const router = vi.hoisted(() => ({
	query: {},
	pathname: '/ai/chat/[[...sessionId]]',
	asPath: '/ai/chat',
	isReady: true,
	push: async () => true,
	replace: async () => true,
	events: { on: () => undefined, off: () => undefined }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
// Keep prompt submission, recovery and the duel panel real; omit the rest of the chat surface.
vi.mock('../components/ChatSurface', () => ({
	ChatSurface: ({ landingProps, conversationViewModel }: ComponentProps<typeof ChatSurface>) => (
		<>
			<button type="button" onClick={() => landingProps.handleSubmit('Compare Aave and Morpho')}>
				Send prompt
			</button>
			{conversationViewModel.duelSlot}
		</>
	)
}))
vi.mock('../components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('../components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('../components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('../components/TokenLimitModal', () => ({ TokenLimitModal: () => null }))
vi.mock('../components/DeepLinkPromptModal', () => ({ DeepLinkPromptModal: () => null }))
vi.mock('../components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
vi.mock('../components/ConversationView', () => ({
	LoadingConversationState: () => null,
	EmptyConversationErrorState: () => null
}))
vi.mock('../components/AddToArticle/ArticleExportContext', () => ({
	ArticleExportProvider: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('~/containers/LlamaAI/projects/ProjectLanding', () => ({ ProjectLanding: () => null }))
vi.mock('~/containers/LlamaAI/projects/ProjectsGrid', () => ({ ProjectsGrid: () => null }))
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { AgenticChat } from '..'

const session = installSubscriberSession('reader')

// Every stream here closes without `done`: the client treats that as a dropped connection and recovers.
function droppedStream(events: Array<Record<string, unknown>>) {
	return () =>
		new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
			headers: { 'Content-Type': 'text/event-stream' }
		})
}

const running = {
	active: true,
	execution: { cursor: 7, hasResult: false, messageId: 'answer-a', startedAt: 1, status: 'running' }
}

let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	session.serve({
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '0',
			toppedUpBalance: '0',
			freeLimit: '1',
			freeSpent: '1'
		},
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/mobile-push/web-notifications': { available: false, enabled: false },
		'/user/sessions': { sessions: [], hasMore: false },
		'/agentic': droppedStream([
			{ type: 'message_id', messageId: 'answer-a' },
			{ type: 'duel_start', pairId: 'pair-1', arms: ['a', 'b'] },
			{ type: 'arm_message_id', messageId: 'answer-a', arm: 'a' },
			{ type: 'arm_message_id', messageId: 'answer-b', arm: 'b' },
			{ type: 'response_chunk', content: 'Aave leads', arm: 'a' },
			{ type: 'response_chunk', content: 'Morpho is smaller', arm: 'b' },
			{ type: 'response_end', arm: 'b' }
		])
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

async function sendPrompt() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SessionAliasProvider userId="reader">
					<LlamaAIRouteProvider value={{ kind: 'chat-new' }}>
						<AgenticChat />
					</LlamaAIRouteProvider>
				</SessionAliasProvider>
			</session.Wrapper>
		)
	)
	await act(async () =>
		[...document.querySelectorAll('button')].find((button) => button.textContent === 'Send prompt')!.click()
	)
}

function column(label: string) {
	const element = document.querySelector(`section[aria-label="${label}"]`)
	if (!element) throw new Error(`Missing ${label}`)
	return element
}
const alertText = (label: string) => column(label).querySelector('[role=alert]')?.textContent ?? null
const canPrefer = (label: string) =>
	!(column(label).querySelector(`button[aria-label="I prefer ${label}"]`) as HTMLButtonElement).disabled

test('an arm resumed by a reconnect shows as interrupted when the reconnect drops too', async () => {
	session.serve({
		'https://ai.llama.fi/agentic/active/': running,
		'https://ai.llama.fi/agentic/stream/': droppedStream([
			{ type: 'response_chunk', content: ' on deposits', arm: 'a' }
		]),
		// Recovery gives up on the execution and reloads the saved conversation.
		'https://ai.llama.fi/user/sessions/': { messages: [], hasMore: false }
	})

	await sendPrompt()

	// One callback, so the resumed text and the interrupted line hold on the same render. The message renderer
	// reveals streamed text gradually.
	await waitForUi(() => {
		expect(column('Response 1').textContent).toContain('Aave leads on deposits')
		expect(alertText('Response 1')).toBe('This response was interrupted.')
		expect(canPrefer('Response 1')).toBe(false)
	})
	expect(alertText('Response 2')).toBeNull()
})

test('a reconnect that delivers both answers leaves them final and open to a vote', async () => {
	session.serve({
		'https://ai.llama.fi/agentic/active/': running,
		'https://ai.llama.fi/agentic/stream/': () =>
			new Response(
				[
					{ type: 'response_chunk', content: ' on deposits', arm: 'a' },
					{ type: 'response_end', arm: 'a' },
					{ type: 'duel_ready' },
					{ type: 'done' }
				]
					.map((event) => `data: ${JSON.stringify(event)}\n\n`)
					.join(''),
				{ headers: { 'Content-Type': 'text/event-stream' } }
			)
	})

	await sendPrompt()

	// The message renderer reveals streamed text gradually.
	await waitForUi(() => {
		expect(column('Response 1').textContent).toContain('Aave leads on deposits')
		expect(column('Response 2').textContent).toContain('Morpho is smaller')
		expect([alertText('Response 1'), alertText('Response 2')]).toEqual([null, null])
		expect([canPrefer('Response 1'), canPrefer('Response 2')]).toEqual([true, true])
	})
})
