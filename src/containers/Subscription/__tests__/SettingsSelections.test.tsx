// @vitest-environment happy-dom
import { act, useState, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardSettingsModal } from '~/containers/ProDashboard/components/DashboardSettingsModal'
import type { DashboardSaveNotices } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { SubscriptionPricingSection } from '../sections/SubscriptionPricingSection'
import type { BillingCycle } from '../types'

vi.mock('~/containers/Subscription/components', () => ({ PricingCard: () => null }))
const session = installSubscriberSession('owner')
let root: Root
let container: HTMLDivElement
const save = vi.fn<ComponentProps<typeof DashboardSettingsModal>['onSave']>(async () => ({ refreshPending: false }))
const close = vi.fn()
const remove = vi.fn()
beforeEach(() => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function press(el: HTMLElement, key: string) {
	await act(async () => {
		el.focus()
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
function radio(value: string) {
	return document.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!
}
async function dashboard(isOpen: boolean, visibility: 'public' | 'private' = 'public') {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardSettingsModal
					isOpen={isOpen}
					onClose={close}
					dashboardName="Original"
					visibility={visibility}
					tags={[]}
					dashboardId="test"
					onSave={save}
					onDelete={remove}
				/>
			</session.Wrapper>
		)
	)
	// Private visibility stays locked until the subscription lookup settles.
	if (!isOpen) return
	await waitForUi(() => {
		if (radio('private').disabled === subscribed) throw new Error('The subscription lookup has not settled')
	})
}
let subscribed: boolean
beforeEach(() => {
	subscribed = true
})
test('visibility arrows update only the local draft; a confirmed discard and reopen drop it', async () => {
	await dashboard(true)
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Dashboard settings')
	expect(save).not.toHaveBeenCalled()
	await press(radio('public'), 'ArrowRight')
	expect(radio('private').checked).toBe(true)
	expect(save).not.toHaveBeenCalled()
	await press(radio('private'), 'Escape')
	// The changed visibility is unsaved work, so Escape asks first.
	expect(close).not.toHaveBeenCalled()
	await act(async () =>
		[...document.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.textContent === 'Discard')!
			.click()
	)
	expect(close).toHaveBeenCalledOnce()
	await dashboard(false)
	await dashboard(true)
	expect(radio('public').checked).toBe(true)
	await press(radio('public'), 'ArrowRight')
	await act(async () =>
		document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	expect(save).toHaveBeenCalledExactlyOnceWith({ visibility: 'private', tags: [] })
})
test('an unavailable private selection remains intact while Public stays keyboard reachable', async () => {
	subscribed = false
	session.serve({ '/subscription/status': fixtureStatus(404, { message: 'No active subscription' }) })
	await dashboard(true, 'private')
	expect(radio('private').checked).toBe(true)
	expect(radio('private').disabled).toBe(true)
	expect(radio('public').tabIndex).toBe(0)
	expect(save).not.toHaveBeenCalled()
	await act(async () => radio('public').click())
	await press(radio('public'), 'ArrowRight')
	expect(radio('public').checked).toBe(true)
})
test('billing arrows change the selected cycle once without a mount callback', async () => {
	const change = vi.fn()
	function Pricing() {
		const [value, setValue] = useState<BillingCycle>('yearly')
		return (
			<SubscriptionPricingSection
				pricingCards={[]}
				billingCycle={value}
				onBillingCycleChange={(next) => {
					change(next)
					setValue(next)
				}}
				onPrimaryCtaClick={vi.fn()}
			/>
		)
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Pricing />
			</session.Wrapper>
		)
	)
	expect(change).not.toHaveBeenCalled()
	await press(radio('yearly'), 'ArrowLeft')
	expect(radio('monthly').checked).toBe(true)
	expect(change).toHaveBeenCalledExactlyOnceWith('monthly')
	await act(async () => radio('monthly').click())
	expect(change).toHaveBeenCalledOnce()
	await press(radio('monthly'), 'ArrowRight')
	expect(radio('yearly').checked).toBe(true)
})

test('keeps dashboard settings after save failure and closes only after retry succeeds', async () => {
	const retry = Promise.withResolvers<DashboardSaveNotices>()
	save.mockRejectedValueOnce(new Error('Offline')).mockReturnValueOnce(retry.promise)
	await dashboard(true)
	await press(radio('public'), 'ArrowRight')
	const submit = async () => {
		await act(async () => {
			document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
			await new Promise((resolve) => setTimeout(resolve, 20))
		})
	}
	await submit()
	expect(close).not.toHaveBeenCalled()
	expect(radio('private').checked).toBe(true)
	expect(alertTexts(document.querySelector('[role="dialog"]')!)).toHaveLength(1)
	await submit()
	expect(document.querySelector('button[type="submit"]')!.getAttribute('aria-disabled')).toBe('true')
	await submit()
	expect(save).toHaveBeenCalledTimes(2)
	await act(async () => {
		retry.resolve({ refreshPending: false })
		await new Promise((resolve) => setTimeout(resolve, 20))
	})
	expect(close).toHaveBeenCalledOnce()
	expect(save.mock.calls[1][0].visibility).toBe('private')
})

test('dashboard deletion keeps its confirmation open on error and closes settings only after success', async () => {
	const request = Promise.withResolvers<void>()
	remove.mockReturnValueOnce(request.promise).mockResolvedValueOnce(undefined)
	await dashboard(true)
	const button = (name: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => accessibleName(e) === name)!
	await act(async () => button('Delete dashboard').click())
	await act(async () => button('Delete').click())
	await waitForUi(() => expect(button('Deleting…')).toBeDefined())
	expect(close).not.toHaveBeenCalled()
	await act(async () => request.reject(new Error('Offline')))
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"] [role="alert"]')).not.toBeNull())
	expect(document.querySelector('[role="alertdialog"]')?.textContent).not.toContain('Offline')
	await act(async () => button('Delete').click())
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(remove).toHaveBeenCalledTimes(2)
})
