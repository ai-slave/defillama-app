// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardSettingsModal } from '~/containers/ProDashboard/components/DashboardSettingsModal'
import { SubscriptionPricingSection } from '../sections/SubscriptionPricingSection'
import type { BillingCycle } from '../types'

const auth = vi.hoisted(() => ({ hasActiveSubscription: true }))
vi.mock('~/auth', () => ({ useAuthContext: () => auth }))
vi.mock('~/containers/Subscription/components', () => ({ PricingCard: () => null }))
let root: Root
let container: HTMLDivElement
const save = vi.fn()
const close = vi.fn()
beforeEach(() => {
	auth.hasActiveSubscription = true
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
			<DashboardSettingsModal
				isOpen={isOpen}
				onClose={close}
				dashboardName="Original"
				visibility={visibility}
				tags={[]}
				description=""
				dashboardId="test"
				onDashboardNameChange={vi.fn()}
				onVisibilityChange={vi.fn()}
				onTagsChange={vi.fn()}
				onDescriptionChange={vi.fn()}
				onSave={save}
			/>
		)
	)
}
test('visibility arrows update only the local draft; cancel and reopen discard it', async () => {
	await dashboard(true)
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Dashboard Settings')
	expect(save).not.toHaveBeenCalled()
	await press(radio('public'), 'ArrowRight')
	expect(radio('private').checked).toBe(true)
	expect(save).not.toHaveBeenCalled()
	await press(radio('private'), 'Escape')
	expect(close).toHaveBeenCalledOnce()
	await dashboard(false)
	await dashboard(true)
	expect(radio('public').checked).toBe(true)
	await press(radio('public'), 'ArrowRight')
	await act(async () =>
		document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	expect(save).toHaveBeenCalledExactlyOnceWith({
		dashboardName: 'Original',
		visibility: 'private',
		tags: [],
		description: ''
	})
})
test('an unavailable private selection remains intact while Public stays keyboard reachable', async () => {
	auth.hasActiveSubscription = false
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
	await act(async () => root.render(<Pricing />))
	expect(change).not.toHaveBeenCalled()
	await press(radio('yearly'), 'ArrowLeft')
	expect(radio('monthly').checked).toBe(true)
	expect(change).toHaveBeenCalledExactlyOnceWith('monthly')
	await act(async () => radio('monthly').click())
	expect(change).toHaveBeenCalledOnce()
	await press(radio('monthly'), 'ArrowRight')
	expect(radio('yearly').checked).toBe(true)
})
