// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getSignupSource } from '~/auth/signupSource'
import { hasPendingPrompt } from '~/containers/LlamaAI/pendingPrompt'
import pb from '~/utils/pocketbase'
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
// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))
import LlamaAIPage from '~/pages/ai/chat/[[...sessionId]]'

const session = installSubscriberSession('reader', { account: 'signed-out', resolved: true })
let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<session.Wrapper>{LlamaAIPage.getLayout(<LlamaAIPage />)}</session.Wrapper>))
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
	sessionStorage.clear()
})

const composer = () =>
	waitForUi(() => {
		const input = document.querySelector<HTMLTextAreaElement>('form textarea')
		expect(input).not.toBeNull()
		return input!
	})
const send = async (question: string) => {
	const textarea = await composer()
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, question)
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => {
		textarea.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
}
const signInDialog = (text: string) =>
	waitForUi(() => {
		const element = document.querySelector<HTMLElement>('[role="dialog"]')
		expect(element).not.toBeNull()
		expect(element!.textContent).toContain(text)
		return element!
	})

test('signed out, the empty chat shows no walkthrough, sending quotes the question in sign-in and keeps it for after sign-in instead of asking the chat, and closing sign-in drops it', async () => {
	await composer()
	expect(document.body.textContent).not.toContain('Welcome to LlamaAI')

	await send('What is Aave TVL?')

	const dialog = await signInDialog('Sign in to ask for free: “What is Aave TVL?”')
	expect(session.urls().some((url) => new URL(url).pathname.startsWith('/agentic'))).toBe(false)
	// The question itself reaching the chat after sign-in is owned by the Research pick test below.
	expect(hasPendingPrompt()).toBe(true)
	expect(getSignupSource()).toBe('llamaai-chat')

	await act(async () => dialog.querySelector<HTMLButtonElement>('button[aria-label="Close dialog"]')!.click())
	expect(hasPendingPrompt()).toBe(false)
})

test('signed out, the chat keeps its sidebar, and history asks for sign-in instead of claiming there are no chats', async () => {
	const history = await waitForUi(() => {
		const nav = document.querySelector('nav[aria-label="Chat history"]')
		expect(nav).not.toBeNull()
		return nav!
	})
	expect(history.textContent).toBe('Sign in to see your chats')
	expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('New chat'))).toBe(true)
})

test('signed out, attaching a file opens sign-in instead of adding an attachment that sign-in would drop', async () => {
	await composer()
	await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Attach file"]')!.click())

	const dialog = await signInDialog('Sign in')
	expect(dialog.textContent).not.toContain('Sign in to ask for free')
	expect(document.querySelector('[aria-label^="Remove "]')).toBeNull()
})

test('a Research pick made while signed out is the mode the question is asked in after sign-in', async () => {
	await composer()
	await act(async () => document.querySelector<HTMLInputElement>('input[type="radio"][value="research"]')!.click())
	await send('Write a report on restaking')
	await signInDialog('Sign in to ask for free: “Write a report on restaking”')

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
		'/subscription/trial-available': { trialAvailable: true },
		'https://ai.llama.fi/agentic': () =>
			new Response('data: {"type":"done"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
	})
	await act(async () => pb.authStore.save(session.token, session.record))

	const body = await waitForUi(() => {
		const post = session.requests.find((call) => call.url.href === 'https://ai.llama.fi/agentic')
		expect(post).toBeDefined()
		return JSON.parse(post!.init!.body as string) as Record<string, unknown>
	})
	expect(body).toMatchObject({ message: 'Write a report on restaking', mode: 'research', entrySource: 'chat' })
})
