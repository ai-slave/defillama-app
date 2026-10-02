// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AuthenticationCard } from '../AuthenticationCard'

// The Cloudflare widget needs its remote script; the test stands in for the visitor completing it.
vi.mock('~/containers/Subscription/Turnstile', () => ({
	Turnstile: function TestTurnstile({ onVerify }: { onVerify: (token: string) => void }) {
		const [complete, setComplete] = useState(false)
		return (
			<button
				type="button"
				onClick={() => {
					setComplete(true)
					onVerify('test-captcha')
				}}
			>
				{complete ? 'CAPTCHA complete' : 'Test CAPTCHA'}
			</button>
		)
	}
}))

const session = installSubscriberSession('user', { account: 'free', resolved: true })
const RESET = `${AUTH_SERVER}/auth/request-password-reset`

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

const dialogText = () => document.querySelector('[role=dialog]')?.textContent ?? ''
const button = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === name)!

async function openAndSend() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AuthenticationCard />
				<Toaster />
			</session.Wrapper>
		)
	)
	await act(async () => button('Change Password').click())
	await waitForUi(() => expect(dialogText()).toContain('Complete the check above'))
	await act(async () => button('Test CAPTCHA').click())
	await act(async () => button('Send reset link').click())
}

test('a failed reset request shows its reason inside the dialog and keeps the send step', async () => {
	session.serve({ [RESET]: fixtureStatus(429, { error: 'rate limited' }) })
	await openAndSend()

	await waitForUi(() =>
		expect(document.querySelector('[role=dialog] [role=alert]')?.textContent).toBe(
			'Too many reset requests. Wait before trying again.'
		)
	)
	expect(dialogText()).toContain("We'll send a password reset link to subscriber@example.com.")
})

test('a sent reset link is confirmed inside the dialog instead of a toast', async () => {
	session.serve({ [RESET]: {} })
	await openAndSend()

	await waitForUi(() => expect(dialogText()).toContain('We sent a password reset link to subscriber@example.com.'))
	expect(document.body.textContent).not.toContain('Password reset email sent')
})

test('the sent step hides the security check until another link is requested, and the cooldown still applies', async () => {
	session.serve({ [RESET]: {} })
	await openAndSend()
	await waitForUi(() => expect(dialogText()).toContain('We sent a password reset link to subscriber@example.com.'))
	expect(dialogText()).not.toContain('Complete the check above')

	await act(async () => button('Send another link').click())
	await waitForUi(() => expect(dialogText()).toContain('Complete the check above'))
	await act(async () => button('Test CAPTCHA').click())
	await act(async () => button('Send reset link').click())
	// The 60-second resend cooldown keeps the form open with its warning instead of claiming a new link.
	await waitForUi(() => expect(dialogText()).toMatch(/Wait \d+s before resending\./))
	expect(dialogText()).not.toContain('We sent a new password reset link')
})

test('a reopened dialog starts from the send step without the last failure', async () => {
	session.serve({ [RESET]: fixtureStatus(429, { error: 'rate limited' }) })
	await openAndSend()
	await waitForUi(() => expect(document.querySelector('[role=dialog] [role=alert]')).not.toBeNull())
	await act(async () => button('Cancel').click())
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).toBeNull())

	await act(async () => button('Change Password').click())
	await waitForUi(() => expect(dialogText()).toContain('Complete the check above'))
	expect(document.querySelector('[role=dialog] [role=alert]')).toBeNull()
})

test('a reopened dialog after a sent link starts on the form, and the resend cooldown still applies', async () => {
	session.serve({ [RESET]: {} })
	await openAndSend()
	await waitForUi(() => expect(dialogText()).toContain('We sent a password reset link to subscriber@example.com.'))
	await act(async () => button('Done').click())
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).toBeNull())

	await act(async () => button('Change Password').click())
	await waitForUi(() => expect(dialogText()).toContain('Complete the check above'))
	expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Change password')
	await act(async () => button('Test CAPTCHA').click())
	await act(async () => button('Send reset link').click())
	await waitForUi(() => expect(dialogText()).toMatch(/Wait \d+s before resending\./))
})

test('Send another link hands focus to the send button that replaces it', async () => {
	session.serve({ [RESET]: {} })
	await openAndSend()
	await waitForUi(() => expect(dialogText()).toContain('We sent a password reset link to subscriber@example.com.'))
	await act(async () => button('Send another link').focus())
	await act(async () => button('Send another link').click())
	await waitForUi(() => expect(document.activeElement).toBe(button('Send reset link')))
})

test('a sent link hands focus from the send button to Done on the step that replaces the form', async () => {
	session.serve({ [RESET]: {} })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AuthenticationCard />
			</session.Wrapper>
		)
	)
	await act(async () => button('Change Password').click())
	await waitForUi(() => expect(dialogText()).toContain('Complete the check above'))
	await act(async () => button('Test CAPTCHA').click())
	await act(async () => {
		button('Send reset link').focus()
		button('Send reset link').click()
	})
	await waitForUi(() => expect(dialogText()).toContain('We sent a password reset link to subscriber@example.com.'))
	expect(document.activeElement).toBe(button('Done'))
})

test('the send button keeps focus when a send spends its security token', async () => {
	session.serve({ [RESET]: fixtureStatus(429, { error: 'rate limited' }) })
	await openAndSend()
	await waitForUi(() => expect(document.querySelector('[role=dialog] [role=alert]')).not.toBeNull())
	const send = button('Send reset link')
	await act(async () => send.focus())
	// No token until the check runs again: the button says so without leaving the tab order.
	expect(send.disabled).toBe(false)
	expect(send.getAttribute('aria-disabled')).toBe('true')
	expect(document.activeElement).toBe(send)
})
