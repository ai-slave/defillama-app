// @vitest-environment happy-dom
import { act, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, beforeEach, expect, test, vi } from 'vitest'
import type { Subscription } from '~/auth/subscriptionStatus'
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
// Stripe is the payment boundary: confirmPayment answers the upgrade form, retrievePaymentIntent Stripe's record.
const stripe = vi.hoisted(() => ({
	confirmPayment: vi.fn(),
	retrievePaymentIntent: vi.fn(),
	handleNextAction: vi.fn()
}))
// The PaymentIntent the upgrade form was last given, so a test can tell a resumed intent from a new one.
const upgradeIntent = vi.hoisted(() => ({ clientSecret: null as string | null }))
const elements = vi.hoisted(() => ({ submit: async () => ({}) }))
const stripeMounts = vi.hoisted(() => ({ count: 0 }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(stripe) }))
// Stripe's iframe cannot run in Node. Like the real provider, this asks for the session once on mount and
// draws the checkout only after it arrives. It counts its mounts, so a test can tell whether it rendered at all.
vi.mock('@stripe/react-stripe-js', () => ({
	EmbeddedCheckoutProvider: function Provider({
		children,
		options
	}: {
		children: ReactNode
		options: { fetchClientSecret: () => Promise<string> }
	}) {
		stripeMounts.count++
		const [ready, setReady] = useState(false)
		// Stripe reads its options once, when it mounts.
		const [fetchClientSecret] = useState(() => options.fetchClientSecret)
		useEffect(() => {
			fetchClientSecret().then(
				() => setReady(true),
				() => {}
			)
		}, [fetchClientSecret])
		return ready ? children : null
	},
	EmbeddedCheckout: () => <div>Payment fields</div>,
	Elements: ({ children, options }: { children: ReactNode; options: { clientSecret: string } }) => {
		upgradeIntent.clientSecret = options.clientSecret
		return children
	},
	PaymentElement: () => null,
	useStripe: () => stripe,
	useElements: () => elements
}))

const session = installSubscriberSession('checkout-user', { account: 'free', resolved: true })
const { StripeCheckoutModal } = await import('../StripeCheckoutModal')
const { useStripeCheckout } = await import('../useStripeCheckout')
type CheckoutRequest = import('../useStripeCheckout').CheckoutRequest

beforeEach(() => {
	stripe.confirmPayment.mockReset()
	stripe.retrievePaymentIntent.mockReset()
	stripe.handleNextAction.mockReset()
	upgradeIntent.clientSecret = null
	stripeMounts.count = 0
})

// A caller as the pages write it: the click opens the checkout, and the modal renders only while it is open.
function Caller({ request, modalKey }: { request: CheckoutRequest; modalKey: string }) {
	const checkout = useStripeCheckout()
	return (
		<>
			<button type="button" onClick={() => checkout.open(request)}>
				Subscribe
			</button>
			{checkout.isOpen ? <StripeCheckoutModal key={modalKey} checkout={checkout} /> : null}
		</>
	)
}

async function mountCaller(request: CheckoutRequest = { type: 'api', billingInterval: 'month' }) {
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	const render = (modalKey: string) =>
		act(async () =>
			root.render(
				<session.Wrapper>
					<Caller request={request} modalKey={modalKey} />
				</session.Wrapper>
			)
		)
	await render('first')
	const subscribe = () =>
		act(async () =>
			[...host.querySelectorAll('button')].find((button) => accessibleName(button) === 'Subscribe')!.click()
		)
	await subscribe()
	return {
		subscribe,
		remountModal: render,
		cleanup: async () => {
			await act(async () => root.unmount())
			host.remove()
		}
	}
}
const creates = () => session.urls().filter((url) => url.endsWith('/subscription/create')).length
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const dialogTitled = (title: string) =>
	[...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
		(element) => document.getElementById(element.getAttribute('aria-labelledby')!)?.textContent === title
	)
const buttonNamed = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
		(button) => accessibleName(button) === name
	)
const pay = () => act(async () => buttonNamed('Complete Upgrade')!.click())
const upgrade: CheckoutRequest = { type: 'api', billingInterval: 'year', isUpgradeFlow: true }
const paidUpgrade = { isUpgrade: true, requiresPayment: true, clientSecret: 'pi_upgrade_secret_fixture' }
const pendingKey = 'pending-upgrade:checkout-user'
// The record the upgrade form leaves for an intent it created earlier, as another tab or a previous visit would.
const earlierIntent = (fields: { createdAt: number; interval?: string }) =>
	JSON.stringify({ plan: 'api', interval: 'year', clientSecret: 'pi_old_secret', pricing: null, ...fields })
