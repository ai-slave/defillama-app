// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Subscription from '~/pages/subscription'
import pb from '~/utils/pocketbase'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

// Stripe.js is a script from Stripe's servers, which Node cannot load.
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/subscription', asPath: '/subscription', isReady: true, query: {}, replace: vi.fn() })
}))
// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const session = installSubscriberSession('buyer', { account: 'signed-out' })
let root: Root
let host: HTMLDivElement

beforeEach(async () => {
	session.serve({
		'/subscription/trial-available': { trialAvailable: false },
		// A 4xx reason is written for readers, so it shows as the server wrote it.
		'/subscription/create': fixtureStatus(409, { message: 'LlamaPay is unavailable' })
	})
	host = document.body.appendChild(document.createElement('div'))
	root = createRoot(host)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Subscription />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

const checkoutRequests = () => session.requests.filter((request) => request.url.pathname === '/subscription/create')

// Clicks Pay with Crypto on a plan (0: Pro, 1: API) while signed out, then signs in.
async function payWithCryptoThenSignIn(planIndex = 0) {
	const pay = await waitForUi(() => {
		const buttons = [...host.querySelectorAll('button')].filter((el) => el.textContent === 'Pay with Crypto')
		expect(buttons).toHaveLength(2)
		return buttons[planIndex]
	})
	await act(async () => pay.click())
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))
	await act(async () => pb.authStore.save(session.token, session.record as never))
	const proceed = await waitForUi(() => {
		const button = [...document.querySelectorAll('[role=dialog] button')].find((el) => el.textContent === 'Continue')
		expect(button).toBeDefined()
		return button as HTMLButtonElement
	})
	await act(async () => proceed.click())
}

test('a plan chosen while signed out continues to its checkout after sign-in', async () => {
	await payWithCryptoThenSignIn()
	await waitForUi(() => expect(checkoutRequests()).toHaveLength(1))
	expect(JSON.parse(String(checkoutRequests()[0].init?.body))).toMatchObject({
		provider: 'llamapay',
		subscriptionType: 'llamafeed'
	})
	await waitForUi(async () => {
		await act(async () => {})
		expect([...host.querySelectorAll('[role=alert]')].map((alert) => alert.textContent)).toEqual([
			'LlamaPay is unavailable'
		])
	})
})

test('a plan chosen while signed out does not start a checkout when the account already has it', async () => {
	session.serve({
		'/subscription/status': {
			subscription: { status: 'active', expires_at: '2100-01-01', type: 'llamafeed', provider: 'stripe' }
		}
	})
	await payWithCryptoThenSignIn()
	await waitForUi(() => expect(host.textContent).toContain('Current plan'))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
	expect(checkoutRequests()).toHaveLength(0)
})

test('a crypto plan chosen while signed out does not start beside a card plan the account already pays for', async () => {
	session.serve({
		'/subscription/status': {
			subscription: { status: 'active', expires_at: '2100-01-01', type: 'llamafeed', provider: 'stripe' }
		}
	})
	await payWithCryptoThenSignIn(1)
	await waitForUi(() => expect(host.textContent).toContain('Upgrade to API with Card'))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
	expect(checkoutRequests()).toHaveLength(0)
})
