// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { SwitchToEmailModal } from '../SwitchToEmailModal'

const token = (id: string) => `e30.${btoa(JSON.stringify({ id, exp: 4_102_444_800 }))}.signature`
const record = (id: string) => ({ id, collectionId: '_pb_users_auth_', collectionName: 'users' })

let root: Root
let client: QueryClient
let container: HTMLDivElement
let confirmCalls: Array<{ authorization: string | null; resolve: (response: Response) => void }>
/** Replies for the next code requests, in order; an empty queue answers 200 at once. */
let codeReplies: Array<Promise<Response>>
const codeSent = () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
	confirmCalls = []
	codeReplies = []
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string | URL, config?: RequestInit) => {
			if (String(url) === `${AUTH_SERVER}/switch-to-email/request`) {
				return codeReplies.shift() ?? Promise.resolve(codeSent())
			}
			if (String(url) === `${AUTH_SERVER}/switch-to-email/confirm`) {
				return new Promise<Response>((resolve) => {
					confirmCalls.push({ authorization: new Headers(config?.headers).get('Authorization'), resolve })
				})
			}
			throw new Error(`Unexpected fetch in test: ${url}`)
		})
	)
	client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.unstubAllGlobals()
	vi.useRealTimers()
	pb.authStore.clear()
	localStorage.clear()
})

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

function setInput(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
	setter.call(input, value)
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

function submitForm(element: Element) {
	const form = element.closest('form') ?? element.querySelector('form')
	form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

async function renderModalAtCodeStep() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<SwitchToEmailModal isOpen onClose={() => {}} />
			</QueryClientProvider>
		)
	)

	const emailInput = document.querySelector<HTMLInputElement>('input[type="email"]')!
	expect(emailInput).not.toBeNull()
	await act(async () => setInput(emailInput, 'new.email@example.com'))
	await act(async () => submitForm(emailInput))
	await settle()
}

async function renderModalAtConfirmStep() {
	await renderModalAtCodeStep()
	const otpInput = document.querySelector<HTMLInputElement>('input[placeholder="000000"]')!
	expect(otpInput).not.toBeNull()
	const passwordInput = document.querySelector<HTMLInputElement>('input[placeholder="At least 8 characters"]')!
	const passwordConfirmInput = document.querySelector<HTMLInputElement>('input[placeholder="Re-enter your password"]')!
	await act(async () => {
		setInput(otpInput, '123456')
		setInput(passwordInput, 'password123')
		setInput(passwordConfirmInput, 'password123')
	})
	await act(async () => submitForm(otpInput))
	await settle()
}

test('saves the switched session while it is still the current one', async () => {
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtConfirmStep()

	expect(confirmCalls).toHaveLength(1)
	expect(confirmCalls[0].authorization).toBe(`Bearer ${token('wallet-user')}`)
	confirmCalls[0].resolve(
		new Response(JSON.stringify({ token: token('switched-user') }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		})
	)
	await settle()

	expect(pb.authStore.token).toBe(token('switched-user'))
	expect(document.body.textContent).toContain('Switch successful')
})

test('does not overwrite a newer session with a late confirmation', async () => {
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtConfirmStep()

	expect(confirmCalls).toHaveLength(1)
	// The user signed into another account while the confirmation was pending.
	await act(async () => pb.authStore.save(token('account-b'), record('account-b')))
	confirmCalls[0].resolve(
		new Response(JSON.stringify({ token: token('switched-user') }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		})
	)
	await settle()

	expect(pb.authStore.token).toBe(token('account-b'))
	expect(pb.authStore.record?.id).toBe('account-b')
})

const button = (label: string) =>
	[...document.querySelectorAll('button')].find((element) => accessibleName(element) === label)

