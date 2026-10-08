// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { sendFromComposer } from './chatComposer'

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
import SharedConversationPage from '~/pages/ai/chat/shared/[shareToken]'

const session = installSubscriberSession('reader', { account: 'signed-out' })
const agenticPrompts = () =>
	session.requests
		.filter((call) => call.url.href === 'https://ai.llama.fi/agentic')
		.map((call) => (JSON.parse(call.init!.body as string) as { message: string }).message)
let root: Root

beforeEach(async () => {
	session.serve({
		'/user/public/shared-token': {
			session: { sessionId: 's1', title: 'Shared', createdAt: '2026-01-01', isPublic: true },
			messages: [],
			isPublicView: true
		},
		// What the chat loads once the reader signs in.
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
	await sendFromComposer('Why did TVL drop?')
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
	// The signed-in chat loads its history once the account arrives, which is when a waiting question goes out.
	await waitForUi(() => expect(session.requests.map((call) => call.url.pathname)).toContain('/user/sessions'))
	expect(agenticPrompts()).toEqual([])
})

test('closing sign-in after signing in from another tab still sends the question', async () => {
	await sendFromComposer('Why did TVL drop?')
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe("You're signed in"))
	await act(async () =>
		document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close dialog"]')!.click()
	)
	await waitForUi(() => expect(agenticPrompts()).toEqual(['Why did TVL drop?']))
})