const monthlyApi = {
	status: 'active',
	expires_at: '2100-01-01',
	type: 'api',
	billing_interval: 'month'
} as Subscription

test('one opening creates one checkout session however often the modal mounts', async () => {
	session.serve({ '/subscription/create': { clientSecret: 'cs_fixture' } })
	const caller = await mountCaller()
	try {
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		await caller.remountModal('second')
		await caller.remountModal('third')
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		expect(creates()).toBe(1)
	} finally {
		await caller.cleanup()
	}
})

test('closing and opening again starts a fresh checkout session', async () => {
	session.serveInOrder('/subscription/create', [{ clientSecret: 'cs_first' }, { clientSecret: 'cs_second' }])
	const caller = await mountCaller()
	try {
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		await act(async () => buttonNamed('Close dialog')!.click())
		await waitForUi(() => expect(dialog()).toBeNull())
		expect(creates()).toBe(1)
		await caller.subscribe()
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		expect(creates()).toBe(2)
	} finally {
		await caller.cleanup()
	}
})

test('an upgrade never mounts the embedded checkout', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		expect(stripeMounts.count).toBe(0)
	} finally {
		await caller.cleanup()
	}
})

test('an upgrade answer without a payment is an error, not a completed upgrade', async () => {
	session.serve({ '/subscription/create': { isUpgrade: true, requiresPayment: false } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() =>
			expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
				'No client secret returned for upgrade payment'
			)
		)
		expect(buttonNamed('Try Again')).toBeTruthy()
	} finally {
		await caller.cleanup()
	}
})

test('offers a retry when the checkout session fails to load, then loads a fresh session', async () => {
	session.serveInOrder('/subscription/create', [
		fixtureStatus(500, { error: 'Checkout unavailable' }),
		{ clientSecret: 'cs_fixture' }
	])
	const caller = await mountCaller()
	try {
		await waitForUi(() => expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
		expect(dialog()!.querySelector('[role="status"]')).toBeNull()
		await act(async () => buttonNamed('Try Again')!.click())
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		expect(dialog()!.querySelector('[role="alert"]')).toBeNull()
		expect(creates()).toBe(2)
	} finally {
		await caller.cleanup()
	}
})

test('labels the wait while the checkout session loads', async () => {
	let answer!: (response: Response) => void
	session.serve({ '/subscription/create': () => new Promise<Response>((resolve) => (answer = resolve)) })
	const caller = await mountCaller()
	try {
		await waitForUi(() => expect(answer).toBeTypeOf('function'))
		expect(dialog()?.querySelector('[role="status"]')?.textContent).toContain('Loading checkout')
		await act(async () => answer(Response.json({ clientSecret: 'cs_fixture' })))
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		expect(dialog()!.querySelector('[role="status"]')).toBeNull()
	} finally {
		await caller.cleanup()
	}
})

test.each([
	[
		'processing',
		'Payment Processing',
		'Your payment is processing. Some payment methods take a few business days, and your plan updates once it clears.'
	],
	[
		'requires_capture',
		'Payment Authorized',
		'Your payment is authorized but not captured yet. Your plan updates once it is captured.'
	]
])('a %s upgrade payment ends on its own step without the pay button', async (status, title, description) => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled(title)).toBeTruthy())
		expect(dialogTitled(title)!.textContent).toContain(description)
		expect(dialog()!.querySelector('[role="alert"]')).toBeNull()
		expect(buttonNamed('Complete Upgrade')).toBeUndefined()
		await act(async () => buttonNamed('Done')!.click())
		await waitForUi(() => expect(dialog()).toBeNull())
	} finally {
		await caller.cleanup()
	}
})

test('a succeeded upgrade payment stays locked while it leaves for the next page', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() =>
			expect(window.location.pathname + window.location.search).toBe('/account?success=true&plan=api&interval=year')
		)
		const submit = dialog()!.querySelector<HTMLButtonElement>('button[type="submit"]')!
		expect(accessibleName(submit)).toBe('Processing…')
		expect(submit.getAttribute('aria-disabled')).toBe('true')
		await act(async () => submit.click())
		expect(stripe.confirmPayment).toHaveBeenCalledOnce()
	} finally {
		await caller.cleanup()
	}
})

