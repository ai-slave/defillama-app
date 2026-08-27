// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { SwitchToEmailModal } from './SwitchToEmailModal'

const token = (id: string) => `e30.${btoa(JSON.stringify({ id, exp: 4102444800 }))}.signature`
const record = (id: string) => ({ id, collectionId: '_pb_users_auth_', collectionName: 'users' })

let root: Root
let client: QueryClient
let container: HTMLDivElement
let confirmCalls: { authorization: string | null; resolve: (response: Response) => void }[]

beforeEach(() => {
	confirmCalls = []
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string | URL, config?: RequestInit) => {
			if (String(url) === `${AUTH_SERVER}/switch-to-email/request`) {
				return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
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

async function renderModalAtConfirmStep() {
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

it('saves the switched session while it is still the current one', async () => {
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
	expect(document.body.textContent).toContain('Switch Successful!')
})

it('does not overwrite a newer session with a late confirmation', async () => {
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
