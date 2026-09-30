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
// The conversation, its messages and the duel panel stay real; the landing and composer are one button each.
vi.mock('../components/ChatSurface', async () => {
	const { ConversationView } = await import('../components/ConversationView')
	return {
		ChatSurface: ({ landingProps, conversationViewModel }: ComponentProps<typeof ChatSurface>) => (
			<>
				<button type="button" onClick={() => landingProps.handleSubmit('Compare Aave and Morpho')}>
					Send prompt
				</button>
				<button type="button" onClick={() => conversationViewModel.handleSubmit('And Spark?')}>
					Send follow-up
				</button>
				<ConversationView viewModel={conversationViewModel} animateActiveExchange={false} />
			</>
		)
	}
})
vi.mock('../components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('../components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('../components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('../components/TokenLimitModal', () => ({ TokenLimitModal: () => null }))
vi.mock('../components/DeepLinkPromptModal', () => ({ DeepLinkPromptModal: () => null }))
vi.mock('../components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
vi.mock('~/containers/LlamaAI/projects/ProjectLanding', () => ({ ProjectLanding: () => null }))
vi.mock('~/containers/LlamaAI/projects/ProjectsGrid', () => ({ ProjectsGrid: () => null }))
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { AgenticChat } from '..'

const session = installSubscriberSession('reader')

function sse(events: Array<Record<string, unknown>>) {
	return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
		headers: { 'Content-Type': 'text/event-stream' }
	})
}

/** The duel prompt's stream; the test writes its events and decides when the body closes. */
let duel: { write: (...events: Array<Record<string, unknown>>) => void; close: () => void }
function duelStream() {
	const encoder = new TextEncoder()
	const body = new ReadableStream<Uint8Array>({
		start: (controller) => {
			duel = {
				write: (...events) =>
					controller.enqueue(encoder.encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''))),
				close: () => controller.close()
			}
		}
	})
	return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

// Every stream opens by naming its execution, as the server's preamble does.
const duelOpening = [
	{ type: 'session', sessionId: 'chat-1', startedAt: 1 },
	{ type: 'message_id', messageId: 'answer-a' },
	{ type: 'user_message_id', messageId: 'question-1' },
	{ type: 'duel_start', pairId: 'pair-1', arms: ['a', 'b'] },
	{ type: 'arm_message_id', messageId: 'answer-a', arm: 'a' },
	{ type: 'arm_message_id', messageId: 'answer-b', arm: 'b' },
	{ type: 'response_chunk', content: 'Aave leads', arm: 'a' },
	{ type: 'response_chunk', content: 'Morpho is smaller', arm: 'b' }
]

// The server kept arm B's answer for the thread when the duel's execution finished, and saved the queued prompt below it.
const savedThread = [
	{ messageId: 'question-1', role: 'user', content: 'Compare Aave and Morpho' },
	{ messageId: 'answer-b', role: 'assistant', content: 'Morpho is smaller' },
	{ messageId: 'question-2', role: 'user', content: 'And Spark?' }
]

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
		'https://ai.llama.fi/agentic': () => duelStream(),
		'https://ai.llama.fi/agentic/active/chat-1': { active: false, execution: null },
		'https://ai.llama.fi/user/sessions/chat-1/restore': { messages: savedThread, hasMore: false }
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

async function click(name: string) {
	await act(async () =>
		[...document.querySelectorAll('button')]
			.find((button) => button.textContent === name || button.getAttribute('aria-label') === name)!
			.click()
	)
}

async function startDuel() {
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
	await click('Send prompt')
	await act(async () => duel.write(...duelOpening))
	await waitForUi(() => expect(duelColumns()).toEqual(['Response 1', 'Response 2']))
}

const duelColumns = () =>
	[...document.querySelectorAll('section[aria-label^="Response"]')].map((column) => column.getAttribute('aria-label'))
const thread = () => document.body.textContent
const canPrefer = () =>
	[...document.querySelectorAll<HTMLButtonElement>('button[aria-label^="I prefer"]')].map((button) => !button.disabled)

test('a queued answer that starts after an unvoted duel shows in place of the duel, below its saved answer', async () => {
	session.serve({
		'https://ai.llama.fi/agentic/queue': {
			snapshot: {
				sessionId: 'chat-1',
				revision: 1,
				queue: [
					{
						id: 'queue-1',
						state: 'pending',
						message: 'And Spark?',
						researchMode: false,
						client: 'web',
						queuedAt: '2026-09-30T00:00:00.000Z'
					}
				]
			},
			maxDepth: 5
		},
		// Arm B's answer failed to save, so no vote opens and the server fires the queued prompt at once.
		'https://ai.llama.fi/agentic/stream/chat-1': () =>
			sse([
				{ type: 'session', sessionId: 'chat-1', startedAt: 2 },
				{ type: 'message_id', messageId: 'answer-2' },
				{ type: 'user_message_id', messageId: 'question-2', queueItemId: 'queue-1' },
				{ type: 'response_chunk', content: 'Spark is newer' }
			])
	})
	await startDuel()
	await click('Send follow-up')
	await act(async () => {
		duel.write({ type: 'response_end', arm: 'a' }, { type: 'response_end', arm: 'b' }, { type: 'done' })
		duel.close()
	})

	await waitForUi(() => {
		expect(duelColumns()).toEqual([])
		const text = thread()!
		expect(text).toContain('Spark is newer')
		expect(text.indexOf('Morpho is smaller')).toBeGreaterThan(text.indexOf('Compare Aave and Morpho'))
		expect(text.indexOf('And Spark?')).toBeGreaterThan(text.indexOf('Morpho is smaller'))
		expect(text).not.toContain('Aave leads')
	})
})

