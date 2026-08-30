// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/account"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { DeleteAccountCard } from './DeleteAccountCard'

const auth = vi.hoisted(() => ({
	authToken: 'session-a',
	user: { id: 'account-a', email: 'a@example.com' },
	logout: vi.fn()
}))
const router = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('~/auth', () => ({ useAuthContext: () => auth }))
vi.mock('next/router', () => ({ useRouter: () => router }))

const typedConfirmation = { text: 'DELETE', type: 'typed_confirmation' as const }
const otpConfirmation = { text: 'DELETE', type: 'otp' as const }
const appleConfirmation = { text: 'DELETE', type: 'apple_reauth' as const }

const eligibility = {
	blockers: [],
	canDelete: true,
	requiredConfirmation: typedConfirmation,
	warnings: []
}

const json = (body: unknown, status = 200) =>
	Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

let root: Root
let container: HTMLDivElement
let client: QueryClient
let eligibilityResponse: () => Promise<Response>
let requestResponse: () => Promise<Response>
let deleteResponse: () => Promise<Response>
let calls: Array<{ body: unknown; method: string; token: string | null; url: string }>

beforeEach(() => {
	auth.authToken = 'session-a'
	auth.user = { id: 'account-a', email: 'a@example.com' }
	auth.logout.mockReset()
	router.replace.mockReset()
	pb.authStore.save('session-a', { id: 'account-a', collectionId: '_pb_users_auth_', collectionName: 'users' })
	eligibilityResponse = () => json(eligibility)
	requestResponse = () =>
		json({ message: 'Account deletion confirmation ready', requiredConfirmation: typedConfirmation })
	deleteResponse = () => json({ status: 'completed', deletedAt: '2026-08-30T00:00:00.000Z' })
	calls = []

	vi.stubGlobal(
		'fetch',
		vi.fn((url: string | URL, options: RequestInit = {}) => {
			const stringUrl = String(url)
			calls.push({
				body: typeof options.body === 'string' ? JSON.parse(options.body) : null,
				method: options.method ?? 'GET',
				token: new Headers(options.headers).get('Authorization'),
				url: stringUrl
			})
			if (stringUrl === `${AUTH_SERVER}/user/delete-account/eligibility`) return eligibilityResponse()
			if (stringUrl === `${AUTH_SERVER}/user/delete-account/request`) return requestResponse()
			if (stringUrl === `${AUTH_SERVER}/user/delete-account`) return deleteResponse()
			throw new Error(`Unexpected fetch in test: ${stringUrl}`)
		})
	)

	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
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

async function waitFor(assertion: () => void) {
	await vi.waitFor(async () => {
		await act(async () => {})
		assertion()
	})
}

function button(label: string) {
	return [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === label)
}

function setInput(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
	setter.call(input, value)
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function openDialog() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DeleteAccountCard />
			</QueryClientProvider>
		)
	)
	await act(async () => button('Delete Account')!.click())
	await waitFor(() => expect(document.body.textContent).toContain('This permanently deletes your DefiLlama account'))
}

async function continueToConfirmation() {
	await act(async () => button('Continue')!.click())
	await waitFor(() => expect(document.querySelector<HTMLInputElement>('#delete-account-confirmation')).not.toBeNull())
}

it('deletes a typed-confirmation account with the session that opened the flow', async () => {
	await openDialog()
	await continueToConfirmation()

	const confirmationInput = document.querySelector<HTMLInputElement>('#delete-account-confirmation')!
	await act(async () => setInput(confirmationInput, 'DELETE'))
	await act(async () =>
		confirmationInput.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await waitFor(() => expect(auth.logout).toHaveBeenCalledOnce())

	expect(calls).toEqual([
		{ body: null, method: 'GET', token: 'Bearer session-a', url: `${AUTH_SERVER}/user/delete-account/eligibility` },
		{ body: null, method: 'POST', token: 'Bearer session-a', url: `${AUTH_SERVER}/user/delete-account/request` },
		{
			body: { confirmation: 'DELETE' },
			method: 'POST',
			token: 'Bearer session-a',
			url: `${AUTH_SERVER}/user/delete-account`
		}
	])
	expect(router.replace).toHaveBeenCalledWith('/')
})

it('requires the email code and sends it with the final deletion request', async () => {
	eligibilityResponse = () => json({ ...eligibility, requiredConfirmation: otpConfirmation })
	requestResponse = () => json({ message: 'Deletion code sent', requiredConfirmation: otpConfirmation })
	await openDialog()
	await continueToConfirmation()

	const otpInput = document.querySelector<HTMLInputElement>('#delete-account-otp')!
	const confirmationInput = document.querySelector<HTMLInputElement>('#delete-account-confirmation')!
	await act(async () => {
		setInput(otpInput, '123456')
		setInput(confirmationInput, 'DELETE')
	})
	await act(async () =>
		confirmationInput.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await waitFor(() => expect(auth.logout).toHaveBeenCalledOnce())

	expect(calls.at(-1)?.body).toEqual({ confirmation: 'DELETE', otp: '123456' })
})

it('shows team blockers without starting the destructive flow', async () => {
	eligibilityResponse = () =>
		json({
			...eligibility,
			blockers: [
				{
					code: 'sole_team_admin',
					message: 'Transfer team ownership or cancel the team subscription before deleting this account.'
				}
			],
			canDelete: false
		})
	await openDialog()

	expect(document.body.textContent).toContain('Transfer team ownership or cancel the team subscription')
	expect(button('Continue')).toBeUndefined()
	expect(calls).toHaveLength(1)
})

it('directs Apple reauthentication to the mobile app', async () => {
	eligibilityResponse = () => json({ ...eligibility, requiredConfirmation: appleConfirmation })
	await openDialog()

	expect(document.body.textContent).toContain('Open the DefiLlama mobile app and reauthenticate with Apple')
	expect(button('Continue')).toBeUndefined()
	expect(calls).toHaveLength(1)
})

it('keeps the user signed in when deletion fails', async () => {
	deleteResponse = () => json({ error: 'Failed to remove external subscriptions' }, 500)
	await openDialog()
	await continueToConfirmation()

	const confirmationInput = document.querySelector<HTMLInputElement>('#delete-account-confirmation')!
	await act(async () => setInput(confirmationInput, 'DELETE'))
	await act(async () =>
		confirmationInput.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await waitFor(() => expect(document.body.textContent).toContain('Failed to remove external subscriptions'))

	expect(auth.logout).not.toHaveBeenCalled()
	expect(router.replace).not.toHaveBeenCalled()
})

it('does not delete through a dialog that belongs to an older session', async () => {
	await openDialog()
	await continueToConfirmation()

	pb.authStore.save('session-b', { id: 'account-b', collectionId: '_pb_users_auth_', collectionName: 'users' })
	const confirmationInput = document.querySelector<HTMLInputElement>('#delete-account-confirmation')!
	await act(async () => setInput(confirmationInput, 'DELETE'))
	await act(async () =>
		confirmationInput.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await settle()

	expect(document.body.textContent).toContain('Your session changed')
	expect(calls.filter((call) => call.url === `${AUTH_SERVER}/user/delete-account`)).toHaveLength(0)
	expect(auth.logout).not.toHaveBeenCalled()
})
