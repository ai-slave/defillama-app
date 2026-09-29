// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { subscriptionStatusQueryKey, type Subscription } from '~/auth/subscriptionStatus'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
const session = installSubscriberSession('pending-user', { account: 'free', resolved: true })
import { WelcomeOnboarding } from '../WelcomeOnboarding'

const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/welcome',
	query: {} as Record<string, string>,
	push: vi.fn(),
	replace: vi.fn(async () => true)
}))
vi.mock('next/router', () => ({ default: { push: router.push }, useRouter: () => router }))

afterEach(() => {
	vi.useRealTimers()
	router.query = {}
	router.isReady = true
	router.replace.mockClear()
})

const plan = (type: string, billing_interval: 'month' | 'year') =>
	({ id: `sub-${type}`, status: 'active', type, billing_interval, expires_at: '2100-01-01' }) as Subscription
const statusReads = () => session.urls().filter((url) => url.endsWith('/subscription/status'))

async function renderWelcome(query: Record<string, string>) {
	router.query = query
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<WelcomeOnboarding />
			</session.Wrapper>
		)
	)
	return {
		host,
		heading: () => host.querySelector('h1, h2')?.textContent,
		read: () => act(() => vi.advanceTimersByTimeAsync(4000)),
		unmount: async () => {
			await act(async () => root.unmount())
			host.remove()
		}
	}
}

// Guard: without the checkout params the page keeps confirming any active plan.
test('stops promising automatic checks once the payment confirmation reads run out', async () => {
	const page = await renderWelcome({})
	try {
		expect(page.heading()).toBe('Processing your payment')
		expect(page.host.textContent).toContain('this page checks again automatically')
		expect(page.host.querySelector('[role="status"]')?.textContent).toContain('Checking your payment')

		// Six reads: one right away, then one every four seconds. Each read schedules the next on render,
		// so time advances one read per act.
		for (let read = 0; read < 6; read++) await page.read()
		expect(statusReads()).toHaveLength(6)
		expect(page.host.textContent).toContain('Refresh the page to check again.')
		expect(page.host.textContent).not.toContain('automatically')
		expect(page.host.querySelector('[role="status"]')).toBeNull()
	} finally {
		await page.unmount()
	}
})

test.each([
	{ owned: plan('api', 'month'), bought: plan('llamafeed', 'year'), welcome: 'Welcome to DefiLlama Pro' },
	{ owned: plan('llamafeed', 'month'), bought: plan('api', 'year'), welcome: 'Welcome to DefiLlama API' }
])(
	'a $owned.type subscriber buying $bought.type yearly waits for that record, then says "$welcome"',
	async ({ owned, bought, welcome }) => {
		let boughtApplied = false
		session.client.setQueryData(subscriptionStatusQueryKey('pending-user'), owned)
		session.serve({
			'/subscription/status': (_url: URL, init?: RequestInit) => {
				const type = init?.body ? JSON.parse(init.body as string).subscriptionType : null
				if (type === null) return { subscription: owned }
				return type === bought.type && boughtApplied
					? { subscription: bought }
					: fixtureStatus(404, { message: 'No active subscription' })()
			}
		})
		const page = await renderWelcome({ plan: bought.type, interval: 'year' })
		try {
			await page.read()
			expect(page.heading()).toBe('Processing your payment')

			boughtApplied = true
			await page.read()
			await waitForUi(() => expect(page.heading()).toBe(welcome))
		} finally {
			await page.unmount()
		}
	}
)

test('a declined redirect payment says the payment did not complete and stops checking', async () => {
	const page = await renderWelcome({ plan: 'llamafeed', interval: 'year', redirect_status: 'requires_payment_method' })
	try {
		await page.read()
		expect(page.heading()).toBe('Payment Not Completed')
		expect(page.host.textContent).toContain("Your payment didn't go through, so your plan hasn't changed.")
		expect(statusReads()).toHaveLength(0)
	} finally {
		await page.unmount()
	}
})

test('a redirect payment still processing keeps waiting for the plan', async () => {
	const page = await renderWelcome({ plan: 'llamafeed', interval: 'year', redirect_status: 'processing' })
	try {
		await page.read()
		expect(page.heading()).toBe('Payment Processing')
		expect(page.host.textContent).toContain('Your bank is still processing the payment.')
		expect(page.host.querySelector('[role="status"]')?.textContent).toContain('Checking your payment')
	} finally {
		await page.unmount()
	}
})

// A static page reads its query only after hydration, so the first render cannot tell a checkout return from a visit.
test('waits for the router before confirming, so an existing plan never passes for the purchase', async () => {
	router.isReady = false
	session.client.setQueryData(subscriptionStatusQueryKey('pending-user'), plan('api', 'month'))
	session.serve({ '/subscription/status': { subscription: plan('api', 'month') } })
	const page = await renderWelcome({})
	try {
		await page.read()
		expect(page.heading()).toBeUndefined()
		expect(page.host.querySelector('[role="status"]')?.textContent).toContain('Loading your subscription')
	} finally {
		await page.unmount()
	}
})

test("a redirect return drops Stripe's payment intent and client secret from the URL and keeps the purchase", async () => {
	const page = await renderWelcome({
		plan: 'llamafeed',
		interval: 'year',
		redirect_status: 'processing',
		payment_intent: 'pi_fixture',
		payment_intent_client_secret: 'pi_fixture_secret_fixture'
	})
	try {
		expect(router.replace).toHaveBeenCalledExactlyOnceWith(
			{ pathname: '/welcome', query: { plan: 'llamafeed', interval: 'year', redirect_status: 'processing' } },
			undefined,
			{ shallow: true }
		)
	} finally {
		await page.unmount()
	}
})
