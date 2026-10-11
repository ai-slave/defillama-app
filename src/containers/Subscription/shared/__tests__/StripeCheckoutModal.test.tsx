// @vitest-environment happy-dom
import { act, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, beforeEach, expect, test, vi } from 'vitest'
import type { Subscription } from '~/auth/subscriptionStatus'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
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
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: () => Promise.resolve(stripe) }))
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
// Some callers (the crypto/card PaymentButton) keep the modal mounted while it is closed.
function Caller({
	request,
	modalKey,
	keepMounted
}: {
	request: CheckoutRequest
	modalKey: string
	keepMounted: boolean
}) {
	const checkout = useStripeCheckout()
	return (
		<>
			<button type="button" onClick={() => checkout.open(request)}>
				Subscribe
			</button>
			{keepMounted || checkout.isOpen ? <StripeCheckoutModal key={modalKey} checkout={checkout} /> : null}
		</>
	)
}

async function mountCaller(request: CheckoutRequest = { type: 'api', billingInterval: 'month' }, keepMounted = false) {
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	const render = (modalKey: string) =>
		act(async () =>
			root.render(
				<session.Wrapper>
					<Caller request={request} modalKey={modalKey} keepMounted={keepMounted} />
				</session.Wrapper>
			)
		)
	await render('first')
	const subscribeButton = () =>
		[...host.querySelectorAll('button')].find((button) => accessibleName(button) === 'Subscribe')!
	// A pointer click focuses the button before it activates, so the dialog has a trigger to return focus to.
	const subscribe = () =>
		act(async () => {
			subscribeButton().focus()
			subscribeButton().click()
		})
	await subscribe()
	return {
		subscribe,
		subscribeButton,
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
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button, [role="alertdialog"] button')].find(
		(button) => accessibleName(button) === name
	)
const pay = () => act(async () => buttonNamed('Complete upgrade')!.click())
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
		await act(async () => buttonNamed('Leave')!.click())
		await waitForUi(() => expect(dialog()).toBeNull())
		expect(creates()).toBe(1)
		await caller.subscribe()
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		expect(creates()).toBe(2)
	} finally {
		await caller.cleanup()
	}
})

test('closing an open checkout asks first; Keep paying keeps it, and an outside tap does nothing', async () => {
	session.serve({ '/subscription/create': { clientSecret: 'cs_first' } })
	const caller = await mountCaller()
	try {
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		await act(async () =>
			dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		)
		expect(document.body.textContent).toContain('Leave checkout?')
		await act(async () => buttonNamed('Keep paying')!.click())
		await waitForUi(() => expect(document.body.textContent).not.toContain('Leave checkout?'))
		expect(dialog()?.textContent).toContain('Payment fields')

		await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
		await act(async () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(dialog()?.textContent).toContain('Payment fields')
	} finally {
		await caller.cleanup()
	}
})

test('an upgrade never mounts the embedded checkout', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
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
		expect(buttonNamed('Try again')).toBeTruthy()
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
		await act(async () => buttonNamed('Try again')!.click())
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		expect(dialog()!.querySelector('[role="alert"]')).toBeNull()
		expect(creates()).toBe(2)
	} finally {
		await caller.cleanup()
	}
})

test('Try again hands its focus to the dialog when the checkout replaces it', async () => {
	session.serveInOrder('/subscription/create', [
		fixtureStatus(500, { error: 'Checkout unavailable' }),
		{ clientSecret: 'cs_fixture' }
	])
	const caller = await mountCaller()
	try {
		await waitForUi(() => expect(buttonNamed('Try again')).toBeTruthy())
		await act(async () => buttonNamed('Try again')!.focus())
		await act(async () => buttonNamed('Try again')!.click())
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		// The dialog's net hands the removed button's focus to its first control, the header close button.
		await waitForUi(() => expect(document.activeElement).toBe(buttonNamed('Close dialog')))
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
		'Payment processing',
		'Your payment is processing. Some payment methods take a few business days, and your plan updates once it clears.'
	],
	[
		'requires_capture',
		'Payment authorized',
		'Your payment is authorized but not captured yet. Your plan updates once it is captured.'
	]
])('a %s upgrade payment ends on its own step without the pay button', async (status, title, description) => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled(title)).toBeTruthy())
		expect(dialogTitled(title)!.textContent).toContain(description)
		expect(dialog()!.querySelector('[role="alert"]')).toBeNull()
		expect(buttonNamed('Complete upgrade')).toBeUndefined()
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
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
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

