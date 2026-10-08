// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { consumePendingPrompt } from '~/containers/LlamaAI/pendingPrompt'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const api = vi.hoisted(() => ({
	router: {
		query: {} as Record<string, string | Array<string>>,
		pathname: '/ai',
		asPath: '/ai',
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
import LlamaAIGetStarted from '~/pages/ai'

const session = installSubscriberSession('reader', { account: 'signed-out', resolved: true })
let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<LlamaAIGetStarted />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
	sessionStorage.clear()
	api.router.push.mockClear()
})

const dialogText = () =>
	waitForUi(() => {
		const dialog = document.querySelector('[role="dialog"]')
		expect(dialog).not.toBeNull()
		return dialog!.textContent
	})

test('signed out, asking your own question on /ai keeps it for after sign-in and quotes it in the sign-in dialog', async () => {
	const input = await waitForUi(() => {
		const el = document.querySelector<HTMLInputElement>('input[name="freeform"]')
		expect(el).not.toBeNull()
		return el!
	})
	input.value = 'Which chains grew the most this month?'
	await act(async () => {
		input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})

	expect(await dialogText()).toContain('Sign in to ask for free: “Which chains grew the most this month?”')
	expect(consumePendingPrompt()).toBe('Which chains grew the most this month?')
})

async function askSignedOut(question: string) {
	const input = await waitForUi(() => {
		const el = document.querySelector<HTMLInputElement>('input[name="freeform"]')
		expect(el).not.toBeNull()
		return el!
	})
	input.value = question
	await act(async () => {
		input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	await dialogText()
}
const closeSignIn = () =>
	act(async () =>
		document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close dialog"]')!.click()
	)

test('closing the sign-in after signing in from another tab still sends the waiting question to the chat', async () => {
	await askSignedOut('Which chains grew the most this month?')
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe("You're signed in"))
	await closeSignIn()
	expect(api.router.push).toHaveBeenCalledWith('/ai/chat')
	expect(consumePendingPrompt()).toBe('Which chains grew the most this month?')
})

test('closing the sign-in without signing in drops the waiting question', async () => {
	await askSignedOut('Which chains grew the most this month?')
	await closeSignIn()
	expect(api.router.push).not.toHaveBeenCalled()
	expect(consumePendingPrompt()).toBeNull()
})

test('signing in as a subscriber hides the free questions, and closing the sign-in still sends the waiting question', async () => {
	session.serve({
		'/subscription/status': { subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } }
	})
	await askSignedOut('Which chains grew the most this month?')
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.getElementById('free-questions')).toBeNull())
	await waitForUi(() => expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe("You're signed in"))
	await closeSignIn()
	expect(api.router.push).toHaveBeenCalledWith('/ai/chat')
	expect(consumePendingPrompt()).toBe('Which chains grew the most this month?')
})
