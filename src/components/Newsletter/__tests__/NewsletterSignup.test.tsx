import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import pb from '~/utils/pocketbase'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { NewsletterSignup } from '../NewsletterSignup'

const http = installFixtureFetch()
const sessionToken = `e30.${btoa(JSON.stringify({ id: 'reader', exp: 4_102_444_800 }))}.signature`
const reader = {
	id: 'reader',
	email: 'reader@example.com',
	collectionId: '_pb_users_auth_',
	collectionName: 'users',
	verified: true
}
const subscribeRequests = () => http.requests.filter((request) => request.url.pathname === '/newsletter/subscribe')
let client: QueryClient
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	localStorage.clear()
	client = new QueryClient()
	pb.authStore.save(sessionToken, reader)
	http.serve({
		'/api/collections/users/auth-refresh': { token: sessionToken, record: reader },
		'/subscription/status': () => new Response(null, { status: 404 })
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	pb.authStore.clear()
	localStorage.clear()
})

test.each(['card', 'strip'] as const)(
	'%s allows clearing both defaults, then submits only the reselected newsletter',
	async (layout) => {
		const pending = Promise.withResolvers<Response>()
		http.serve({ '/newsletter/subscribe': () => pending.promise })
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<AuthProvider>
						<NewsletterSignup layout={layout} />
					</AuthProvider>
				</QueryClientProvider>
			)
		)
		const choices = [...container.querySelectorAll<HTMLButtonElement>('[role="checkbox"], [role="switch"]')]
		expect(choices).toHaveLength(2)
		expect(choices.map((e) => e.getAttribute('aria-checked'))).toEqual(['true', 'true'])
		expect(subscribeRequests()).toHaveLength(0)
		await act(async () => {
			for (const choice of choices) choice.click()
		})
		const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
		expect(submit.disabled).toBe(true)
		expect(choices.map((e) => e.getAttribute('aria-checked'))).toEqual(['false', 'false'])
		await act(async () => choices[1].click())
		await act(async () => submit.click())
		await vi.waitFor(() => expect(submit.disabled).toBe(true))
		expect(subscribeRequests().map((request) => JSON.parse(request.init!.body as string))).toEqual([
			{ email: 'reader@example.com', newsletters: ['research'] }
		])
		await act(async () => {
			choices[0].click()
			submit.click()
		})
		expect(choices[0].getAttribute('aria-checked')).toBe('false')
		expect(subscribeRequests()).toHaveLength(1)
		await act(async () => pending.resolve(Response.json({ email: 'reader@example.com', result: { research: 'ok' } })))
		await vi.waitFor(() => expect(client.isMutating()).toBe(0))
	}
)
