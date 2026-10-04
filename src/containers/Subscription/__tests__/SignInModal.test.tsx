// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import * as Ariakit from '@ariakit/react'
import { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Dialog, DialogBody, DialogHeader } from '~/ui/Dialog'
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

test.each(['the close button', 'Escape'])(
	'closing the signed-in-elsewhere step with %s finishes the sign-in once',
	async (exit) => {
		const onAuthenticated = vi.fn()
		function SignIn() {
			const store = Ariakit.useDialogStore({ defaultOpen: true })
			return <SignInModal store={store} onAuthenticated={onAuthenticated} />
		}
		await act(async () =>
			root.render(
				<session.Wrapper>
					<SignIn />
				</session.Wrapper>
			)
		)
		await act(async () => pb.authStore.save(session.token, session.record as never))
		await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in"))
		const dialog = document.querySelector<HTMLElement>('[role=dialog]')!
		await act(async () => {
			if (exit === 'Escape')
				dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
			else dialog.querySelector<HTMLButtonElement>('button[aria-label="Close dialog"]')!.click()
		})
		await waitForUi(() => expect(document.querySelector('[role=dialog]')).toBeNull())
		expect(onAuthenticated).toHaveBeenCalledOnce()
	}
)

test('a sign-in stacked over another dialog, whose Sign in button left, hands focus back inside that dialog', async () => {
	// The mobile menu's setup: the account section, with its Sign in button, sits inside an open dialog.
	await act(async () =>
		root.render(
			<session.Wrapper>
				<main>
					<Dialog size="sm" open onClose={() => {}}>
						<DialogHeader title="Menu" />
						<DialogBody>
							<SignInModal text="Sign in" />
						</DialogBody>
					</Dialog>
				</main>
			</session.Wrapper>
		)
	)
	const signIn = await waitForUi(() => {
		const button = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Sign in')
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => {
		signIn.focus()
		signIn.click()
	})
	await waitForUi(() => expect(document.querySelectorAll('[role=dialog]').length).toBe(2))
	// A sign-in from another tab replaces the Sign in button, so closing the sign-in has no trigger to return to.
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() =>
		expect([...document.querySelectorAll('button')].some((el) => el.textContent === 'Sign in')).toBe(false)
	)
	const signInDialog = [...document.querySelectorAll('[role=dialog]')].find(
		(dialog) => dialog.querySelector('h2')?.textContent !== 'Menu'
	)!
	await act(async () => signInDialog.querySelector<HTMLButtonElement>('button[aria-label="Close dialog"]')!.click())
	await waitForUi(() => expect(document.querySelectorAll('[role=dialog]').length).toBe(1))
	await waitForUi(() =>
		expect(document.activeElement).toBe(document.querySelector('[role=dialog] button[aria-label="Close dialog"]'))
	)
})
