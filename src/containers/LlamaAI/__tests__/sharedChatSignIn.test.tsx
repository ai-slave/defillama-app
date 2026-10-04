// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	query: { shareToken: 'shared-token' },
	pathname: '/ai/chat/shared/[shareToken]',
	asPath: '/ai/chat/shared/shared-token',
	isReady: true,
	push: async () => true,
	replace: async () => true,
	prefetch: async () => {},
	events: { on: () => {}, off: () => {} }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))
// The chat is heavy; the stub only forks with a question and shows the prompt the page hands it to send.
vi.mock('~/containers/LlamaAI', () => ({
	AgenticChat: ({
		onForkSubmit,
		initialPrompt
	}: {
		onForkSubmit: (prompt: string) => void
		initialPrompt?: string
	}) => (
		<>
			<button type="button" onClick={() => onForkSubmit('Why did TVL drop?')}>
				Ask
			</button>
			<output>{initialPrompt ?? 'nothing to send'}</output>
		</>
	)
}))
import SharedConversationPage from '~/pages/ai/chat/shared/[shareToken]'

const session = installSubscriberSession('reader', { account: 'signed-out' })
let root: Root

beforeEach(async () => {
	session.serve({
		'/user/public/shared-token': {
			session: { sessionId: 's1', title: 'Shared', createdAt: '2026-01-01', isPublic: true },
			messages: [],
			isPublicView: true
		}
	})
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SharedConversationPage shareToken="shared-token" sessionTitle="Shared" />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

async function askAndCloseSignIn() {
	const ask = await waitForUi(() => {
		const button = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Ask')
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => ask.click())
	const close = await waitForUi(() => {
		const button = document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close dialog"]')
		expect(button).not.toBeNull()
		return button!
	})
	await act(async () => close.click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
}

test('a question abandoned at sign-in is not sent after a later sign-in', async () => {
	await askAndCloseSignIn()
	await act(async () => pb.authStore.save(session.token, session.record as never))
	// Long enough for the account to load, which is when the page hands a waiting question over.
	await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
	expect(document.querySelector('output')?.textContent).toBe('nothing to send')
})

test('closing sign-in after signing in from another tab still sends the question', async () => {
	const ask = await waitForUi(() => {
		const button = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Ask')
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => ask.click())
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe("You're signed in"))
	await act(async () =>
		document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close dialog"]')!.click()
	)
	await waitForUi(() => expect(document.querySelector('output')?.textContent).toBe('Why did TVL drop?'))
})
