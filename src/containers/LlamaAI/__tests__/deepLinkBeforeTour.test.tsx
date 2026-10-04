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
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ AgenticSidebar: () => null }))
vi.mock('~/containers/LlamaAI/components/AlertsModal', () => ({ AlertsModal: () => null }))
vi.mock('~/containers/LlamaAI/components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('~/containers/Account/EndTrialModal', () => ({ EndTrialModal: () => null }))
vi.mock('~/containers/LlamaAI/components/TextSelectionPopup', () => ({ TextSelectionPopup: () => null }))
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

// A first visit: the session clears storage, so the tour has never been seen.
const session = installSubscriberSession('reader', { account: 'subscriber', resolved: true })
let root: Root

function goTo(url: string) {
	const parsed = new URL(url, 'https://defillama.com')
	api.router.asPath = `${parsed.pathname}${parsed.search}`
	api.router.query = Object.fromEntries(parsed.searchParams)
}

async function visit(url: string) {
	goTo(url)
	await act(async () => root.render(<session.Wrapper>{LlamaAIPage.getLayout(<LlamaAIPage />)}</session.Wrapper>))
	await act(async () => new Promise((resolve) => setTimeout(resolve)))
}

async function leave() {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
}

const button = (name: string) =>
	[...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
const deepLinkSheet = () =>
	[...document.querySelectorAll('[role="dialog"]')].some((dialog) => dialog.textContent?.includes('Ask LlamaAI?'))
const tourOpen = () => document.body.textContent?.includes('Welcome to LlamaAI')

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	api.router.replace.mockImplementation(async (url: string) => {
		goTo(url)
		return true
	})
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
		'https://ai.llama.fi/agentic/active/': { active: false, execution: null },
		'https://ai.llama.fi/agentic': () => new Promise<Response>(() => {}),
		'/user/sessions': { sessions: [], hasMore: false }
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

test('a first visit from a link with a question asks about the question and opens no tour', async () => {
	await visit('/ai/chat?prompt=What%20is%20Aave%20TVL%3F')

	await waitForUi(() => expect(deepLinkSheet()).toBe(true))
	expect(tourOpen()).toBe(false)
})

test('a first visit without a question still opens the tour', async () => {
	await visit('/ai/chat')

	await waitForUi(() => expect(tourOpen()).toBe(true))
})

test('asking the linked question leaves the tour for the next visit', async () => {
	await visit('/ai/chat?prompt=What%20is%20Aave%20TVL%3F')
	await waitForUi(() => expect(deepLinkSheet()).toBe(true))
	await act(async () => button('Ask LlamaAI')!.click())
	await waitForUi(() => expect(deepLinkSheet()).toBeFalsy())
	expect(tourOpen()).toBe(false)

	await leave()
	await visit('/ai/chat')
	await waitForUi(() => expect(tourOpen()).toBe(true))
})
