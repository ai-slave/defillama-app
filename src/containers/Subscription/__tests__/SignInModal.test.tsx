// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import * as Ariakit from '@ariakit/react'
import { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { SignInModal } from '../SignInModal'

// The Google script and the Turnstile widget cannot load in Node.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const session = installSubscriberSession('u1', { account: 'signed-out' })
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

// The Pro plan card's setup: the sign-in stacks over the plan, and a finished sign-in sends focus to the plan's action.
function PlanWithSignIn() {
	const signIn = Ariakit.useDialogStore({ defaultOpen: true })
	const unlockRef = useRef<HTMLButtonElement>(null)
	return (
		<>
			<button ref={unlockRef} type="button">
				Unlock Pro features
			</button>
			<SignInModal store={signIn} onAuthenticated={() => signIn.setDisclosureElement(unlockRef.current)} />
		</>
	)
}

test('a sign-in from another tab keeps the open sign-in until Continue, which hands focus to the plan', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<PlanWithSignIn />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))
	// The new session's user loads for a moment, as it does after a sign-in elsewhere; the dialog stays through it.
	session.serve({
		'/api/collections/users/auth-refresh': () =>
			new Promise((resolve) => setTimeout(() => resolve({ token: session.token, record: session.record }), 200))
	})
	await act(async () => pb.authStore.save(session.token, session.record as never))
	expect(document.querySelector('[role=dialog]')).not.toBeNull()
	const proceed = await waitForUi(() => {
		expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in")
		return [...document.querySelectorAll('button')].find((button) => button.textContent === 'Continue')!
	})
	await act(async () => proceed.click())
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).toBeNull())
	expect(document.activeElement?.textContent).toBe('Unlock Pro features')
})
