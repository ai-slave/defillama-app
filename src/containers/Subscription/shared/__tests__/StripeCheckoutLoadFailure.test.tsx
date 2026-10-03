// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const originalKey = vi.hoisted(() => {
	const value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
	process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fixture'
	return value
})
afterAll(() => {
	if (originalKey === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
	else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalKey
})
// The Stripe script is blocked or fails, as an ad blocker or a flaky network leaves it.
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: () => Promise.reject(new Error('Failed to load Stripe.js')) }))
// Stripe's iframe and card fields cannot run in Node; these stand in for them if anything mounts them.
vi.mock('@stripe/react-stripe-js', () => ({
	EmbeddedCheckoutProvider: ({ children }: { children: ReactNode }) => children,
	EmbeddedCheckout: () => <div>Payment fields</div>,
	Elements: ({ children }: { children: ReactNode }) => children,
	PaymentElement: () => <div>Card fields</div>,
	useElements: () => ({})
}))

const session = installSubscriberSession('checkout-user', { account: 'free', resolved: true })
const { StripeCheckoutModal } = await import('../StripeCheckoutModal')
const { useStripeCheckout } = await import('../useStripeCheckout')
type CheckoutRequest = import('../useStripeCheckout').CheckoutRequest

function Caller({ request }: { request: CheckoutRequest }) {
	const checkout = useStripeCheckout()
	return (
		<>
			<button type="button" onClick={() => checkout.open(request)}>
				Subscribe
			</button>
			{checkout.isOpen ? <StripeCheckoutModal checkout={checkout} /> : null}
		</>
	)
}

async function openCheckout(request: CheckoutRequest) {
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Caller request={request} />
			</session.Wrapper>
		)
	)
	await act(async () => host.querySelector('button')!.click())
	return async () => {
		await act(async () => root.unmount())
		host.remove()
	}
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const buttonNamed = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
		(button) => accessibleName(button) === name
	)

test('a checkout whose Stripe script failed says card payments could not load instead of loading forever', async () => {
	session.serve({ '/subscription/create': { clientSecret: 'cs_fixture' } })
	const cleanup = await openCheckout({ type: 'api', billingInterval: 'month' })
	try {
		await waitForUi(() =>
			expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
				"Card payments couldn't load. Reload the page and try again."
			)
		)
		expect(dialog()!.textContent).not.toContain('Payment fields')
		expect(dialog()!.querySelector('[role="status"]')).toBeNull()
	} finally {
		await cleanup()
	}
})

test('an upgrade whose Stripe script failed says card payments could not load instead of a form that cannot pay', async () => {
	session.serve({
		'/subscription/create': { isUpgrade: true, requiresPayment: true, clientSecret: 'pi_upgrade_secret_fixture' }
	})
	const cleanup = await openCheckout({ type: 'api', billingInterval: 'year', isUpgradeFlow: true })
	try {
		await waitForUi(() =>
			expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
				"Card payments couldn't load. Reload the page and try again."
			)
		)
		expect(buttonNamed('Complete upgrade')).toBeUndefined()
		expect(dialog()!.textContent).not.toContain('Loading payment form')
	} finally {
		await cleanup()
	}
})
