// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { PriceAlertEditor } from '../alerts/PriceAlertEditor'
import { PRICE_OPERATOR_OPTIONS, SegmentedToggle } from '../alerts/ui'
import { CreateAlertModal } from '../CreateAlertModal'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ai/chat' }) }))

const session = installSubscriberSession('reader')
const AI = 'https://ai.llama.fi'
const alertCreations = () =>
	session.requests
		.filter((request) => request.url.href === `${AI}/alerts` && request.init?.method === 'POST')
		.map((request) => JSON.parse(request.init!.body as string))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	session.serve({
		[`${AI}/user/sessions`]: { sessions: [], hasMore: false },
		[`${AI}/telegram/status`]: { link: { state: 'unlinked' }, pending: null },
		[`${AI}/slack/status`]: { links: [], pending: null },
		[`${AI}/slack/workspaces`]: { workspaces: [] },
		'/api/dynamic/pro-dashboard/tokens/search': []
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 40))
}
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await settle()
	})
}
function radio(group: string, name: string) {
	return [
		...document.querySelectorAll<HTMLInputElement>(`[role="radiogroup"][aria-label="${group}"] input[type="radio"]`)
	].find((el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name)!
}
async function input(selector: string, value: string) {
	await act(async () => {
		const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
		const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
		Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
		el.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function mountModal(props: Partial<ComponentProps<typeof CreateAlertModal>> = {}) {
	let store: Ariakit.DialogStore
	function Harness() {
		store = Ariakit.useDialogStore({ defaultOpen: false })
		return (
			<session.Wrapper>
				<CreateAlertModal dialogStore={store} {...props} />
			</session.Wrapper>
		)
	}
	await act(async () => root.render(<Harness />))
	await act(async () => {
		store.show()
		await settle()
	})
	return store!
}

test('alert type arrows retain focus and drafts; reopening restores defaults', async () => {
	const store = await mountModal()
	expect(document.activeElement).toBe(document.querySelector('textarea'))
	expect(radio('Alert type', 'Scheduled report').getAttribute('aria-checked')).toBe('true')
	await input('textarea', 'Keep this report draft')
	await press(radio('Alert type', 'Scheduled report'), 'ArrowRight')
	const price = radio('Alert type', 'Price alert')
	expect(document.activeElement).toBe(price)
	expect(price.getAttribute('aria-checked')).toBe('true')
	expect(document.querySelector('textarea')!.value).toBe('Keep this report draft')
	await input('[aria-label="Price"]', '123')
	await press(radio('Price comparison', 'Above'), 'ArrowRight')
	expect(radio('Price comparison', 'Below').getAttribute('aria-checked')).toBe('true')
	await press(price, 'Home')
	expect(document.activeElement).toBe(radio('Alert type', 'Scheduled report'))
	expect(document.querySelector('textarea')!.value).toBe('Keep this report draft')
	await press(radio('Alert type', 'Scheduled report'), 'End')
	expect(document.querySelector<HTMLInputElement>('[aria-label="Price"]')!.value).toBe('123')
	expect(radio('Price comparison', 'Below').getAttribute('aria-checked')).toBe('true')
	await act(async () => {
		store.hide()
		await settle()
	})
	await act(async () => {
		store.show()
		await settle()
	})
	expect(radio('Alert type', 'Scheduled report').getAttribute('aria-checked')).toBe('true')
	expect(document.querySelector('textarea')!.value).toBe('')
	expect(document.activeElement).toBe(document.querySelector('textarea'))
	expect(alertCreations()).toEqual([])
})

test('unlinked delivery blocks submission; a rejected email save preserves the prefill', async () => {
	const store = await mountModal({
		prefill: { token_nk: 'coingecko:bitcoin', symbol: 'btc', value: 50_000, op: 'below' }
	})
	expect(radio('Alert type', 'Price alert').getAttribute('aria-checked')).toBe('true')
	expect(radio('Price comparison', 'Below').getAttribute('aria-checked')).toBe('true')
	const initialPrice = document.querySelector<HTMLInputElement>('[aria-label="Price"]')!.value
	const submit = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!
	expect(submit().disabled).toBe(false)
	await press(radio('Delivery channel', 'Email'), 'ArrowRight')
	expect(radio('Delivery channel', 'Telegram').getAttribute('aria-checked')).toBe('true')
	expect(submit().disabled).toBe(true)
	await act(async () => submit().click())
	expect(alertCreations()).toEqual([])
	await press(radio('Delivery channel', 'Telegram'), 'End')
	expect(radio('Delivery channel', 'Slack').getAttribute('aria-checked')).toBe('true')
	expect(submit().disabled).toBe(true)
	await press(radio('Delivery channel', 'Slack'), 'Home')
	expect(submit().disabled).toBe(false)
	session.serve({ [`${AI}/alerts`]: () => Response.json({ error: 'Test save failure' }, { status: 500 }) })
	await act(async () => {
		submit().click()
		await settle()
	})
	expect(alertCreations()).toEqual([
		expect.objectContaining({
			trigger: expect.objectContaining({ token_nk: 'coingecko:bitcoin', op: 'below', value: 50_000 }),
			delivery_channel: 'email'
		})
	])
	expect(store.getState().open).toBe(true)
	expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe(
		"Couldn't create the alert. Try again."
	)
	expect(document.querySelector<HTMLInputElement>('[aria-label="Price"]')!.value).toBe(initialPrice)
	expect(radio('Price comparison', 'Below').getAttribute('aria-checked')).toBe('true')
	await act(async () => {
		store.hide()
		await settle()
	})
	await act(async () => {
		store.show()
		await settle()
	})
	expect(radio('Price comparison', 'Below').getAttribute('aria-checked')).toBe('true')
	expect(radio('Delivery channel', 'Email').getAttribute('aria-checked')).toBe('true')
})

test('a created alert shows its outcome in the dialog until Done closes it', async () => {
	session.serve({
		[`${AI}/alerts`]: () => Response.json({ id: 'new', alertExpression: 'Daily at 9:00 UTC', nextRunAt: '' })
	})
	const store = await mountModal({
		prefill: { token_nk: 'coingecko:bitcoin', symbol: 'btc', value: 50_000, op: 'below' }
	})
	await act(async () => {
		document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
		await settle()
	})
	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
	expect(dialog.querySelector('h2')?.textContent).toBe('Alert created')
	expect(dialog.textContent).toContain('Fires once when BTC goes below $50,000, delivered to your email.')
	expect(store.getState().open).toBe(true)
	const done = [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Done')!
	await act(async () => {
		done.click()
		await settle()
	})
	expect(store.getState().open).toBe(false)
	expect(alertCreations()).toHaveLength(1)
})

test('while an alert is being created its fields cannot change what the outcome describes', async () => {
	const created = Promise.withResolvers<Response>()
	session.serve({ [`${AI}/alerts`]: () => created.promise })
	await mountModal({
		prefill: { token_nk: 'coingecko:bitcoin', symbol: 'btc', value: 50_000, op: 'below' }
	})
	await act(async () => {
		document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
		await settle()
	})
	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
	const fields = [...dialog.querySelectorAll<HTMLElement>('input, select, textarea')]
	expect(fields.length).toBeGreaterThan(0)
	// A browser disables every field inside a disabled fieldset; happy-dom does not compute that, so read it the same way.
	expect(fields.every((field) => field.matches(':disabled') || field.closest('fieldset[disabled]') !== null)).toBe(true)

	// The token picker is not a native field: clearing it with Backspace must do nothing while the create runs.
	const tokenLabel = [...dialog.querySelectorAll('label')].find((label) => label.textContent === 'Token')!
	const tokenInput = document.getElementById(tokenLabel.htmlFor)!
	await act(async () => {
		tokenInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
		await settle()
	})

	await act(async () => {
		created.resolve(Response.json({ id: 'new', alertExpression: '', nextRunAt: '' }))
		await settle()
	})
	expect(dialog.textContent).toContain('Fires once when BTC goes below $50,000, delivered to your email.')
})

test('segmented radios do not notify on mount or external changes and respect disabled state', async () => {
	const onChange = vi.fn()
	const render = async (value: 'above' | 'below', disabled: boolean) =>
		act(async () =>
			root.render(
				<SegmentedToggle
					label="Comparison"
					options={PRICE_OPERATOR_OPTIONS}
					value={value}
					onChange={onChange}
					disabled={disabled}
				/>
			)
		)
	await render('above', false)
	await render('below', false)
	expect(onChange).not.toHaveBeenCalled()
	await render('below', true)
	await act(async () => radio('Comparison', 'Above').click())
	await press(radio('Comparison', 'Below'), 'ArrowLeft')
	expect(onChange).not.toHaveBeenCalled()
	await render('below', false)
	await press(radio('Comparison', 'Below'), 'ArrowLeft')
	expect(onChange).toHaveBeenCalledExactlyOnceWith('above')
})

test('price editor saves the keyboard-selected operator and keeps invalid values disabled', async () => {
	const onSave = vi.fn()
	await act(async () =>
		root.render(
			<PriceAlertEditor
				trigger={{ type: 'price', token_nk: 'coingecko:bitcoin', op: 'above', value: 100, recurring: true }}
				isSaving={false}
				onCancel={vi.fn()}
				onSave={onSave}
			/>
		)
	)
	await press(radio('Price comparison', 'Above'), 'ArrowRight')
	await input('[aria-label="Price"]', '')
	expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true)
	await input('[aria-label="Price"]', '200')
	await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
	expect(onSave).toHaveBeenCalledExactlyOnceWith({
		type: 'price',
		token_nk: 'coingecko:bitcoin',
		op: 'below',
		value: 200,
		recurring: true
	})
})

test.each([
	{ isSaving: true, blockReason: null },
	{ isSaving: false, blockReason: 'Pick a Slack channel' }
])('price editor rejects form submission while blocked: %j', async (state) => {
	const onSave = vi.fn()
	const render = async (isSaving: boolean, blockReason: string | null) =>
		act(async () =>
			root.render(
				<PriceAlertEditor
					trigger={{ type: 'price', token_nk: 'coingecko:bitcoin', op: 'above', value: 100 }}
					isSaving={isSaving}
					blockReason={blockReason}
					onCancel={vi.fn()}
					onSave={onSave}
				/>
			)
		)
	await render(state.isSaving, state.blockReason)
	await act(async () => {
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	expect(onSave).not.toHaveBeenCalled()
	await render(false, null)
	await act(async () => {
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	expect(onSave).toHaveBeenCalledTimes(1)
})
