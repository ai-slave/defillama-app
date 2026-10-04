// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import { Dialog, DialogHeader } from '~/ui/Dialog'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TopupForm, TopupModal } from '../TopupModal'

// The card step lazy-loads Stripe; this stub holds the import open so the cold-load state is observable.
const cardCheckout = vi.hoisted(() => ({ load: vi.fn(), resolve: () => {} }))
vi.mock('../TopupStripeCheckout', async () => {
	cardCheckout.load()
	await new Promise<void>((resolve) => {
		cardCheckout.resolve = resolve
	})
	// Stripe asks for the client secret itself; the stub does it on a click so tests choose when.
	return {
		default: ({ fetchClientSecret }: { fetchClientSecret: () => Promise<string> }) => (
			<div>
				Card checkout
				<button type="button" onClick={() => void fetchClientSecret().catch(() => {})}>
					Start card session
				</button>
			</div>
		)
	}
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
	toast.remove()
})

function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)!
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
				<Toaster />
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
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Top up balance')
	expect(document.querySelector('input')?.value).toBe('10')
	expect(topups()).toEqual([])
})

test('keeps back and close available during a cold checkout load, and does not reopen after it finishes', async () => {
	await mount()
	await click('$25')
	await click('Pay with card')
	await waitForUi(() => expect(cardCheckout.load).toHaveBeenCalledOnce())
	expect(document.querySelector('[role="status"]')?.textContent).toContain('Loading card payments')
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Complete payment')
	await click('Back to amount')
	expect(document.querySelector('input')?.value).toBe('25')
	await click('Pay with card')
	await click('Close dialog')
	await act(async () => cardCheckout.resolve())
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	await click('Open balance')
	expect(document.querySelector('input')?.value).toBe('10')
	await click('Pay with card')
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Card checkout')
	expect(document.querySelector('[role="status"]')).toBeNull()
	expect(topups()).toEqual([])
})

test('a failed crypto payment does not carry over: Pay with Card mounts the card checkout without its error', async () => {
	topupReplies.push(unavailable())
	await mount()
	await click('Pay with crypto')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
	await click('Pay with card')
	await act(async () => cardCheckout.resolve())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Card checkout'))
	expect(document.querySelector('[role="alert"]')).toBeNull()
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
	expect(button('Pay with card').getAttribute('aria-disabled')).toBe('true')
	expect(button('Pay with crypto').disabled).toBe(true)
	await enterAmount('')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('Enter an amount')
	expect(button('Pay with card').getAttribute('aria-disabled')).toBe('true')
	expect(button('Pay with crypto').disabled).toBe(true)
	await enterAmount(valid)
	expect(input.value).toBe(valid)
	expect(input.hasAttribute('aria-invalid')).toBe(false)
	expect(input.hasAttribute('aria-describedby')).toBe(false)
	expect(button('Pay with card').getAttribute('aria-disabled')).toBeNull()
	expect(button('Pay with crypto').disabled).toBe(false)
})

test('pending crypto checkout blocks duplicate actions and failure allows retry with a different amount', async () => {
	const request = Promise.withResolvers<Response>()
	topupReplies.push(request.promise, unavailable())
	await mount()
	await click('$25')
	await click('Pay with crypto')
	const input = document.querySelector('input')!
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Redirecting…')
	expect(input.readOnly).toBe(true)
	expect(button('$5').disabled).toBe(true)
	expect(button('Pay with card').getAttribute('aria-disabled')).toBe('true')
	await click('Redirecting…')
	await click('Pay with card')
	await waitForUi(() => expect(topups()).toHaveLength(1))
	expect(topups()[0]).toMatchObject({ amount: 25, provider: 'llamapay' })
	await act(async () => request.resolve(unavailable()))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
	expect(input.value).toBe('25')
	expect(input.disabled).toBe(false)
	expect(button('Pay with card').getAttribute('aria-disabled')).toBeNull()
	await click('$5')
	await click('Pay with crypto')
	await waitForUi(() => expect(button('Pay with crypto').disabled).toBe(false))
	expect(topups()).toHaveLength(2)
	expect(topups()[1]).toMatchObject({ amount: 5, provider: 'llamapay' })
	expect(input.value).toBe('5')
})

