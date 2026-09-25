import type { DetachedWindowAPI } from 'happy-dom'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CAPABILITIES } from '../../capabilities'
import { CapabilityChips } from '../input/CapabilityChips'
import { MobileToolsPopover } from '../input/MobileToolsPopover'

declare global {
	interface Window {
		happyDOM: DetachedWindowAPI
	}
}

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/ai/chat', query: {}, push: vi.fn() }) }))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	window.happyDOM.setViewport({ width: 1024, height: 768 })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function button(name: string) {
	return [...document.querySelectorAll<HTMLElement>('button,[role="menuitem"]')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name
	)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
async function press(el: HTMLElement, key: string) {
	await act(async () => {
		el.focus()
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
	})
}

test('category navigation updates one panel and selecting a prompt closes Explore', async () => {
	const select = vi.fn()
	await act(async () => root.render(<CapabilityChips onPromptSelect={select} isPending={false} />))
	const trigger = button('Explore')
	await click(trigger)
	const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
	await press(tabs[0], 'ArrowRight')
	await vi.waitFor(() => expect(tabs[1].getAttribute('aria-selected')).toBe('true'))
	expect(document.activeElement).toBe(tabs[1])
	const panel = document.querySelector('[role="tabpanel"]')!
	expect(panel.getAttribute('aria-labelledby')).toBe(tabs[1].id)
	expect(panel.textContent).toContain(CAPABILITIES[1].prompts[0])
	expect(select).not.toHaveBeenCalled()
	await click(button(CAPABILITIES[1].prompts[0]))
	expect(select).toHaveBeenCalledExactlyOnceWith(CAPABILITIES[1].prompts[0], CAPABILITIES[1].key)
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(document.querySelector('[role="tabpanel"]')).toBeNull()
})
test('mobile Explore returns to its parent tools on Escape and closes both after a prompt', async () => {
	window.happyDOM.setViewport({ width: 375, height: 812 })
	const select = vi.fn()
	await act(async () =>
		root.render(
			<MobileToolsPopover
				mode="quick"
				setMode={vi.fn()}
				onPromptSelect={select}
				onImageUploadClick={vi.fn()}
				isPending={false}
			/>
		)
	)
	const trigger = button('Open mobile tools')
	await click(trigger)
	const explore = button('Explore')
	await click(explore)
	expect(document.querySelector('[role="dialog"][aria-label="Explore AI capabilities"]')).not.toBeNull()
	const category = button('Category dropdown')
	await click(category)
	const search = document.querySelector<HTMLInputElement>('input[placeholder="Search categories…"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Yields')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]').length).toBe(1))
	await click(document.querySelector<HTMLElement>('[role="option"]')!)
	await vi.waitFor(() => expect(document.activeElement).toBe(category))
	expect(document.querySelector('[role="tabpanel"]')?.textContent).toContain(
		CAPABILITIES.find((c) => c.name === 'Yields')!.prompts[0]
	)
	await press(category, 'Escape')
	await vi.waitFor(() => expect(document.activeElement).toBe(explore))
	expect(document.querySelector('[role="tabpanel"]')).toBeNull()
	expect(select).not.toHaveBeenCalled()
	await click(explore)
	await click(button(CAPABILITIES[0].prompts[0]))
	expect(select).toHaveBeenCalledExactlyOnceWith(CAPABILITIES[0].prompts[0], CAPABILITIES[0].key)
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(document.querySelector('[role="menu"]')).toBeNull()
})

test('pointer movement does not activate a different category', async () => {
	await act(async () => root.render(<CapabilityChips onPromptSelect={vi.fn()} isPending={false} />))
	await click(button('Explore'))
	const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
	await act(async () => {
		tabs[1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
		await new Promise((resolve) => setTimeout(resolve, 120))
	})
	expect(tabs[0].getAttribute('aria-selected')).toBe('true')
	expect(tabs[1].getAttribute('aria-selected')).toBe('false')
	await click(tabs[1])
	expect(tabs[1].getAttribute('aria-selected')).toBe('true')
})
