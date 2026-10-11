// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/welcome"}
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
const session = installSubscriberSession('visitor', { account: 'signed-out' })
import Welcome from '~/pages/welcome'

const router = vi.hoisted(() => ({
	isReady: true,
	asPath: '/welcome',
	pathname: '/welcome',
	query: {},
	push: vi.fn(),
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ default: { push: router.push }, useRouter: () => router }))
vi.mock('next/head', () => ({ default: ({ children }: { children: ReactNode }) => children }))
// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

let root: Root
beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Welcome />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

const signInControls = () =>
	[...document.querySelectorAll('button')].filter((el) => /sign in/i.test(accessibleName(el)))

test('signed out, /welcome asks to sign in once, in the page and not again in the header', async () => {
	// The sign-in gate stands in for the page's heading until the reader signs in.
	await waitForUi(() => expect(document.querySelectorAll('main h1')).toHaveLength(1))
	expect(document.body.textContent).not.toContain('activated')
	expect(signInControls().map(accessibleName)).toEqual(['Sign in'])
})

test('the sign-in opened from /welcome stays open after a sign-in from another tab', async () => {
	await waitForUi(() => expect(signInControls()).toHaveLength(1))
	await act(async () => signInControls()[0].click())
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in"))
})
