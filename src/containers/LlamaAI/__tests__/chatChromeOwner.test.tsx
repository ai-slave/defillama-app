// @vitest-environment happy-dom
// @vitest-environment-options {"url":"http://localhost/ai/chat"}
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setTerminalViewOpen } from '~/containers/LlamaAI/terminal/terminalViewStore'
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

const session = installSubscriberSession('reader', { resolved: true })
let root: Root

// Wide enough for the desktop chat, too narrow to keep the site menu beside an open terminal.
const setViewport = (width: number) =>
	(
		window as unknown as { happyDOM: { setViewport: (size: { width: number; height: number }) => void } }
	).happyDOM.setViewport({ width, height: 900 })
const siteNavHidden = () => document.documentElement.getAttribute('data-llamaai-fullscreen') === 'true'

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	document.cookie = 'llamaai-sidebar-hidden=; max-age=0; path=/'
	document.cookie = 'llamaai-fullscreen=; max-age=0; path=/'
	setViewport(1300)
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
		'/user/sessions': { sessions: [], hasMore: false },
		'https://ai.llama.fi/projects/usage': { limits: { projects: 10 } },
		'https://ai.llama.fi/projects': { projects: [] },
		'/subscription/trial-available': { trialAvailable: false }
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<session.Wrapper>{LlamaAIPage.getLayout(<LlamaAIPage />)}</session.Wrapper>))
})
afterEach(async () => {
	await act(async () => root.unmount())
	setTerminalViewOpen(false)
	document.body.innerHTML = ''
})

test('signed in, fullscreen chosen in the chat stays on after the terminal locks and releases it', async () => {
	const enter = await waitForUi(() => {
		const button = document.querySelector<HTMLButtonElement>('button[data-umami-event="llamaai-fullscreen-toggle"]')
		expect(button).not.toBeNull()
		return button!
	})
	await act(async () => enter.click())
	expect(siteNavHidden()).toBe(true)

	await act(async () => setTerminalViewOpen(true))
	await act(async () => setTerminalViewOpen(false))

	expect(siteNavHidden()).toBe(true)
})
