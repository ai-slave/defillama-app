// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PriceAlertEditor } from '../alerts/PriceAlertEditor'
import { PRICE_OPERATOR_OPTIONS, SegmentedToggle } from '../alerts/ui'
import { CreateAlertModal } from '../CreateAlertModal'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ai/chat' }) }))
vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)

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

test('an unlinked delivery channel says so under the delivery field; a rejected email save preserves the prefill', async () => {
	const store = await mountModal({
		prefill: { token_nk: 'coingecko:bitcoin', symbol: 'btc', value: 50_000, op: 'below' }
	})
	expect(radio('Alert type', 'Price alert').getAttribute('aria-checked')).toBe('true')
	expect(radio('Price comparison', 'Below').getAttribute('aria-checked')).toBe('true')
	const initialPrice = document.querySelector<HTMLInputElement>('[aria-label="Price"]')!.value
	const submit = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!
	const delivery = () => document.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Delivery channel"]')!
	const deliveryError = () => delivery().closest('[role="group"]')!.querySelector('.text-error')?.textContent ?? null
	await press(radio('Delivery channel', 'Email'), 'ArrowRight')
	expect(radio('Delivery channel', 'Telegram').getAttribute('aria-checked')).toBe('true')
	expect(submit().disabled).toBe(false)
	expect(deliveryError()).toBeNull()
	await act(async () => submit().click())
	expect(alertCreations()).toEqual([])
	expect(deliveryError()).toBe('Choose a linked channel.')
	expect(delivery().contains(document.activeElement)).toBe(true)
	await press(radio('Delivery channel', 'Telegram'), 'End')
	expect(radio('Delivery channel', 'Slack').getAttribute('aria-checked')).toBe('true')
	expect(deliveryError()).toBe('Choose a linked channel.')
	await press(radio('Delivery channel', 'Slack'), 'Home')
	expect(deliveryError()).toBeNull()
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

test('an alert refused at the plan cap moves focus to the upgrade step', async () => {
	session.serve({ [`${AI}/alerts`]: () => Response.json({ error: 'alert_cap_reached' }, { status: 403 }) })
	await mountModal({
		prefill: { token_nk: 'coingecko:bitcoin', symbol: 'btc', value: 50_000, op: 'below' }
	})
	await act(async () => {
		const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]')!
		submit.focus()
		submit.click()
		await settle()
	})
	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
	expect(dialog.querySelector('h2')?.textContent).toBe('Alert limit reached')
	expect(document.activeElement?.textContent).toBe('Upgrade to Pro')
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

test('segmented radios do not notify on mount or external changes, only on a pick', async () => {
	const onChange = vi.fn()
	const render = async (value: 'above' | 'below') =>
		act(async () =>
			root.render(
				<SegmentedToggle label="Comparison" options={PRICE_OPERATOR_OPTIONS} value={value} onChange={onChange} />
			)
		)
	await render('above')
	await render('below')
	expect(onChange).not.toHaveBeenCalled()
	await press(radio('Comparison', 'Below'), 'ArrowLeft')
	expect(onChange).toHaveBeenCalledExactlyOnceWith('above')
})

test('price editor saves the keyboard-selected operator and says what is wrong with an empty price', async () => {
	const onSave = vi.fn()
	await act(async () =>
		root.render(
			<PriceAlertEditor
				trigger={{ type: 'price', token_nk: 'coingecko:bitcoin', op: 'above', value: 100, recurring: true }}
				isSaving={false}
				fieldsInvalid={false}
				errorMessage={null}
				onCancel={vi.fn()}
				onSave={onSave}
			>
				{() => null}
			</PriceAlertEditor>
		)
	)
	await press(radio('Price comparison', 'Above'), 'ArrowRight')
	await input('[aria-label="Price"]', '')
	const price = container.querySelector<HTMLInputElement>('[aria-label="Price"]')!
	await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
	expect(onSave).not.toHaveBeenCalled()
	expect(document.activeElement).toBe(price)
	expect(document.getElementById(price.getAttribute('aria-describedby')!)!.textContent).toBe('Enter a price.')
	await input('[aria-label="Price"]', '200')
	expect(price.getAttribute('aria-invalid')).toBeNull()
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
	{ isSaving: true, fieldsInvalid: false },
	{ isSaving: false, fieldsInvalid: true }
])('price editor rejects form submission while blocked: %j', async (state) => {
	const onSave = vi.fn()
	const render = async (isSaving: boolean, fieldsInvalid: boolean) =>
		act(async () =>
			root.render(
				<PriceAlertEditor
					trigger={{ type: 'price', token_nk: 'coingecko:bitcoin', op: 'above', value: 100 }}
					isSaving={isSaving}
					fieldsInvalid={fieldsInvalid}
					errorMessage={null}
					onCancel={vi.fn()}
					onSave={onSave}
				>
					{() => null}
				</PriceAlertEditor>
			)
		)
	await render(state.isSaving, state.fieldsInvalid)
	await act(async () => {
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	expect(onSave).not.toHaveBeenCalled()
	await render(false, false)
	await act(async () => {
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	expect(onSave).toHaveBeenCalledTimes(1)
})

test('a price alert searches tokens on the server, sends the picked one, and locks the field while it saves', async () => {
	const save = Promise.withResolvers<Response>()
	session.serve({
		'/api/dynamic/pro-dashboard/tokens/search': [
			{ value: 'usdc', label: 'USD Coin (USDC)', logo: null, id: 'usd-coin', price: 1 }
		],
		[`${AI}/alerts`]: () => save.promise
	})
	await mountModal({ initialTab: 'price' })
	const token = () => document.querySelector<HTMLButtonElement>('button[role="combobox"]')!
	expect(token().textContent).toBe('Select token…')

	await press(token(), 'ArrowDown')
	await input('input[aria-label="Search Token"]', 'usd')
	await act(async () => settle())
	const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((row) =>
		row.textContent?.startsWith('USD Coin (USDC)')
	)!
	await act(async () => {
		option.click()
		await settle()
	})
	expect(token().textContent).toBe('USD Coin (USDC)')
	expect(session.urls().filter((url) => url.includes('tokens/search?query=usd'))).toHaveLength(1)

	await input('[aria-label="Price"]', '1.05')
	await act(async () => {
		document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
		await settle()
	})
	// The form's fieldset locks while the create runs; a native button inside it is disabled with it.
	expect(token().closest('fieldset')?.disabled).toBe(true)
	expect(alertCreations()).toEqual([
		expect.objectContaining({ trigger: expect.objectContaining({ token_nk: 'coingecko:usd-coin', value: 1.05 }) })
	])
	await act(async () => save.resolve(Response.json({ id: 'new', alertExpression: '', nextRunAt: '' })))
})

function buttonNamed(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name
	)!
}

test('closing a started alert asks first, and keeping it returns to the draft', async () => {
	const store = await mountModal()
	await input('textarea', 'Summarize Aave fees')
	await act(async () => buttonNamed('Cancel').click())
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard this alert?')
	await act(async () => buttonNamed('Keep editing').click())
	expect(store.getState().open).toBe(true)
	expect(document.querySelector('textarea')!.value).toBe('Summarize Aave fees')
	await act(async () => buttonNamed('Cancel').click())
	await act(async () => {
		buttonNamed('Discard').click()
		await settle()
	})
	expect(store.getState().open).toBe(false)
})

test('a retried Slack channel list keeps its error while retrying, then the channel picker takes focus', async () => {
	const retry = Promise.withResolvers<Response>()
	let online = false
	session.serve({
		[`${AI}/slack/workspaces`]: {
			workspaces: [{ team_id: 'T1', team_name: 'Llama Research', default_channel_id: 'C1', revoked: false }]
		},
		[`${AI}/slack/channels?team_id=T1`]: () => (online ? retry.promise : new Response('offline', { status: 503 }))
	})
	await mountModal()
	await press(radio('Delivery channel', 'Email'), 'End')
	await act(async () => {
		await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Slack channels'))
	})
	online = true
	const tryAgain = buttonNamed('Try again')
	await act(async () => {
		tryAgain.focus()
		tryAgain.click()
	})
	await act(async () => {
		await waitForUi(() => expect(tryAgain.textContent).toContain('Retrying…'))
	})
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Slack channels')
	await act(async () => retry.resolve(Response.json({ channels: [{ id: 'C1', name: 'alerts', is_private: false }] })))
	await act(async () => {
		await waitForUi(() => expect(document.activeElement).toBe(document.querySelector('[aria-label="Slack channel"]')))
	})
})

test('switching the alert type after a failed submit opens the other type quiet; its next submit marks it', async () => {
	await mountModal()
	const submit = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!
	const prompt = () => document.querySelector('textarea')!
	await act(async () => submit().click())
	expect(prompt().getAttribute('aria-invalid')).toBe('true')
	await press(radio('Alert type', 'Scheduled report'), 'ArrowRight')
	const price = document.querySelector<HTMLInputElement>('[aria-label="Price"]')!
	expect(price.getAttribute('aria-invalid')).toBeNull()
	expect(document.querySelector('[role="dialog"] .text-error')).toBeNull()
	await act(async () => submit().click())
	expect(document.querySelector('[role="dialog"] [aria-invalid="true"]')).not.toBeNull()
	await press(radio('Alert type', 'Price alert'), 'Home')
	expect(prompt().getAttribute('aria-invalid')).toBeNull()
	expect(alertCreations()).toEqual([])
})

test('a missing Slack workspace or channel focuses that picker, not the delivery channel toggle', async () => {
	session.serve({
		[`${AI}/slack/workspaces`]: {
			workspaces: [
				{ team_id: 'T1', team_name: 'Llama Research', default_channel_id: null, revoked: false },
				{ team_id: 'T2', team_name: 'Llama Ops', default_channel_id: null, revoked: false }
			]
		},
		[`${AI}/slack/channels?team_id=T1`]: { channels: [{ id: 'C1', name: 'alerts', is_private: false }] }
	})
	await mountModal()
	await input('textarea', 'Daily TVL movers')
	await press(radio('Delivery channel', 'Email'), 'End')
	const submit = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!
	const workspace = await waitForUi(() => {
		const select = document.querySelector<HTMLSelectElement>('[aria-label="Slack workspace"]')
		expect(select).not.toBeNull()
		return select!
	})
	await act(async () => submit().click())
	expect(document.activeElement).toBe(workspace)
	expect(workspace.getAttribute('aria-invalid')).toBe('true')
	await act(async () => {
		workspace.value = 'T1'
		workspace.dispatchEvent(new Event('change', { bubbles: true }))
	})
	expect(workspace.getAttribute('aria-invalid')).toBeNull()
	const channel = await waitForUi(() => {
		const select = document.querySelector<HTMLSelectElement>('[aria-label="Slack channel"]')
		expect(select).not.toBeNull()
		return select!
	})
	await act(async () => submit().click())
	expect(document.activeElement).toBe(channel)
	expect(channel.closest('[role="group"]')!.querySelector('.text-error')?.textContent).toBe('Choose a Slack channel.')
	expect(alertCreations()).toEqual([])
})