test('a declined upgrade payment shows the failure inline and keeps it on screen while the payment is retried', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment
		.mockResolvedValueOnce({ paymentIntent: { status: 'requires_payment_method' } })
		.mockReturnValueOnce(new Promise(() => {}))
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() =>
			expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
				'Payment failed. Use a different payment method and try again.'
			)
		)
		expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ clientSecret: paidUpgrade.clientSecret })
		await pay()
		await waitForUi(() => expect(stripe.confirmPayment).toHaveBeenCalledTimes(2))
		expect(buttonNamed('Processing…')!.getAttribute('aria-busy')).toBe('true')
		expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
			'Payment failed. Use a different payment method and try again.'
		)
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
		await waitForUi(() => expect(buttonNamed('Complete verification')).toBeTruthy())
		expect(dialog()!.textContent).toContain('Your bank still needs to verify this payment.')
		expect(upgradeIntent.clientSecret).toBe('pi_old_secret')
		await act(async () => buttonNamed('Complete verification')!.click())
		await waitForUi(() => expect(dialogTitled('Payment processing')).toBeTruthy())
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
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled('Payment processing')).toBeTruthy())
		await act(async () => buttonNamed('Done')!.click())
		await waitForUi(() => expect(dialog()).toBeNull())

		await caller.subscribe()
		await waitForUi(() => expect(dialogTitled('Payment processing')).toBeTruthy())
		expect(dialog()!.textContent).toContain(
			'Your earlier upgrade payment is still processing, so there is nothing to pay now.'
		)
		expect(buttonNamed('Complete upgrade')).toBeUndefined()
		expect(creates()).toBe(1)
	} finally {
		await caller.cleanup()
	}
})

test('closing the step an upgrade opening ends on hands focus back to the button that opened it', async () => {
	localStorage.setItem(pendingKey, earlierIntent({ createdAt: Date.now() }))
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'processing' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(dialogTitled('Payment processing')).toBeTruthy())
		await act(async () => buttonNamed('Done')!.click())
		await waitForUi(() => expect(dialog()).toBeNull())
		await waitForUi(() => expect(document.activeElement).toBe(caller.subscribeButton()))
	} finally {
		await caller.cleanup()
	}
})

test('a canceled upgrade payment ends on its own step instead of a form that can never be paid', async () => {
	session.serve({ '/subscription/create': paidUpgrade })
	stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'canceled' } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled('Payment canceled')).toBeTruthy())
		expect(dialog()!.textContent).toContain('This upgrade payment was canceled, so it can no longer be paid.')
		expect(buttonNamed('Complete upgrade')).toBeUndefined()
		// The next opening creates a fresh payment instead of resuming the canceled one.
		expect(localStorage.getItem(pendingKey)).toBeNull()
	} finally {
		await caller.cleanup()
	}
})

test('a modal kept mounted between openings starts the next upgrade from the form, not the last outcome', async () => {
	session.serveInOrder('/subscription/create', [paidUpgrade, { ...paidUpgrade, clientSecret: 'pi_fresh_secret' }])
	stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'canceled' } })
	const caller = await mountCaller(upgrade, true)
	try {
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled('Payment canceled')).toBeTruthy())
		await act(async () => buttonNamed('Done')!.click())
		await waitForUi(() => expect(dialog()).toBeNull())

		await caller.subscribe()
		await waitForUi(() => expect(upgradeIntent.clientSecret).toBe('pi_fresh_secret'))
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		expect(dialogTitled('Payment canceled')).toBeUndefined()
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
		await waitForUi(() => expect(dialogTitled('Payment processing')).toBeTruthy())
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
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(dialogTitled('Payment processing')).toBeTruthy())
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
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		await pay()
		await waitForUi(() => expect(alertTexts(dialog()!)).toHaveLength(1))
		expect(localStorage.getItem(pendingKey)).not.toBeNull()
	} finally {
		await caller.cleanup()
	}
})

test.each([
	['canceled', 'canceled', {}, monthlyApi],
	['paid with the plan applied', 'succeeded', {}, { ...monthlyApi, billing_interval: 'year' } as Subscription],
	[
		'payable but over a day old',
		'requires_payment_method',
		{ createdAt: Date.now() - 25 * 60 * 60 * 1000 },
		monthlyApi
	],
	['payable but for another plan', 'requires_action', { interval: 'month' }, monthlyApi]
])('an earlier upgrade payment that is %s gives way to a new one', async (_case, status, earlier, current) => {
	localStorage.setItem(pendingKey, earlierIntent({ createdAt: Date.now(), ...earlier }))
	session.serve({ '/subscription/create': paidUpgrade, '/subscription/status': { subscription: current } })
	stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status } })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		expect(creates()).toBe(1)
		expect(upgradeIntent.clientSecret).toBe(paidUpgrade.clientSecret)
		expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ clientSecret: paidUpgrade.clientSecret })
	} finally {
		await caller.cleanup()
	}
})

