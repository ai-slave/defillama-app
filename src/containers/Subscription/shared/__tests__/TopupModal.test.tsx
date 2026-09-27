// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TopupModal } from '../TopupModal'

// The card step lazy-loads Stripe; this stub holds the import open so the cold-load state is observable.
const cardCheckout = vi.hoisted(() => ({ load: vi.fn(), resolve: () => {} }))
vi.mock('../TopupStripeCheckout', async () => {
	cardCheckout.load()
	await new Promise<void>((resolve) => {
		cardCheckout.resolve = resolve
	})
	return { default: () => <div>Card checkout</div> }
})

const session = installSubscriberSession('buyer')
let topupReplies: Array<Promise<Response> | Response>
const topups = () =>
	session.requests
		.filter(({ url }) => url.pathname === '/topup/create')
		.map(({ init }) => JSON.parse(init!.body as string))
const unavailable = () => Response.json({ error: 'Checkout unavailable' }, { status: 503 })

let host: HTMLDivElement
let root: Root
beforeEach(() => {
	vi.clearAllMocks()
	topupReplies = []
	session.serve({ [`${AUTH_SERVER}/topup/create`]: () => topupReplies.shift()! })
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name
	)!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function enterAmount(value: string) {
	const input = document.querySelector<HTMLInputElement>('input')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function mount() {
	function Harness() {
		const [open, setOpen] = useState(false)
		return (
			<>
				<button type="button" onClick={() => setOpen(true)}>
					Open balance
				</button>
				{open ? <TopupModal isOpen onClose={() => setOpen(false)} /> : null}
			</>
		)
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
	await click('Open balance')
}

test('opens the amount form on the default amount without creating a payment', async () => {
	await mount()
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Top Up Balance')
	expect(document.querySelector('input')?.value).toBe('10')
	expect(topups()).toEqual([])
})

test('keeps back and close available during a cold checkout load, and does not reopen after it finishes', async () => {
	await mount()
	await click('$25')
	await click('Pay with Card')
	await waitForUi(() => expect(cardCheckout.load).toHaveBeenCalledOnce())
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Loading card payments…')
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Complete Payment')
	await click('Back to amount')
	expect(document.querySelector('input')?.value).toBe('25')
	await click('Pay with Card')
	await click('Close balance dialog')
	await act(async () => cardCheckout.resolve())
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	await click('Open balance')
	expect(document.querySelector('input')?.value).toBe('10')
	await click('Pay with Card')
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Card checkout')
	expect(document.querySelector('[role="status"]')).toBeNull()
	expect(topups()).toEqual([])
})

test('keeps a failed payment error visible on the card step with a route back to the amount', async () => {
	topupReplies.push(unavailable())
	await mount()
	await click('Pay with Crypto')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
	await click('Pay with Card')
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Checkout unavailable')
	await click('Back to amount')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(document.querySelector('input')?.value).toBe('10')
})

test('preset selection follows the numeric amount and a preset replaces a custom amount', async () => {
	await mount()
	await enterAmount('10.00')
	expect(document.querySelector('input')?.value).toBe('10.00')
	expect(button('$10').getAttribute('aria-pressed')).toBe('true')
	await enterAmount('12.50')
	expect(document.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0)
	await click('$25')
	expect(document.querySelector('input')?.value).toBe('25')
	expect(button('$25').getAttribute('aria-pressed')).toBe('true')
	expect(button('$10').getAttribute('aria-pressed')).toBe('false')
})

test.each([
	{ invalid: '0', valid: '1' },
	{ invalid: '501', valid: '500' }
])('$invalid explains why payment is unavailable and $valid recovers', async ({ invalid, valid }) => {
	await mount()
	const input = document.querySelector('input')!
	await enterAmount(invalid)
	expect(input.getAttribute('aria-invalid')).toBe('true')
	expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
		'Enter an amount between $1 and $500'
	)
	expect(button('Pay with Card').disabled).toBe(true)
	expect(button('Pay with Crypto').disabled).toBe(true)
	await enterAmount('')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(button('Pay with Card').disabled).toBe(true)
	await enterAmount(valid)
	expect(input.value).toBe(valid)
	expect(input.hasAttribute('aria-invalid')).toBe(false)
	expect(input.hasAttribute('aria-describedby')).toBe(false)
	expect(button('Pay with Card').disabled).toBe(false)
	expect(button('Pay with Crypto').disabled).toBe(false)
})

test('pending crypto checkout blocks duplicate actions and failure allows retry with a different amount', async () => {
	const request = Promise.withResolvers<Response>()
	topupReplies.push(request.promise, unavailable())
	await mount()
	await click('$25')
	await click('Pay with Crypto')
	const input = document.querySelector('input')!
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Redirecting…')
	expect(input.disabled).toBe(true)
	expect(button('$5').disabled).toBe(true)
	expect(button('Pay with Card').disabled).toBe(true)
	await click('Redirecting…')
	await click('Pay with Card')
	await waitForUi(() => expect(topups()).toHaveLength(1))
	expect(topups()[0]).toMatchObject({ amount: 25, provider: 'llamapay' })
	await act(async () => request.resolve(unavailable()))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
	expect(input.value).toBe('25')
	expect(input.disabled).toBe(false)
	expect(button('Pay with Card').disabled).toBe(false)
	await click('$5')
	await click('Pay with Crypto')
	await waitForUi(() => expect(button('Pay with Crypto').disabled).toBe(false))
	expect(topups()).toHaveLength(2)
	expect(topups()[1]).toMatchObject({ amount: 5, provider: 'llamapay' })
	expect(input.value).toBe('5')
})
