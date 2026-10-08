// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Account } from '../Account'

// The Google script and the Turnstile widget cannot load in Node.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const session = installSubscriberSession('u1')
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const tryAgain = () => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Try again')

test('a slow subscription retry keeps focus on its button, then hands it to the account link once it succeeds', async () => {
	// The provider loads the status more than once while signing in, so it fails until the reader retries.
	let failing = true
	session.serve({
		'/subscription/status': () =>
			failing
				? fixtureStatus(500, { message: 'down' })()
				: // The retry takes a moment, so the test sees the button while it waits.
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve(Response.json({ subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } })),
							200
						)
					)
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Account />
			</session.Wrapper>
		)
	)
	const retry = await waitForUi(() => {
		expect(tryAgain()).toBeDefined()
		return tryAgain()!
	})
	failing = false
	await act(async () => {
		retry.focus()
		retry.click()
	})
	await waitForUi(() => expect(retry.getAttribute('aria-busy')).toBe('true'))
	expect(retry.getAttribute('aria-disabled')).toBe('true')
	// Browsers drop focus from a natively disabled button; happy-dom does not, so assert the cause.
	expect(retry.disabled).toBe(false)
	await waitForUi(() => expect(document.body.textContent).toContain('Active Subscription'))
	expect(tryAgain()).toBeUndefined()
	expect(document.activeElement?.getAttribute('href')).toBe('/account')
})

test('a sign-in from another tab keeps the open sign-in through loading, and closing it hands focus to the page content', async () => {
	await act(async () => pb.authStore.clear())
	await act(async () =>
		root.render(
			<session.Wrapper>
				<main>
					<Account />
				</main>
			</session.Wrapper>
		)
	)
	const signIn = await waitForUi(() => {
		const button = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Sign In / Subscribe')
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => {
		signIn.focus()
		signIn.click()
	})
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))

	// The new session's user loads for a moment, so the sidebar shows its loading state under the open dialog.
	session.serve({
		'/api/collections/users/auth-refresh': () =>
			new Promise((resolve) => setTimeout(() => resolve({ token: session.token, record: session.record }), 200))
	})
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in"))
	await waitForUi(() => expect(container.textContent).toContain('Active Subscription'))
	// The Sign In / Subscribe button that opened it is gone, so the close button has nothing to return focus to.
	await act(async () =>
		document.querySelector<HTMLButtonElement>('[role=dialog] button[aria-label="Close dialog"]')!.click()
	)
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).toBeNull())
	expect(document.activeElement?.tagName).toBe('MAIN')
})
