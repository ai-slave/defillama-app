// @vitest-environment happy-dom
import { act, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { subscriptionStatusQueryKey, type Subscription } from '~/auth/subscriptionStatus'
import { StripeCheckoutModal } from '~/containers/Subscription/shared/StripeCheckoutModal'
import Account from '~/pages/account'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

// Constants read the publishable key at import time; checkout only loads Stripe when it is set.
const originalKey = vi.hoisted(() => {
	const value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
	process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fixture'
	return value
})
afterAll(() => {
	if (originalKey === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
	else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalKey
})
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }))
// Stripe's iframe cannot run in Node. Like the real provider, this asks for the session once on mount.
vi.mock('@stripe/react-stripe-js', () => ({
	EmbeddedCheckoutProvider: function Provider({
		children,
		options
	}: {
		children: ReactNode
		options: { fetchClientSecret: () => Promise<string> }
	}) {
		const [fetchClientSecret] = useState(() => options.fetchClientSecret)
		useEffect(() => {
			fetchClientSecret().catch(() => {})
		}, [fetchClientSecret])
		return children
	},
	EmbeddedCheckout: () => null
}))

const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/account',
	query: {} as Record<string, string>,
	replace: vi.fn(async () => true)
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
// The account cards are not under test; the checkout return dialog is.
vi.mock('~/containers/Account/ManageAccount', () => ({ ManageAccount: () => null }))

const session = installSubscriberSession('checkout-user', { account: 'free', resolved: true })
const statusReads = () => session.urls().filter((url) => url.endsWith('/subscription/status'))
// Reads of one plan's record: the page asks for the bought plan by type while it confirms a purchase.
const purchaseReads = () =>
	session.requests.filter(
		(request) =>
			request.url.pathname === '/subscription/status' && String(request.init?.body).includes('subscriptionType')
	)
/** Answers a status read by the plan it asks for; an untyped read gets the first active plan. */
const statusByType = (plans: Record<string, Subscription>, first: Subscription) => (_url: URL, init?: RequestInit) => {
	const type = init?.body
		? (JSON.parse(String(init.body)) as { subscriptionType?: string }).subscriptionType
		: undefined
	const plan = type ? plans[type] : first
	return plan ? { subscription: plan } : fixtureStatus(404, { message: 'No active subscription' })
}
const proPlan = (billing_interval: 'month' | 'year') =>
	({ status: 'active', expires_at: '2100-01-01', type: 'llamafeed', billing_interval }) as Subscription

beforeEach(() => {
	// An older return link: only the success flag, without the purchased plan or Stripe's outcome.
	router.query = { success: 'true' }
	router.replace.mockClear()
})
afterEach(() => {
	vi.useRealTimers()
})

/** The query Stripe returns a Pro yearly upgrade to: the return path the checkout dialog asks for, plus the
    params Stripe appends to it. */
async function upgradeReturnQuery(redirectStatus: string) {
	session.serve({ '/subscription/create': { clientSecret: 'cs_fixture' } })
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<StripeCheckoutModal
					isOpen
					onClose={() => {}}
					paymentMethod="stripe"
					type="llamafeed"
					billingInterval="year"
					isUpgradeFlow
					upgradeReturnPath="/account?success=true"
				/>
			</session.Wrapper>
		)
	)
	const create = await waitForUi(() => {
		const request = session.requests.find((request) => request.url.pathname === '/subscription/create')
		expect(request).toBeDefined()
		return request!
	})
	await act(async () => root.unmount())
	host.remove()
	const returnUrl = new URL(JSON.parse(String(create.init!.body)).redirectUrl)
	expect(returnUrl.pathname).toBe('/account')
	returnUrl.searchParams.set('payment_intent', 'pi_fixture')
	returnUrl.searchParams.set('payment_intent_client_secret', 'pi_fixture_secret_fixture')
	returnUrl.searchParams.set('redirect_status', redirectStatus)
	return Object.fromEntries(returnUrl.searchParams)
}

async function renderReturnFromCheckout() {
	session.serve({
		'/subscription/past-due': fixtureStatus(404, { message: 'No past due subscription found' }),
		'/subscription/trial-available': { trialAvailable: false },
		'/user/credits': { credits: 0, maxCredits: 0, monthKey: '2026-09' }
	})
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Account />
			</session.Wrapper>
		)
	)
	const dialog = () => document.querySelector('[role="dialog"]')
	return {
		dialog,
		title: () => dialog()?.querySelector('h2')?.textContent,
		buttons: () => [...dialog()!.querySelectorAll('button')].map(accessibleName),
		wait: (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms)),
		unmount: async () => {
			await act(async () => root.unmount())
			host.remove()
		}
	}
}

test('a monthly to yearly upgrade keeps confirming while the plan reads monthly, then confirms on yearly', async () => {
	router.query = await upgradeReturnQuery('succeeded')
	session.client.setQueryData(subscriptionStatusQueryKey('checkout-user'), proPlan('month'))
	session.serve({ '/subscription/status': { subscription: proPlan('month') } })
	const page = await renderReturnFromCheckout()
	try {
		// Reads at 0s and 4s still see the monthly plan the upgrade started from.
		await page.wait(4000)
		expect(purchaseReads().length).toBeGreaterThan(0)
		expect(page.title()).toBe('Confirming your payment')
		session.serve({ '/subscription/status': { subscription: proPlan('year') } })
		await page.wait(4000)

		expect(page.title()).toBe('Payment Successful')
		const readsAtConfirm = statusReads().length
		for (let step = 0; step < 3; step++) await page.wait(4000)
		expect(statusReads()).toHaveLength(readsAtConfirm)
	} finally {
		await page.unmount()
	}
})