test("a prompt sent after an unvoted duel replaces the duel at once, and the duel's saved answer stays above it", async () => {
	await startDuel()
	await act(async () => {
		duel.write(
			{ type: 'response_end', arm: 'a' },
			{ type: 'response_end', arm: 'b' },
			{ type: 'duel_ready' },
			{ type: 'done' }
		)
		duel.close()
	})
	await waitForUi(() => expect(canPrefer()).toEqual([true, true]))

	// The new prompt's stream stays silent, so nothing it sends can be what ends the duel.
	await click('Send follow-up')

	await waitForUi(() => {
		expect(duelColumns()).toEqual([])
		const text = thread()!
		expect(text.indexOf('Morpho is smaller')).toBeGreaterThan(text.indexOf('Compare Aave and Morpho'))
		expect(text.indexOf('And Spark?')).toBeGreaterThan(text.indexOf('Morpho is smaller'))
		expect(text).not.toContain('Aave leads')
	})
})

/** Settles the duel with a vote open, then edits the duel's prompt through its bubble. */
async function editDuelPrompt() {
	await act(async () => {
		duel.write(
			{ type: 'response_end', arm: 'a' },
			{ type: 'response_end', arm: 'b' },
			{ type: 'duel_ready' },
			{ type: 'done' }
		)
		duel.close()
	})
	await waitForUi(() => expect(document.querySelector('button[aria-label="Edit message"]')).not.toBeNull())
	await click('Edit message')
	const draft = document.querySelector('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(draft, 'Compare Aave and Spark')
		draft.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await click('Save')
}

test("an edit sent while a duel shows streams the edit's own answer instead of the duel", async () => {
	await startDuel()
	session.serve({
		'https://ai.llama.fi/agentic': () =>
			sse([
				{ type: 'session', sessionId: 'chat-1', startedAt: 2 },
				{ type: 'message_id', messageId: 'answer-edit' },
				{ type: 'response_chunk', content: 'Spark is newer' },
				{ type: 'done' }
			])
	})

	await editDuelPrompt()

	await waitForUi(() => {
		expect(duelColumns()).toEqual([])
		expect(thread()).toContain('Spark is newer')
	})
	expect(thread()).not.toContain('Morpho is smaller')
})

test('an edit the server refuses before it starts brings the duel back, still open to a vote', async () => {
	await startDuel()
	// The saved thread answers at once, so a reload started by the edit would land before the refusal.
	const refusal = Promise.withResolvers<Response>()
	session.serve({ 'https://ai.llama.fi/agentic': () => refusal.promise })

	await editDuelPrompt()
	await act(async () => refusal.resolve(Response.json({ error: 'Server error' }, { status: 500 })))

	await waitForUi(() => {
		expect(duelColumns()).toEqual(['Response 1', 'Response 2'])
		expect(thread()).toContain('Aave leads')
		expect(thread()).toContain('Morpho is smaller')
		expect(canPrefer()).toEqual([true, true])
	})
})

test("the duel's own stream reconnecting keeps both answers in the duel", async () => {
	session.serve({
		'https://ai.llama.fi/agentic/active/chat-1': {
			active: true,
			execution: { cursor: 10, hasResult: false, messageId: 'answer-a', startedAt: 1, status: 'running' }
		},
		'https://ai.llama.fi/agentic/stream/chat-1': () =>
			sse([
				{ type: 'session', sessionId: 'chat-1', startedAt: 1 },
				{ type: 'message_id', messageId: 'answer-a' },
				{ type: 'response_chunk', content: ' on deposits', arm: 'a' },
				{ type: 'response_end', arm: 'a' },
				{ type: 'response_end', arm: 'b' },
				{ type: 'duel_ready' },
				{ type: 'done' }
			])
	})
	await startDuel()
	// The body closes without `done`: the chat treats it as a dropped connection and reconnects.
	await act(async () => duel.close())

	await waitForUi(() => {
		expect(duelColumns()).toEqual(['Response 1', 'Response 2'])
		expect(thread()).toContain('Aave leads on deposits')
		expect(canPrefer()).toEqual([true, true])
	})
})
