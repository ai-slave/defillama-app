// @vitest-environment happy-dom
import { act, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, expect, test, vi } from 'vitest'
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
// Stripe's iframe cannot run in Node. Like the real provider, this asks for the session once on mount and
// draws the checkout only after it arrives.
vi.mock('@stripe/react-stripe-js', () => ({
	EmbeddedCheckoutProvider: function Provider({
		children,
		options
	}: {
		children: ReactNode
		options: { fetchClientSecret: () => Promise<string> }
	}) {
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
	Elements: ({ children }: { children: ReactNode }) => children,
	PaymentElement: () => null,
	useStripe: () => null,
	useElements: () => null
}))

const session = installSubscriberSession('checkout-user', { account: 'free', resolved: true })
const { StripeCheckoutModal } = await import('../StripeCheckoutModal')
const createRequests = () => session.urls().filter((url) => url.endsWith('/subscription/create'))

test('offers a retry when the checkout session fails to load, then loads a fresh session', async () => {
	session.serveInOrder('/subscription/create', [
		fixtureStatus(500, { error: 'Checkout unavailable' }),
		{ clientSecret: 'cs_fixture' }
	])
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	const dialog = () => document.querySelector('[role="dialog"]')!
	try {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<StripeCheckoutModal isOpen onClose={() => {}} paymentMethod="stripe" type="api" />
				</session.Wrapper>
			)
		)
		await waitForUi(() => expect(dialog().querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
		expect(dialog().querySelector('[role="status"]')).toBeNull()

		const retry = Array.from(dialog().querySelectorAll('button')).find((button) => button.textContent === 'Try Again')!
		await act(async () => retry.click())
		await waitForUi(() => expect(dialog().textContent).toContain('Payment fields'))
		expect(dialog().querySelector('[role="alert"]')).toBeNull()
		expect(dialog().querySelector('[role="status"]')).toBeNull()
		expect(createRequests()).toHaveLength(2)
	} finally {
		await act(async () => root.unmount())
		host.remove()
	}
})

test('labels the wait while the checkout session loads', async () => {
	let answer!: (response: Response) => void
	session.serve({ '/subscription/create': () => new Promise<Response>((resolve) => (answer = resolve)) })
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	try {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<StripeCheckoutModal isOpen onClose={() => {}} paymentMethod="stripe" type="api" />
				</session.Wrapper>
			)
		)
		await waitForUi(() => expect(answer).toBeTypeOf('function'))
		expect(document.querySelector('[role="dialog"] [role="status"]')?.textContent).toContain('Loading checkout')
		await act(async () => answer(Response.json({ clientSecret: 'cs_fixture' })))
		await waitForUi(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Payment fields'))
		expect(document.querySelector('[role="dialog"] [role="status"]')).toBeNull()
	} finally {
		await act(async () => root.unmount())
		host.remove()
	}
})

test('closing after a failed checkout load asks for no new session until the dialog opens again', async () => {
	session.serveInOrder('/subscription/create', [fixtureStatus(500, { error: 'Checkout unavailable' })], {
		clientSecret: 'cs_fixture'
	})
	function Harness() {
		const [open, setOpen] = useState(true)
		return (
			<>
				<button type="button" onClick={() => setOpen(true)}>
					Open checkout
				</button>
				<StripeCheckoutModal isOpen={open} onClose={() => setOpen(false)} paymentMethod="stripe" type="api" />
			</>
		)
	}
	// The dialog fades out as it does in the browser, so its content stays mounted while it closes.
	const fade = document.head.appendChild(document.createElement('style'))
	fade.textContent = '[role="dialog"] { transition-property: opacity; transition-duration: 200ms; }'
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	const dialog = () => document.querySelector('[role="dialog"]')
	const button = (name: string) =>
		[...document.querySelectorAll('button')].find((element) => accessibleName(element) === name)!
	try {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<Harness />
				</session.Wrapper>
			)
		)
		await waitForUi(() => expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))

		await act(async () => button('Close dialog').click())
		await waitForUi(() => expect(dialog()).toBeNull())
		expect(createRequests()).toHaveLength(1)

		await act(async () => button('Open checkout').click())
		await waitForUi(() => expect(dialog()?.textContent).toContain('Payment fields'))
		expect(createRequests()).toHaveLength(2)
	} finally {
		await act(async () => root.unmount())
		host.remove()
		fade.remove()
	}
})
