// @vitest-environment happy-dom
import { act, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, expect, test, vi } from 'vitest'
import { TopupCheckoutLoading } from './TopupCheckoutLoading'

const checkout = vi.hoisted(() => {
	let resolve!: (stripe: object) => void
	return {
		stripe: new Promise<object>((done) => {
			resolve = done
		}),
		resolve: (stripe: object) => resolve(stripe),
		provider: vi.fn(),
		loadStripe: vi.fn()
	}
})
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
vi.mock('@stripe/stripe-js', () => ({ loadStripe: checkout.loadStripe }))
vi.mock('@stripe/react-stripe-js', () => ({
	EmbeddedCheckoutProvider: ({ children, ...props }: { children: ReactNode }) => {
		checkout.provider(props)
		return children
	},
	EmbeddedCheckout: () => <div>Payment fields</div>
}))

test('shows loading during SDK and session initialization, then passes the checkout callback through unchanged', async () => {
	checkout.loadStripe.mockReturnValue(checkout.stripe)
	const { default: TopupStripeCheckout } = await import('./TopupStripeCheckout')
	const host = document.createElement('div')
	document.body.append(host)
	const root = createRoot(host)
	const fetchClientSecret = vi.fn<() => Promise<string>>()
	const render = (isPending: boolean) =>
		root.render(
			<Suspense fallback={<TopupCheckoutLoading />}>
				<TopupStripeCheckout fetchClientSecret={fetchClientSecret} isPending={isPending} />
			</Suspense>
		)
	try {
		await act(async () => render(false))
		expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading card payments…')
		expect(checkout.provider).not.toHaveBeenCalled()
		await act(async () => checkout.resolve({}))
		expect(host.textContent).toBe('Payment fields')
		expect(checkout.provider).toHaveBeenLastCalledWith({ stripe: {}, options: { fetchClientSecret } })
		await act(async () => render(true))
		expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading card payments…')
		expect(host.querySelector('[aria-busy="true"]')).not.toBeNull()
		await act(async () => render(false))
		expect(host.querySelector('[role="status"]')).toBeNull()
		expect(host.textContent).toBe('Payment fields')
	} finally {
		await act(async () => root.unmount())
		host.remove()
	}
})

test('shows a recoverable message when the Stripe script fails to load', async () => {
	vi.resetModules()
	checkout.loadStripe.mockImplementationOnce(() => Promise.reject(new Error('Stripe script blocked')))
	const { default: TopupStripeCheckout } = await import('./TopupStripeCheckout')
	const host = document.createElement('div')
	document.body.append(host)
	const root = createRoot(host)
	try {
		await act(async () =>
			root.render(
				<Suspense fallback={<TopupCheckoutLoading />}>
					<TopupStripeCheckout fetchClientSecret={vi.fn()} isPending={false} />
				</Suspense>
			)
		)
		expect(host.querySelector('[role="alert"]')?.textContent).toContain('Card payments are unavailable')
		expect(host.querySelector('[role="status"]')).toBeNull()
	} finally {
		await act(async () => root.unmount())
		host.remove()
	}
})