test('resending the code labels only the resend as pending and confirms the new code inline', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtCodeStep()
	// The countdown starts with the first code, even though the code step mounts after it was sent.
	expect(button('Resend code (60s)')!.getAttribute('aria-disabled')).toBe('true')
	await act(async () => vi.advanceTimersByTime(60_000))

	const resend = Promise.withResolvers<Response>()
	codeReplies.push(resend.promise)
	await act(async () => button('Resend code')!.click())
	await settle()

	expect(button('Sending code…')).toBeDefined()
	expect(button('Complete switch')).toBeDefined()
	await act(async () => resend.resolve(codeSent()))
	await settle()

	expect(document.querySelector('[role=dialog] [role=status]')?.textContent).toBe('Code sent. Check your inbox.')
	expect(button('Resend code (60s)')!.getAttribute('aria-disabled')).toBe('true')
})

test('the resend button keeps focus through the countdown its sent code starts', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtCodeStep()
	await act(async () => vi.advanceTimersByTime(60_000))
	const resend = button('Resend code')!
	await act(async () => resend.focus())
	await act(async () => resend.click())
	await settle()

	expect(accessibleName(resend)).toBe('Resend code (60s)')
	// happy-dom keeps focus on a natively disabled button, so the contract is that the button never becomes one.
	expect(resend.disabled).toBe(false)
	expect(document.activeElement).toBe(resend)
})

test('the code step opens on its verification code field', async () => {
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtCodeStep()
	expect(document.activeElement).toBe(document.querySelector('input[placeholder="000000"]'))
})

test('a failed code request shows its reason inside the dialog', async () => {
	codeReplies.push(Promise.resolve(Response.json({ error: 'Email already in use' }, { status: 409 })))
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtCodeStep()

	expect(document.querySelector('[role=dialog] [role=alert]')?.textContent).toBe('Email already in use')
	expect(document.querySelector('input[type="email"]')).not.toBeNull()
})

test('mismatched passwords are reported under the confirmation field without sending the switch', async () => {
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtCodeStep()
	const password = document.querySelector<HTMLInputElement>('input[placeholder="At least 8 characters"]')!
	const confirm = document.querySelector<HTMLInputElement>('input[placeholder="Re-enter your password"]')!
	await act(async () => {
		setInput(document.querySelector<HTMLInputElement>('input[placeholder="000000"]')!, '123456')
		setInput(password, 'password123')
		setInput(confirm, 'password124')
	})
	await act(async () => submitForm(confirm))

	expect(document.getElementById(confirm.getAttribute('aria-describedby')!)?.textContent).toBe(
		'Passwords do not match.'
	)
	expect(confirm.getAttribute('aria-invalid')).toBe('true')
	expect(password.hasAttribute('aria-invalid')).toBe(false)
	expect(confirmCalls).toHaveLength(0)
})

const confirmFields = () =>
	[
		'input[placeholder="000000"]',
		'input[placeholder="At least 8 characters"]',
		'input[placeholder="Re-enter your password"]'
	].map((selector) => document.querySelector<HTMLInputElement>(selector)!)

test('a general switch failure shows at the end of the form and leaves every field valid', async () => {
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtConfirmStep()
	confirmCalls[0].resolve(Response.json({ error: 'Failed to switch authentication method' }, { status: 500 }))
	await settle()

	expect(document.querySelector('[role=dialog] [role=alert]')?.textContent).toBe(
		'Failed to switch authentication method'
	)
	expect(confirmFields().map((input) => input.getAttribute('aria-invalid'))).toEqual([null, null, null])
})

test('a rejected code is reported under the code field only', async () => {
	pb.authStore.save(token('wallet-user'), record('wallet-user'))
	await renderModalAtConfirmStep()
	confirmCalls[0].resolve(Response.json({ error: 'Invalid or expired OTP' }, { status: 400 }))
	await settle()

	const [code, password, confirm] = confirmFields()
	expect(document.getElementById(code.getAttribute('aria-describedby')!)?.textContent).toBe('Invalid or expired OTP')
	expect([code, password, confirm].map((input) => input.getAttribute('aria-invalid'))).toEqual(['true', null, null])
})

test('the email step opens on its email field', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<SwitchToEmailModal isOpen onClose={() => {}} />
			</QueryClientProvider>
		)
	)
	await settle()
	expect(document.activeElement).toBe(document.querySelector('input[type="email"]'))
})