test('a declined upgrade payment shows the failure inline and keeps that payment open to pay again', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() =>
			expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
				'Payment failed. Use a different payment method and try again.'
			)
		)
		expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ clientSecret: paidUpgrade.clientSecret })
		await pay()
		await waitForUi(() => expect(stripe.confirmPayment).toHaveBeenCalledTimes(2))
	} finally {
		await caller.cleanup()
	}
})

test('another tab opening the same upgrade resumes the open payment instead of creating a second one', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } })
	const firstTab = await mountCaller(upgrade)
	const secondTab = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2))
		expect(creates()).toBe(1)
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith(paidUpgrade.clientSecret)
		expect(upgradeIntent.clientSecret).toBe(paidUpgrade.clientSecret)
	} finally {
		await secondTab.cleanup()
		await firstTab.cleanup()
	}
})

test('a payment waiting for bank verification is finished by verifying it, not by a new payment', async () => {
	localStorage.setItem(pendingKey, earlierIntent({ createdAt: Date.now() }))
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'requires_action' } })
	stripe.handleNextAction.mockResolvedValue({ paymentIntent: { status: 'processing' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Verification')).toBeTruthy())
		expect(dialog()!.textContent).toContain('Your bank still needs to verify this payment.')
		expect(upgradeIntent.clientSecret).toBe('pi_old_secret')
		await act(async () => buttonNamed('Complete Verification')!.click())
		await waitForUi(() => expect(dialogTitled('Payment Processing')).toBeTruthy())
		expect(stripe.handleNextAction).toHaveBeenCalledExactlyOnceWith({ clientSecret: 'pi_old_secret' })
		expect(stripe.confirmPayment).not.toHaveBeenCalled()
		expect(creates()).toBe(0)
	} finally {
		await caller.cleanup()
	}
})

test('reopening while an earlier upgrade payment is processing shows it instead of asking for a new payment', async () => {
	session.serve({
		'/subscription/create': paidUpgrade,
		'/subscription/status': { subscription: monthlyApi }
	})
	stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'processing' } })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'processing' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled('Payment Processing')).toBeTruthy())
		await act(async () => buttonNamed('Done')!.click())
		await waitForUi(() => expect(dialog()).toBeNull())

		await caller.subscribe()
		await waitForUi(() => expect(dialogTitled('Payment Processing')).toBeTruthy())
		expect(dialog()!.textContent).toContain(
			'Your earlier upgrade payment is still processing, so there is nothing to pay now.'
		)
		expect(buttonNamed('Complete Upgrade')).toBeUndefined()
		expect(creates()).toBe(1)
	} finally {
		await caller.cleanup()
	}
})

test('an earlier payment still processing stays guarded when its plan already shows', async () => {
	localStorage.setItem(pendingKey, earlierIntent({ createdAt: Date.now() }))
	session.serve({
		'/subscription/create': paidUpgrade,
		'/subscription/status': { subscription: { ...monthlyApi, billing_interval: 'year' } }
	})
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'processing' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(dialogTitled('Payment Processing')).toBeTruthy())
		expect(creates()).toBe(0)
		expect(localStorage.getItem(pendingKey)).not.toBeNull()
	} finally {
		await caller.cleanup()
	}
})

test('a lost confirmation response still counts as a payment under way', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment.mockResolvedValue({ error: { type: 'api_connection_error', message: 'Network error' } })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'processing' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled('Payment Processing')).toBeTruthy())
		expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ plan: 'api', interval: 'year' })
	} finally {
		await caller.cleanup()
	}
})

test('a confirmation nobody can check keeps the upgrade pending and says to check the account', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment.mockResolvedValue({ error: { type: 'api_connection_error', message: 'Network error' } })
	stripe.retrievePaymentIntent.mockRejectedValue(new Error('offline'))
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() =>
			expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
				"We couldn't confirm your payment. Check your account before trying again."
			)
		)
		expect(localStorage.getItem(pendingKey)).not.toBeNull()
	} finally {
		await caller.cleanup()
	}
})

