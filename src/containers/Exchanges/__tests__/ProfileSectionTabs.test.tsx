// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProfileSectionTabs } from '../ExchangeProfile'
import type { ProfileTab } from '../queryState'

let container: HTMLDivElement
let root: Root
const change = vi.fn()
beforeEach(() => {
	change.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function render(activeTab: ProfileTab, hasReserves = false) {
	await act(async () =>
		root.render(
			<ProfileSectionTabs
				activeTab={activeTab}
				hasReserves={hasReserves}
				hasInformation
				onTabChange={change}
				panelId="profile-panel"
			>
				<input aria-label="Market search" defaultValue="ETH" />
			</ProfileSectionTabs>
		)
	)
}
function tabs() {
	return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
}
async function press(el: HTMLElement, key: string) {
	await act(async () => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
test('focus navigation does not change the route; activation waits for controlled selection', async () => {
	await render('markets', true)
	const [markets, reserves, information] = tabs()
	expect(tabs().map((tab) => tab.textContent)).toEqual(['Markets', 'Reserves', 'Information'])
	expect(change).not.toHaveBeenCalled()
	await act(async () => markets.focus())
	await press(markets, 'ArrowRight')
	expect(document.activeElement).toBe(reserves)
	expect(change).not.toHaveBeenCalled()
	await press(reserves, 'Enter')
	expect(change).toHaveBeenCalledExactlyOnceWith('reserves')
	expect(markets.getAttribute('aria-selected')).toBe('true')
	await render('reserves', true)
	const panel = container.querySelector('[role="tabpanel"]')!
	expect(panel.getAttribute('aria-labelledby')).toBe(reserves.id)
	expect(reserves.getAttribute('aria-controls')).toBe(panel.id)
	await press(reserves, 'End')
	expect(document.activeElement).toBe(information)
	await press(information, 'Home')
	expect(document.activeElement).toBe(markets)
})
test('external selection and optional tabs preserve the existing child lifetime', async () => {
	await render('information', true)
	const input = container.querySelector('input')!
	input.value = 'BTC'
	await render('markets')
	expect(tabs().map((tab) => tab.textContent)).toEqual(['Markets', 'Information'])
	expect(container.querySelector('input')).toBe(input)
	expect(input.value).toBe('BTC')
	expect(container.querySelector('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe(tabs()[0].id)
	expect(change).not.toHaveBeenCalled()
})