// Another tab can sign in as someone else while this click's checkout waits on its lock or the earlier payment.
const otherAccountToken = `e30.${btoa(JSON.stringify({ id: 'other-user', exp: 4_102_444_800 }))}.signature`
const switchAccount = () => {
	const record = { ...session.record, id: 'other-user' }
	session.serve({ '/api/collections/users/auth-refresh': { token: otherAccountToken, record } })
	return act(async () => pb.authStore.save(otherAccountToken, record))
}

test('an account switched while the earlier payment is checked creates no checkout for the new account', async () => {
	localStorage.setItem(pendingKey, earlierIntent({ createdAt: Date.now() }))
	session.serve({ '/subscription/create': paidUpgrade })
	let answerStatus!: () => void
	stripe.retrievePaymentIntent.mockReturnValue(
		new Promise((resolve) => {
			answerStatus = () => resolve({ paymentIntent: { status: 'canceled' } })
		})
	)
	const caller = await mountCaller(upgrade)
	try {
		await switchAccount()
		await act(async () => answerStatus())
		await waitForUi(() => expect(dialog()!.textContent).toContain('The signed-in account changed'))
		expect(creates()).toBe(0)
		expect(localStorage.getItem('pending-upgrade:other-user')).toBeNull()
	} finally {
		await caller.cleanup()
	}
})

test.each([
	['switches to another account', () => switchAccount()],
	['signs out', () => act(async () => pb.authStore.clear())]
])('a reader who %s while an earlier upgrade is checked never gets its payment form', async (_case, leave) => {
	const record = earlierIntent({ createdAt: Date.now() })
	localStorage.setItem(pendingKey, record)
	session.serve({ '/subscription/create': paidUpgrade })
	let answerStatus!: () => void
	stripe.retrievePaymentIntent.mockReturnValue(
		new Promise((resolve) => {
			answerStatus = () => resolve({ paymentIntent: { status: 'requires_payment_method' } })
		})
	)
	const caller = await mountCaller(upgrade)
	try {
		await leave()
		await act(async () => answerStatus())
		await waitForUi(() => expect(dialog()!.textContent).toContain('The signed-in account changed'))
		expect(buttonNamed('Complete upgrade')).toBeUndefined()
		expect(creates()).toBe(0)
		// The payment is still the clicking account's to resume.
		expect(localStorage.getItem(pendingKey)).toBe(record)
	} finally {
		await caller.cleanup()
	}
})

test('an account switched after the checkout was created keeps the payment with the account that clicked', async () => {
	let answerCreate!: () => void
	const created = new Promise<void>((resolve) => {
		answerCreate = resolve
	})
	session.serve({ '/subscription/create': () => created.then(() => paidUpgrade) })
	const caller = await mountCaller(upgrade)
	try {
		await waitForUi(() => expect(creates()).toBe(1))
		await switchAccount()
		await act(async () => answerCreate())
		await waitForUi(() => expect(dialog()!.textContent).toContain('The signed-in account changed'))
		expect(buttonNamed('Complete upgrade')).toBeUndefined()
		// The intent is the clicking account's, so its next opening resumes it instead of creating another.
		expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ clientSecret: paidUpgrade.clientSecret })
		expect(localStorage.getItem('pending-upgrade:other-user')).toBeNull()
	} finally {
		await caller.cleanup()
	}
})

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
					(button) => accessibleName(button) === 'Complete upgrade'
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
		await waitForUi(() => expect(dialogTitled('Payment processing')).toBeTruthy())
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
		await waitForUi(() => expect(buttonNamed('Complete upgrade')).toBeTruthy())
		expect(dialog()!.textContent.includes('Upgrading turns extra usage charges back on')).toBe(warns)
	} finally {
		await caller.cleanup()
	}
})

test('a failed checkout keeps its error on screen while Try again runs', async () => {
	let answer!: (response: Response) => void
	session.serveInOrder('/subscription/create', [
		fixtureStatus(500, { error: 'Checkout unavailable' }),
		() => new Promise<Response>((resolve) => (answer = resolve))
	])
	const caller = await mountCaller()
	try {
		await waitForUi(() => expect(buttonNamed('Try again')).toBeTruthy())
		await act(async () => buttonNamed('Try again')!.click())
		await waitForUi(() => expect(answer).toBeTypeOf('function'))

		expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable')
		expect(buttonNamed('Retrying…')).toBeTruthy()
		await act(async () => answer(Response.json({ clientSecret: 'cs_fixture' })))
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
	} finally {
		await caller.cleanup()
	}
})