test.each([
	['canceled', 'canceled', {}, monthlyApi],
	['paid with the plan applied', 'succeeded', {}, { ...monthlyApi, billing_interval: 'year' } as Subscription]
])('an earlier upgrade payment that is %s gives way to a new one', async (_case, status, earlier, current) => {
	localStorage.setItem(pendingKey, earlierIntent({ createdAt: Date.now(), ...earlier }))
	session.serve({ '/subscription/create': paidUpgrade, '/subscription/status': { subscription: current } })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		expect(creates()).toBe(1)
		expect(upgradeIntent.clientSecret).toBe(paidUpgrade.clientSecret)
		expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ clientSecret: paidUpgrade.clientSecret })
	} finally {
		await caller.cleanup()
	}
})

test.each([
	[
		'over a day old',
		'requires_payment_method',
		{ createdAt: Date.now() - 25 * 60 * 60 * 1000 },
		'An upgrade payment you started over a day ago can still be paid, and its price may be out of date. Contact support to cancel it before upgrading again.'
	],
	[
		'for another plan',
		'requires_action',
		{ interval: 'month' },
		'Your API monthly upgrade from earlier can still be paid. Finish that upgrade, or contact support to cancel it before choosing another plan.'
	]
])(
	'an earlier upgrade payment that can still be paid but is %s holds new upgrades',
	async (_case, status, earlier, description) => {
		const record = earlierIntent({ createdAt: Date.now(), ...earlier })
		localStorage.setItem(pendingKey, record)
		session.serve({ '/subscription/create': paidUpgrade })
		stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status } })
		const caller = await mountCaller(upgrade)
		try {
			await waitForUi(() => expect(dialogTitled('Earlier Upgrade Still Open')).toBeTruthy())
			expect(dialog()!.textContent).toContain(description)
			expect(buttonNamed('Complete Upgrade')).toBeUndefined()
			expect(creates()).toBe(0)
			expect(localStorage.getItem(pendingKey)).toBe(record)
		} finally {
			await caller.cleanup()
		}
	}
)

// Web Locks is a browser API happy-dom leaves out. Like the real one, a request waits for the one before it.
function installWebLocks() {
	const queues = new Map<string, Promise<unknown>>()
	Object.defineProperty(navigator, 'locks', {
		configurable: true,
		value: {
			request: (name: string, callback: () => Promise<unknown>) => {
				const run = (queues.get(name) ?? Promise.resolve()).then(callback)
				queues.set(
					name,
					run.catch(() => {})
				)
				return run
			}
		}
	})
	return () => delete (navigator as { locks?: unknown }).locks
}

test('two tabs opening the same upgrade at once create one payment between them', async () => {
	const uninstallWebLocks = installWebLocks()
	let answerCreate!: () => void
	const created = new Promise<void>((resolve) => {
		answerCreate = resolve
	})
	session.serve({ '/subscription/create': () => created.then(() => paidUpgrade) })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } })
	const firstTab = await mountCaller(upgrade)
	const secondTab = await mountCaller(upgrade)
	try {
		await act(async () => answerCreate())
		await waitForUi(() =>
			expect(
				[...document.querySelectorAll('[role="dialog"] button')].filter(
					(button) => accessibleName(button) === 'Complete Upgrade'
				)
			).toHaveLength(2)
		)
		expect(creates()).toBe(1)
		expect(upgradeIntent.clientSecret).toBe(paidUpgrade.clientSecret)
	} finally {
		await secondTab.cleanup()
		await firstTab.cleanup()
		uninstallWebLocks()
	}
})

test('an earlier upgrade payment that has not cleared in a week points to support', async () => {
	localStorage.setItem(pendingKey, earlierIntent({ createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }))
	session.serve({ '/subscription/create': paidUpgrade, '/subscription/status': { subscription: monthlyApi } })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'processing' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(dialogTitled('Payment Processing')).toBeTruthy())
		expect(dialog()!.textContent).toContain(
			"This upgrade payment started over a week ago and hasn't cleared, so contact support before paying again."
		)
		expect(creates()).toBe(0)
	} finally {
		await caller.cleanup()
	}
})

test.each([
	[false, true],
	[true, false]
])('an API upgrade with overage %s warns that extra usage charges come back: %s', async (overage, warns) => {
	session.serve({
		'/subscription/create': paidUpgrade,
		'/subscription/status': { subscription: { ...monthlyApi, overage } }
	})
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete Upgrade')).toBeTruthy())
		expect(dialog()!.textContent.includes('Upgrading turns extra usage charges back on')).toBe(warns)
	} finally {
		await caller.cleanup()
	}
})