test.each([
	{ closed: false, hash: '#llamapay-checkout' },
	{ closed: true, hash: '' }
])('a crypto checkout that resolves after closed=$closed leaves the page at hash "$hash"', async ({ closed, hash }) => {
	window.location.hash = ''
	const request = Promise.withResolvers<Response>()
	topupReplies.push(request.promise)
	await mount()
	await click('Pay with crypto')
	await waitForUi(() => expect(topups()).toHaveLength(1))
	if (closed) await click('Close dialog')
	// A same-page hash stands in for the checkout URL, so happy-dom records the redirect without loading a page.
	const checkoutUrl = `${window.location.href.split('#')[0]}#llamapay-checkout`
	await act(async () => request.resolve(Response.json({ provider: 'llamapay', checkoutUrl })))
	// Settle the response body and the mutation callbacks before reading where the page went.
	for (let tick = 0; tick < 5; tick++) await act(async () => {})
	expect(window.location.hash).toBe(hash)
	window.location.hash = ''
})

test('a crypto checkout that fails after the dialog closes says so outside it', async () => {
	const request = Promise.withResolvers<Response>()
	topupReplies.push(request.promise)
	await mount()
	await click('Pay with crypto')
	await waitForUi(() => expect(topups()).toHaveLength(1))
	await click('Close dialog')
	await act(async () => request.resolve(unavailable()))

	await waitForUi(() => expect(document.body.textContent).toContain('Top-up failed: Checkout unavailable'))
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	expect(topups()).toHaveLength(1)
})

// LlamaAI Settings puts the form in a tab panel inside its dialog. The dialog here stays mounted once closed, the state
// Settings is in while it fades out.
async function mountInSettings() {
	function Settings() {
		const [open, setOpen] = useState(true)
		return (
			<>
				<Toaster />
				<Dialog size="md" open={open} onClose={() => setOpen(false)}>
					<DialogHeader title="Settings" />
					<Ariakit.TabProvider defaultSelectedId="balance">
						<Ariakit.TabList aria-label="Settings">
							<Ariakit.Tab id="balance">Balance</Ariakit.Tab>
						</Ariakit.TabList>
						<Ariakit.TabPanel tabId="balance">
							<TopupForm inDialog={false} redirectUrl="https://defillama.com/ai" cancelUrl="https://defillama.com/ai" />
						</Ariakit.TabPanel>
					</Ariakit.TabProvider>
				</Dialog>
			</>
		)
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Settings />
			</session.Wrapper>
		)
	)
}

test('a crypto checkout that resolves after Settings starts closing does not leave the page', async () => {
	window.location.hash = ''
	const request = Promise.withResolvers<Response>()
	topupReplies.push(request.promise)
	await mountInSettings()
	await click('Pay with crypto')
	await waitForUi(() => expect(topups()).toHaveLength(1))
	await click('Close dialog')
	const checkoutUrl = `${window.location.href.split('#')[0]}#llamapay-checkout`
	await act(async () => request.resolve(Response.json({ provider: 'llamapay', checkoutUrl })))
	for (let tick = 0; tick < 5; tick++) await act(async () => {})
	expect(window.location.hash).toBe('')
})

test('a crypto checkout that fails after Settings starts closing says so outside it', async () => {
	const request = Promise.withResolvers<Response>()
	topupReplies.push(request.promise)
	await mountInSettings()
	await click('Pay with crypto')
	await waitForUi(() => expect(topups()).toHaveLength(1))
	await click('Close dialog')
	await act(async () => request.resolve(unavailable()))

	await waitForUi(() => expect(document.body.textContent).toContain('Top-up failed: Checkout unavailable'))
})