test('a checkout return removes the checkout and Stripe params from the URL', async () => {
	router.query = await upgradeReturnQuery('succeeded')
	const page = await renderReturnFromCheckout()
	try {
		expect(router.replace).toHaveBeenCalledExactlyOnceWith({ pathname: '/account', query: {} }, undefined, {
			shallow: true
		})
	} finally {
		await page.unmount()
	}
})

test.each([
	['failed', 'Payment Not Completed', "Your payment didn't go through, so your plan hasn't changed."],
	['requires_payment_method', 'Payment Not Completed', "Your payment didn't go through, so your plan hasn't changed."]
])('a %s payment return names its outcome without waiting on the plan', async (status, title, description) => {
	router.query = await upgradeReturnQuery(status)
	const page = await renderReturnFromCheckout()
	try {
		for (let step = 0; step < 3; step++) await page.wait(4000)

		expect(page.title()).toBe(title)
		expect(page.dialog()?.textContent).toContain(description)
		expect(page.buttons()).toEqual(['Close dialog', 'Done'])
		expect(statusReads()).toHaveLength(0)
	} finally {
		await page.unmount()
	}
})

test('a processing payment return says so, then confirms once the bought plan arrives', async () => {
	router.query = await upgradeReturnQuery('processing')
	session.client.setQueryData(subscriptionStatusQueryKey('checkout-user'), proPlan('month'))
	session.serve({ '/subscription/status': { subscription: proPlan('month') } })
	const page = await renderReturnFromCheckout()
	try {
		await page.wait(4000)
		expect(page.title()).toBe('Payment Processing')
		expect(page.dialog()?.textContent).toContain(
			'Your bank is still processing the payment. Your plan updates once it clears.'
		)
		session.serve({ '/subscription/status': { subscription: proPlan('year') } })
		await page.wait(4000)

		expect(page.title()).toBe('Payment Successful')
	} finally {
		await page.unmount()
	}
})

test('a processing payment that never clears while the page is open says to refresh later', async () => {
	router.query = await upgradeReturnQuery('processing')
	session.serve({ '/subscription/status': { subscription: proPlan('month') } })
	const page = await renderReturnFromCheckout()
	try {
		for (let step = 0; step < 6; step++) await page.wait(4000)

		expect(page.title()).toBe('Payment Processing')
		expect(page.dialog()?.textContent).toContain(
			'Your bank is still processing the payment. Refresh the page later to see your plan.'
		)
		const readsWhenDone = statusReads().length
		for (let step = 0; step < 3; step++) await page.wait(4000)
		expect(statusReads()).toHaveLength(readsWhenDone)
	} finally {
		await page.unmount()
	}
})

test('a user with API who buys Pro yearly confirms on the Pro record, not the first active plan', async () => {
	router.query = await upgradeReturnQuery('succeeded')
	const api = { status: 'active', expires_at: '2100-01-01', type: 'api', billing_interval: 'month' } as Subscription
	session.serve({
		'/subscription/status': statusByType({ llamafeed: proPlan('year'), api }, api),
		// An API subscriber's page also loads the key and usage cards.
		'/auth/get-api-key': { apiKey: null },
		'/user/usage-stats': {}
	})
	const page = await renderReturnFromCheckout()
	try {
		await page.wait(4000)

		expect(page.title()).toBe('Payment Successful')
		expect(purchaseReads().length).toBeGreaterThan(0)
	} finally {
		await page.unmount()
	}
})

test('an older return link without the plan confirms on any active subscription', async () => {
	const page = await renderReturnFromCheckout()
	try {
		expect(page.title()).toBe('Confirming your payment')
		expect(page.dialog()?.querySelector('[role="status"]')?.textContent).toContain('Checking your payment')

		// Reads at 0s and 4s still see Free.
		await page.wait(4000)
		expect(statusReads()).toHaveLength(2)
		expect(page.title()).toBe('Confirming your payment')
		session.serve({
			'/subscription/status': { subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } }
		})
		await page.wait(4000)

		expect(page.title()).toBe('Payment Successful')
		expect(page.dialog()?.textContent).toContain('Your payment went through.')
		for (let step = 0; step < 3; step++) await page.wait(4000)
		expect(statusReads()).toHaveLength(3)
	} finally {
		await page.unmount()
	}
})

test('a checkout return that never reads active says the payment is still confirming', async () => {
	const page = await renderReturnFromCheckout()
	try {
		// Six reads: one at once, then one every four seconds. Each read schedules the next once it
		// settles and renders, so time advances in read-sized steps.
		for (let step = 0; step < 6; step++) await page.wait(4000)

		expect(statusReads()).toHaveLength(6)
		expect(page.title()).toBe('Payment still confirming')
		expect(page.dialog()?.textContent).toContain(
			'Your payment is still being confirmed. Refresh the page in a minute to see your plan.'
		)
		expect(page.buttons()).toEqual(['Close dialog', 'Done'])
		for (let step = 0; step < 3; step++) await page.wait(4000)
		expect(statusReads()).toHaveLength(6)
	} finally {
		await page.unmount()
	}
})
