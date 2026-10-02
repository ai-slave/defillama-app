// @vitest-environment happy-dom
// @vitest-environment-options {"url":"http://localhost/ai/chat"}
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
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
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

const session = installSubscriberSession('reader', { account: 'free', resolved: true })
let root: Root
let remaining: number

const freeQuestions = () => ({
	remaining,
	limit: 5,
	period: 'daily',
	resetTime: '2026-10-02T00:00:00.000Z'
})

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	remaining = 3
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
		'https://ai.llama.fi/projects/usage': { limits: { projects: 10 } },
		'https://ai.llama.fi/projects': { projects: [] },
		'/subscription/trial-available': { trialAvailable: false },
		'https://ai.llama.fi/agentic/active/': { active: false, execution: null },
		'/user/sessions': () =>
			Response.json({
				sessions: [],
				hasMore: false,
				usage: {
					free_form_question: freeQuestions(),
					welcome_bonus: { dailyQuestions: 5, endsAt: '2026-10-09T09:00:00.000Z' }
				}
			}),
		'https://ai.llama.fi/agentic': (_url: URL, init?: RequestInit) => {
			// The server spends one of today's questions on this answer.
			remaining -= 1
			const { sessionId } = JSON.parse(init!.body as string) as { sessionId: string }
			const events = [
				{ type: 'session', sessionId },
				{ type: 'title', title: 'Aave TVL' },
				{ type: 'response_chunk', content: 'Aave holds about $19B.' },
				{ type: 'done' }
			]
			return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
				headers: { 'Content-Type': 'text/event-stream' }
			})
		}
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<session.Wrapper>{LlamaAIPage.getLayout(<LlamaAIPage />)}</session.Wrapper>))
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

async function ask(question: string) {
	await waitForUi(() => expect(document.body.textContent).toContain('3 of 5 questions left today'))
	const textarea = document.querySelector<HTMLTextAreaElement>('form textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, question)
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => {
		textarea.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
}

test('the questions-left count drops once an answer that spent a question finishes', async () => {
	await ask('What is Aave TVL?')

	await waitForUi(() => expect(document.body.textContent).toContain('Aave holds about $19B.'))
	await waitForUi(() => expect(document.body.textContent).toContain('2 of 5 questions left today'))
})

test('the questions-left count shows none left once the server answers with the free question limit', async () => {
	session.serve({
		'https://ai.llama.fi/agentic': () => {
			// Another tab spent the last questions, so the server refuses this one.
			remaining = 0
			return fixtureStatus(403, {
				type: 'error',
				code: 'FREE_FORM_LIMIT',
				content: 'limit',
				details: { resetTime: '2026-10-02T00:00:00.000Z' }
			})()
		}
	})
	await ask('What is Aave TVL?')

	await waitForUi(() => expect(document.body.textContent).toContain("Today's questions are used"))
})