test('in Settings, Back from an open card checkout asks before leaving it; before a session it goes straight back', async () => {
	topupReplies.push(Response.json({ provider: 'stripe', clientSecret: 'cs_topup' }))
	await mountInSettings()
	await click('Pay with card')
	await act(async () => cardCheckout.resolve())
	await waitForUi(() => expect(button('Start card session')).toBeDefined())
	await click('Back to amount')
	expect(document.querySelector('input')?.value).toBe('10')

	await click('Pay with card')
	await waitForUi(() => expect(button('Start card session')).toBeDefined())
	await click('Start card session')
	await waitForUi(() => expect(topups()).toHaveLength(1))
	await click('Back to amount')
	await waitForUi(() => expect(document.body.textContent).toContain('Leave checkout?'))
	await click('Keep paying')
	await waitForUi(() => expect(document.body.textContent).not.toContain('Leave checkout?'))
	expect(document.body.textContent).toContain('Card checkout')
})

test('a crypto checkout that fails while the dialog is open shows the error only in the dialog', async () => {
	topupReplies.push(unavailable())
	await mount()
	await click('Pay with crypto')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
	// Settle the toast store too, so a toast fired with the error would be on screen by now.
	for (let tick = 0; tick < 5; tick++) await act(async () => {})
	expect(document.body.textContent).not.toContain('Top-up failed')
})

test('a card checkout keeps its pending creation until it settles, so its failure shows in the dialog', async () => {
	const request = Promise.withResolvers<Response>()
	topupReplies.push(request.promise)
	await mount()
	await click('Pay with card')
	await act(async () => cardCheckout.resolve())
	await waitForUi(() => expect(button('Start card session')).toBeDefined())
	await click('Start card session')
	await waitForUi(() => expect(topups()).toHaveLength(1))

	await click('Back to amount')
	await act(async () => request.resolve(unavailable()))

	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Checkout unavailable'))
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Complete payment')
	expect(topups()).toEqual([expect.objectContaining({ amount: 10, provider: 'stripe' })])

	// Once settled, Back starts over: the next card attempt does not inherit the failure.
	await click('Back to amount')
	await click('Pay with card')
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Card checkout')
	expect(document.querySelector('[role="alert"]')).toBeNull()
})

test('once a card session exists, Escape and Back ask before leaving, and Leave runs the step they asked for', async () => {
	topupReplies.push(Response.json({ provider: 'stripe', clientSecret: 'cs_topup' }))
	await mount()
	await click('Pay with card')
	await act(async () => cardCheckout.resolve())
	await waitForUi(() => expect(button('Start card session')).toBeDefined())
	await click('Start card session')
	await waitForUi(() => expect(topups()).toHaveLength(1))

	const dialog = () => document.querySelector('[role="dialog"]')
	await act(async () =>
		dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	await waitForUi(() => expect(document.body.textContent).toContain('Leave checkout?'))
	await click('Keep paying')
	await waitForUi(() => expect(document.body.textContent).not.toContain('Leave checkout?'))
	expect(dialog()?.textContent).toContain('Card checkout')

	await click('Back to amount')
	await waitForUi(() => expect(document.body.textContent).toContain('Leave checkout?'))
	expect(dialog()?.textContent).toContain('Card checkout')
	await click('Leave')
	await waitForUi(() => expect(document.querySelector('input')?.value).toBe('10'))
	expect(dialog()?.textContent).toContain('Top up balance')
})

test('Pay with card hands focus to the card step Back, and Back hands it to the amount field', async () => {
	await mount()
	await act(async () => button('Pay with card').focus())
	await click('Pay with card')
	// The dialog's net hands the removed button's focus to its first control, the header's Back.
	await waitForUi(() => expect(document.activeElement).toBe(button('Back to amount')))

	await act(async () => button('Back to amount').focus())
	await click('Back to amount')
	expect(document.activeElement).toBe(document.querySelector('input'))
})
