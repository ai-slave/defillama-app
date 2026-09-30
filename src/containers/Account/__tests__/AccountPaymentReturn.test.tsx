// @vitest-environment happy-dom
import { act, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { subscriptionStatusQueryKey, type Subscription } from '~/auth/subscriptionStatus'
import { Toast } from '~/components/Toast'
import { teamCheckoutReturnPath } from '~/containers/Account/Team/pendingTeamCheckout'
import { readPendingUpgrade, savePendingUpgrade } from '~/containers/Subscription/shared/pendingUpgrade'
import { checkoutReturnPath } from '~/containers/Subscription/shared/useStripeCheckout'
import Account from '~/pages/account'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'

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
// Stripe's record of the stored upgrade payment, which the return page reads before it forgets that payment.
const stripe = vi.hoisted(() => ({ retrievePaymentIntent: vi.fn() }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(stripe) }))
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
	stripe.retrievePaymentIntent.mockReset()
	// An older return link: only the success flag, without the purchased plan or Stripe's outcome.
	router.query = { success: 'true' }
	router.replace.mockClear()
})
afterEach(() => {
	vi.useRealTimers()
})

/** The query Stripe returns a Pro yearly upgrade to: the return path the checkout asks for, plus the params Stripe
    appends to it. */
async function upgradeReturnQuery(redirectStatus: string) {
	const returnUrl = new URL(
		checkoutReturnPath({
			type: 'llamafeed',
			billingInterval: 'year',
			isUpgradeFlow: true,
			upgradeReturnPath: '/account?success=true'
		}),
		'https://defillama.com'
	)
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
				<Toast />
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

		expect(page.title()).toBe('Payment successful')
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
	['failed', 'Payment not completed', "Your payment didn't go through, so your plan hasn't changed."],
	['requires_payment_method', 'Payment not completed', "Your payment didn't go through, so your plan hasn't changed."]
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
		expect(page.title()).toBe('Payment processing')
		expect(page.dialog()?.textContent).toContain(
			'Your bank is still processing the payment. Your plan updates once it clears.'
		)
		session.serve({ '/subscription/status': { subscription: proPlan('year') } })
		await page.wait(4000)

		expect(page.title()).toBe('Payment successful')
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

		expect(page.title()).toBe('Payment processing')
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

		expect(page.title()).toBe('Payment successful')
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

		expect(page.title()).toBe('Payment successful')
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

const pendingUpgradeKey = 'pending-upgrade:checkout-user'
const earlierUpgrade = JSON.stringify({
	plan: 'llamafeed',
	interval: 'year',
	clientSecret: 'pi_old_secret',
	startedAt: 1
})

test.each([
	['failed', 'Payment not completed'],
	['processing', 'Payment processing']
])('a %s redirect return leaves the open upgrade payment to be resumed', async (status, title) => {
	localStorage.setItem(pendingUpgradeKey, earlierUpgrade)
	router.query = await upgradeReturnQuery(status)
	const page = await renderReturnFromCheckout()
	try {
		await page.wait(0)
		expect(page.title()).toBe(title)
		expect(localStorage.getItem(pendingUpgradeKey)).toBe(earlierUpgrade)
	} finally {
		await page.unmount()
	}
})

// The upgrade payment this browser has open when the Pro yearly return lands: possibly another payment for that plan.
const storedUpgrade = {
	plan: 'llamafeed',
	interval: 'year',
	clientSecret: 'pi_stored_secret_stored',
	pricing: null,
	createdAt: 1
} as const

test.each([
	['forgets a stored payment for that plan once Stripe says it succeeded', 'succeeded', null],
	['keeps guarding a stored payment for that plan that is still payable', 'requires_payment_method', storedUpgrade],
	['keeps guarding a stored payment for that plan that is still processing', 'processing', storedUpgrade]
])('a confirmed return %s', async (_case, status, remaining) => {
	savePendingUpgrade('checkout-user', storedUpgrade)
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status } })
	router.query = await upgradeReturnQuery('succeeded')
	session.serve({ '/subscription/status': { subscription: proPlan('year') } })
	const page = await renderReturnFromCheckout()
	try {
		await page.wait(0)
		expect(page.title()).toBe('Payment successful')
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith(storedUpgrade.clientSecret)
		expect(readPendingUpgrade('checkout-user')).toEqual(remaining)
	} finally {
		await page.unmount()
	}
})

test('a finished check of one payment keeps a newer payment stored while it ran', async () => {
	savePendingUpgrade('checkout-user', storedUpgrade)
	let answerStripe!: () => void
	stripe.retrievePaymentIntent.mockReturnValue(
		new Promise((resolve) => {
			answerStripe = () => resolve({ paymentIntent: { status: 'succeeded' } })
		})
	)
	router.query = await upgradeReturnQuery('succeeded')
	session.serve({ '/subscription/status': { subscription: proPlan('year') } })
	const page = await renderReturnFromCheckout()
	try {
		await page.wait(0)
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith(storedUpgrade.clientSecret)
		// Another tab records a newer payment for the same plan while this check waits on Stripe.
		const newer = { ...storedUpgrade, clientSecret: 'pi_newer_secret_newer', createdAt: 2 }
		savePendingUpgrade('checkout-user', newer)
		await act(async () => answerStripe())
		await page.wait(0)
		expect(readPendingUpgrade('checkout-user')).toEqual(newer)
	} finally {
		await page.unmount()
	}
})

test('a paid team checkout names its seats and holds a second checkout of that plan', async () => {
	router.query = Object.fromEntries(
		new URL(teamCheckoutReturnPath('llamafeed', 3), 'https://defillama.com').searchParams
	)
	session.serve({ '/team': { team: null } })
	const page = await renderReturnFromCheckout()
	try {
		await page.wait(0)
		expect(document.body.textContent).toContain('Payment received. 3 seats will be available shortly.')
		expect(JSON.parse(localStorage.getItem('pending-team-checkout:checkout-user:llamafeed')!)).toMatchObject({
			seats: 3
		})
		expect(router.replace).toHaveBeenCalledWith({ pathname: '/account', query: { tab: 'team' } }, undefined, {
			shallow: true
		})
	} finally {
		await page.unmount()
	}
})

test('a team checkout return with an unreadable seat count keeps the plain message and holds nothing', async () => {
	router.query = { tab: 'team', 'team-checkout': 'success', type: 'llamafeed', seats: 'lots' }
	session.serve({ '/team': { team: null } })
	const page = await renderReturnFromCheckout()
	try {
		await page.wait(0)
		expect(document.body.textContent).toContain('Payment received! Your team seats will be available shortly.')
		expect(localStorage.getItem('pending-team-checkout:checkout-user:llamafeed')).toBeNull()
	} finally {
		await page.unmount()
	}
})
