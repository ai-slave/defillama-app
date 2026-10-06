// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/liquidations/sky/arbitrum-one"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import pb from '~/utils/pocketbase'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LiquidationsChainRouteContent } from '../RouteContent'

vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/liquidations/sky/arbitrum-one', pathname: '/liquidations', query: {}, push() {} })
}))
// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const http = installFixtureFetch()
const shell = {
	protocolName: 'Sky',
	protocolSlug: 'sky',
	chainName: 'Arbitrum One',
	chainSlug: 'arbitrum',
	protocolLinks: [
		{ label: 'Overview', to: '/liquidations' },
		{ label: 'Sky', to: '/liquidations/sky' }
	],
	chainLinks: [
		{ label: 'All Chains', to: '/liquidations/sky' },
		{ label: 'Base', to: '/liquidations/sky/base' },
		{ label: 'Arbitrum One', to: '/liquidations/sky/arbitrum-one' }
	]
}

let root: Root
let client: QueryClient
let container: HTMLDivElement

beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	pb.authStore.clear()
	localStorage.clear()
})

function signIn(subscription: 'active' | 'none') {
	const token = `e30.${btoa(JSON.stringify({ id: 'user-1', exp: 4_102_444_800 }))}.signature`
	const record = { id: 'user-1', collectionId: '_pb_users_auth_', collectionName: 'users', verified: true }
	pb.authStore.save(token, record)
	http.serve({
		'/api/collections/users/auth-refresh': { token, record },
		'/subscription/status':
			subscription === 'active'
				? { subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } }
				: fixtureStatus(404, { message: 'No active subscription' })
	})
}

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<LiquidationsChainRouteContent shell={shell} />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
}

const text = () => container.textContent ?? ''
const waitForText = (value: string) =>
	waitForUi(async () => {
		await act(async () => {})
		expect(text()).toContain(value)
	})

test('shows a signed-out visitor the gate without a checkout link', async () => {
	await render()

	expect(text()).toContain('An active subscription is required to view liquidations data.')
	expect(container.querySelector('a[href^="/subscription"]')).toBeNull()
	expect(text()).toContain('Arbitrum One')
})

test('sends a signed-in visitor without a subscription to checkout and back', async () => {
	signIn('none')
	await render()

	await waitForText('is required to view liquidations data')
	expect(container.querySelector('a[href^="/subscription"]')?.getAttribute('href')).toBe(
		'/subscription?returnUrl=%2Fliquidations%2Fsky%2Farbitrum-one'
	)
	expect(http.urls().some((url) => url.includes('/api/private/liquidations'))).toBe(false)
})

test('an open sign-in stays through the account load after a sign-in from another tab', async () => {
	await render()
	const gateSignIn = [...container.querySelectorAll('button')].find((el) => el.textContent === 'active subscription')!
	await act(async () => gateSignIn.click())
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))
	await act(async () => signIn('none'))
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in"))
	await waitForText('is required to view liquidations data')
	expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in")
})

test('loads the chain for a subscriber and shows the server error message', async () => {
	signIn('active')
	http.serve({ '/api/private/liquidations/sky/arbitrum': fixtureStatus(503, { error: 'Liquidations are warming up' }) })
	await render()

	await waitForText('Liquidations are warming up')
	expect(text()).not.toContain('is required to view liquidations data')
})
