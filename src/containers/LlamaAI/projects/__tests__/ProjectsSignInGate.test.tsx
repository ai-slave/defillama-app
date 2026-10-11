// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/ai/projects"}

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ProjectsSignInGate } from '../ProjectsSignInGate'

// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const session = installSubscriberSession('reader', { account: 'signed-out' })
let root: Root
beforeEach(async () => {
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ProjectsSignInGate />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

test('an open sign-in stays after a sign-in from another tab, while the prompt to sign in leaves', async () => {
	const signIn = await waitForUi(() => {
		const button = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Sign in')
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => signIn.click())
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.body.textContent).not.toContain('to access this page'))
	expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in")
})
