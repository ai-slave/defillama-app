// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setLlamaAIWalkthroughState } from '~/contexts/LocalStorage'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
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
const toast = vi.hoisted(() =>
	Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn(), custom: vi.fn() })
)
vi.mock('react-hot-toast', () => ({ default: toast, toast, Toaster: () => null }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
// Heavy children these tests read nothing from.
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('~/containers/LlamaAI/components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TokenLimitModal', () => ({ TokenLimitModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

const session = installSubscriberSession('reader')
const track = installUmamiSink()
let root: Root

const usageLimit = (details: Record<string, unknown>) =>
	fixtureStatus(403, { type: 'error', code: 'USAGE_LIMIT_EXCEEDED', content: 'limit', details })

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	toast.mockClear()
	// A returning subscriber: the first-visit walkthrough would open its own dialog.
	setLlamaAIWalkthroughState('completed')
	session.client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
	session.serve({
		'/subscription/status': { subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } },
		'/subscription/trial-available': { trialAvailable: false },
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '1',
			toppedUpBalance: '0',
			freeLimit: '1',
			freeSpent: '0'
		},
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/mobile-push/web-notifications': { available: false, enabled: false },
		'/user/sessions': { sessions: [], hasMore: false }
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

async function send(question: string) {
	const textarea = await waitForUi(() => {
		const input = document.querySelector<HTMLTextAreaElement>('form textarea')
		expect(input).not.toBeNull()
		return input!
	})
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, question)
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => {
		textarea.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
}

test('a research limit shows up as a message in the chat, not as a dialog over it, and never says the report is running', async () => {
	session.serve({
		'https://ai.llama.fi/agentic': usageLimit({
			feature: 'research_report',
			period: 'biweekly',
			limit: 1,
			resetTime: '2026-10-12T00:00:00.000Z'
		})
	})
	await act(async () => document.querySelector<HTMLInputElement>('input[type="radio"][aria-label="Research"]')!.click())
	await send('Write a report on restaking')

	await waitForUi(() =>
		expect(document.body.textContent).toContain("You've used your free research report. Next one on Oct 12, 2026.")
	)
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	expect(toast).not.toHaveBeenCalled()
})

test('a fact-checked daily limit says fact-checked answers, not research reports, and is counted as fact_checked', async () => {
	session.serve({
		'https://ai.llama.fi/agentic': usageLimit({ feature: 'fact_checked', period: 'daily', limit: 3, resetTime: null })
	})
	await send('Is the Aave TVL figure right?')

	await waitForUi(() =>
		expect(document.body.textContent).toContain(
			"You've used all 3 fact-checked answers for today. Resets at midnight UTC."
		)
	)
	expect(track).toHaveBeenCalledWith('llamaai-limit-hit', { type: 'fact_checked' })
	expect(track).not.toHaveBeenCalledWith('llamaai-limit-hit', { type: 'research' })
})
