// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuthContext } from '~/auth'
import pb from '~/utils/pocketbase'

const token = (id: string) => `e30.${btoa(JSON.stringify({ id, exp: 4102444800 }))}.signature`
const record = (id: string) => ({ id, collectionId: '_pb_users_auth_', collectionName: 'users' })

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let sessionView: ReturnType<typeof useAuthContext>
function Probe() {
	sessionView = useAuthContext()
	return null
}

let root: Root
let client: QueryClient
let container: HTMLDivElement
let refreshCalls: { authorization: string | null; resolve: (response: Response) => void }[]

beforeEach(() => {
	refreshCalls = []
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string | URL, config?: RequestInit) => {
			if (String(url).endsWith('/subscription/status')) {
				return jsonResponse({ message: 'No active subscription' }, 404)
			}
			if (!String(url).endsWith('/api/collections/users/auth-refresh')) {
				throw new Error(`Unexpected fetch in test: ${url}`)
			}
			return new Promise<Response>((resolve) => {
				refreshCalls.push({ authorization: new Headers(config?.headers).get('Authorization'), resolve })
			})
		})
	)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<Probe />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

it('fills a token-only session from the refresh and keeps it signed in', async () => {
	pb.authStore.save(token('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	expect(refreshCalls[0].authorization).toBe(token('account-a'))
	refreshCalls[0].resolve(jsonResponse({ token: token('rotated-a'), record: record('account-a') }))
	await settle()

	expect(pb.authStore.token).toBe(token('rotated-a'))
	expect(sessionView.isAuthenticated).toBe(true)
	expect(sessionView.user?.id).toBe('account-a')
})

it('stays signed out when a refresh resolves after logout', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	await act(async () => sessionView.logout())
	expect(sessionView.isAuthenticated).toBe(false)

	refreshCalls[0].resolve(jsonResponse({ token: token('rotated-a'), record: record('account-a') }))
	await settle()

	expect(pb.authStore.isValid).toBe(false)
	expect(sessionView.isAuthenticated).toBe(false)
	expect(sessionView.user).toBeNull()
})

it('keeps the newer session when an older refresh resolves late', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	await act(async () => pb.authStore.save(token('account-b'), record('account-b')))
	await settle()
	expect(refreshCalls).toHaveLength(2)
	expect(refreshCalls[1].authorization).toBe(token('account-b'))

	refreshCalls[1].resolve(jsonResponse({ token: token('rotated-b'), record: record('account-b') }))
	await settle()
	expect(pb.authStore.token).toBe(token('rotated-b'))

	refreshCalls[0].resolve(jsonResponse({ token: token('rotated-a'), record: record('account-a') }))
	await settle()

	expect(pb.authStore.token).toBe(token('rotated-b'))
	expect(sessionView.user?.id).toBe('account-b')
})

it('keeps the newer session when an older refresh fails with 401', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	await act(async () => pb.authStore.save(token('account-b'), record('account-b')))
	await settle()
	expect(refreshCalls).toHaveLength(2)

	refreshCalls[1].resolve(jsonResponse({ token: token('rotated-b'), record: record('account-b') }))
	await settle()

	refreshCalls[0].resolve(
		jsonResponse({ code: 401, message: 'The request requires valid record authorization token.' }, 401)
	)
	await settle()

	expect(pb.authStore.token).toBe(token('rotated-b'))
	expect(pb.authStore.isValid).toBe(true)
	expect(sessionView.isAuthenticated).toBe(true)
	expect(sessionView.user?.id).toBe('account-b')
})

it('clears the session when its own refresh fails with 401', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	refreshCalls[0].resolve(
		jsonResponse({ code: 401, message: 'The request requires valid record authorization token.' }, 401)
	)
	await settle()

	expect(pb.authStore.isValid).toBe(false)
	expect(sessionView.isAuthenticated).toBe(false)
})
