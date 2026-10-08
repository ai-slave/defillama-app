// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '~/auth'
import { GoogleLinkForm } from '~/auth/GoogleLinkForm'
import { createSignInFlowStore, type GoogleLinkChallenge } from '~/auth/signInFlowStore'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'

const http = installFixtureFetch()
const LINK_CONFIRM = `${AUTH_SERVER}/auth/social-link/confirm`
const challenge: GoogleLinkChallenge = {
	challengeToken: 'challenge',
	expiresAt: '2100-01-01T00:00:00.000Z',
	resendAfter: '2100-01-01T00:00:00.000Z',
	kind: 'link_verification_required'
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	localStorage.clear()
	pb.authStore.clear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function Harness({ store }: { store: ReturnType<typeof createSignInFlowStore> }) {
	const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
	return <GoogleLinkForm challenge={challenge} error={state.error?.message} store={store} onVerified={() => {}} />
}

async function render() {
	const store = createSignInFlowStore()
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<AuthProvider>
					<Harness store={store} />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
}

const code = () => container.querySelector<HTMLInputElement>('input[name="code"]')!
const errorOfCode = () => document.getElementById(code().getAttribute('aria-describedby') ?? '')?.textContent ?? null
const alertText = () => container.querySelector('[role="alert"]')?.textContent ?? null

async function type(value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(code(), value)
		code().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function verify() {
	const button = [...container.querySelectorAll('button')].find((el) => el.textContent === 'Verify account')!
	await act(async () => button.click())
}

test('a code the server refuses says so under the field, takes focus and clears on the next edit', async () => {
	http.serve({ [LINK_CONFIRM]: fixtureStatus(400, { error: 'The verification challenge is invalid or expired' }) })
	await render()
	await type('123456')
	await verify()
	await waitForUi(() => expect(errorOfCode()).toBe('This code is wrong or has expired.'))
	expect(code().getAttribute('aria-invalid')).toBe('true')
	expect(document.activeElement).toBe(code())
	expect(alertText()).toBeNull()
	await type('654321')
	expect(errorOfCode()).toBeNull()
})

test('a server failure stays a request error and leaves the code unmarked', async () => {
	http.serve({ [LINK_CONFIRM]: fixtureStatus(500, { error: 'Failed to confirm verification code' }) })
	await render()
	await type('123456')
	await verify()
	await waitForUi(() => expect(alertText()).toBe('Failed to confirm verification code'))
	expect(code().getAttribute('aria-invalid')).toBeNull()
	expect(errorOfCode()).toBeNull()
})
