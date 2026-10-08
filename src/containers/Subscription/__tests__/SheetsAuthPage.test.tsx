// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/sheets/auth"}

import { QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import SheetsAuthPage from '~/pages/sheets/auth'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({ default: { push: vi.fn() }, useRouter: () => ({ query: {} }) }))
// Google Identity Services cannot load in Node.
vi.mock('next/script', () => ({ default: () => null }))
// The Cloudflare widget cannot run in Node; clicking stands in for solving it.
vi.mock('@marsidev/react-turnstile', () => ({
	Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
		<button type="button" onClick={() => onSuccess('test-captcha')}>
			Test CAPTCHA
		</button>
	)
}))

const session = installSubscriberSession('sheets-user', { account: 'signed-out' })
const logins = () => session.requests.filter((request) => request.url.href === 'https://features.llama.fi/auth/login')

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.serve({
		'https://features.llama.fi/auth/login': { token: session.token, record: session.record },
		'/subscription/trial-available': { trialAvailable: false }
	})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const button = (name: string) =>
	Array.from(container.querySelectorAll('button')).find(
		(element) => element.textContent === name || element.getAttribute('aria-label') === name
	)

async function renderPage() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={session.client}>
				<SheetsAuthPage />
			</QueryClientProvider>
		)
	)
	await waitForUi(() => expect(container.querySelector('form')).not.toBeNull())
}

async function signIn() {
	await typeInto(container.querySelector<HTMLInputElement>('input[name="email"]')!, 'subscriber@example.com')
	await typeInto(container.querySelector<HTMLInputElement>('input[name="password"]')!, 'correct horse battery staple')
	await act(async () => button('Test CAPTCHA')!.click())
	await act(async () =>
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await waitForUi(() => expect(container.textContent).toContain('Successfully logged in.'))
}

// The sign-in fields are controlled, so a value reaches the form through an input event.
async function typeInto(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('offers no close button on the page, so the inline form keeps sending sign-ins', async () => {
	await renderPage()
	expect(button('Close dialog')).toBeUndefined()
	await signIn()
	expect(logins()).toHaveLength(1)
})

test('sends a sign-in from the form shown again after signing out', async () => {
	await renderPage()
	await signIn()
	await act(async () => button('Sign out')!.click())
	await waitForUi(() => expect(container.querySelector('form')).not.toBeNull())
	await signIn()
	expect(logins()).toHaveLength(2)
})
