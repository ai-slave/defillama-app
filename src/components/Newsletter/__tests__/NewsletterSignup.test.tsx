import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '~/auth'
import pb from '~/utils/pocketbase'
import { fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
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

async function render(layout: 'card' | 'strip') {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<NewsletterSignup layout={layout} />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
}

async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test.each(['card', 'strip'] as const)(
	'%s refuses a submit with no newsletter, then submits only the reselected one',
	async (layout) => {
		const pending = Promise.withResolvers<Response>()
		http.serve({ '/newsletter/subscribe': () => pending.promise })
		await render(layout)
		const choices = [...container.querySelectorAll<HTMLButtonElement>('[role="checkbox"], [role="switch"]')]
		expect(choices).toHaveLength(2)
		expect(choices.map((e) => e.getAttribute('aria-checked'))).toEqual(['true', 'true'])
		await act(async () => {
			for (const choice of choices) choice.click()
		})
		const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
		expect(submit.getAttribute('aria-disabled')).toBeNull()
		expect(fieldErrorTexts(container)).toEqual([])
		await act(async () => submit.click())
		expect(fieldErrorTexts(container)).toEqual(['Choose at least one newsletter.'])
		expect(document.activeElement).toBe(choices[0])
		expect(subscribeRequests()).toHaveLength(0)
		await act(async () => choices[1].click())
		expect(fieldErrorTexts(container)).toEqual([])
		await act(async () => submit.click())
		await waitForUi(() => expect(submit.getAttribute('aria-disabled')).toBe('true'))
		expect(submit.disabled).toBe(false)
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
		await waitForUi(() => expect(client.isMutating()).toBe(0))
	}
)

test.each(['card', 'strip'] as const)(
	'%s says what is wrong with the email under its field and focuses it',
	async (layout) => {
		await render(layout)
		const email = container.querySelector<HTMLInputElement>('input[type="email"]')!
		const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
		await type(email, '')
		expect(fieldErrorTexts(container)).toEqual([])
		await act(async () => submit.click())
		expect(fieldErrorTexts(container)).toEqual(['Enter an email address.'])
		expect(document.activeElement).toBe(email)
		expect(email.getAttribute('aria-invalid')).toBe('true')
		await type(email, 'reader@example')
		expect(fieldErrorTexts(container)).toEqual(['Enter a valid email address.'])
		await type(email, 'reader@example.com')
		expect(fieldErrorTexts(container)).toEqual([])
		expect(email.getAttribute('aria-invalid')).toBeNull()
		expect(subscribeRequests()).toHaveLength(0)
	}
)
