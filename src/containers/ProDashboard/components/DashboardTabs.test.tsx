// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardLayoutTab } from '../dashboardLayout/buildDashboardLayout'
import { DashboardTabs } from './DashboardTabs'

const tabs: Array<DashboardLayoutTab> = [
	{
		section: { id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		groups: [{ heading: null, items: [{ id: 'text-a', kind: 'text', content: 'In first' }] }]
	},
	{
		section: { id: 'tab-b', kind: 'section', title: 'Second', displayAs: 'tab', description: 'Second section' },
		groups: [{ heading: null, items: [{ id: 'text-b', kind: 'text', content: 'In second' }] }]
	}
]

const onChange = vi.fn()
const metrics = { scrollWidth: 0, clientWidth: 0, scrollLeft: 0 }
const scrollBy = vi.fn()
const scrollTo = vi.fn()
const scrollIntoView = vi.fn()

function Harness() {
	const [activeTabId, setActiveTabId] = useState('tab-a')
	return (
		<DashboardTabs
			tabs={tabs}
			activeTabId={activeTabId}
			onChange={(tabId) => {
				onChange(tabId)
				setActiveTabId(tabId)
			}}
			renderTab={(tab) => <p>{tab.groups[0]?.items[0]?.id === 'text-a' ? 'In first' : 'In second'}</p>}
		/>
	)
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	onChange.mockClear()
	scrollBy.mockClear()
	scrollTo.mockClear()
	scrollIntoView.mockClear()
	metrics.scrollWidth = 0
	metrics.clientWidth = 0
	metrics.scrollLeft = 0
	for (const property of ['scrollWidth', 'clientWidth', 'scrollLeft'] as const) {
		Object.defineProperty(HTMLElement.prototype, property, { configurable: true, get: () => metrics[property] })
	}
	Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, writable: true, value: scrollBy })
	Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, writable: true, value: scrollTo })
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		writable: true,
		value: scrollIntoView
	})
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		queueMicrotask(() => callback(0))
		return 1
	})
	vi.stubGlobal('cancelAnimationFrame', () => {})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
	for (const property of [
		'scrollWidth',
		'clientWidth',
		'scrollLeft',
		'scrollBy',
		'scrollTo',
		'scrollIntoView'
	] as const) {
		delete (HTMLElement.prototype as unknown as Record<string, unknown>)[property]
	}
})

async function flushFrames() {
	await act(async () => {})
}

function arrow(label: string) {
	return Array.from(container.querySelectorAll('button')).find((node) => node.getAttribute('aria-label') === label)
}

function tabButton(label: string) {
	const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
	expect(button).toBeDefined()
	return button!
}

test('clicking a tab mounts its panel and unmounts the previous one', async () => {
	await act(async () => root.render(<Harness />))
	expect(container.textContent).toContain('In first')
	expect(container.textContent).not.toContain('In second')
	expect(tabButton('First').getAttribute('data-active')).toBe('true')

	await act(async () => tabButton('Second').click())
	expect(onChange).toHaveBeenCalledExactlyOnceWith('tab-b')
	expect(container.textContent).toContain('In second')
	expect(container.textContent).not.toContain('In first')
	expect(tabButton('Second').getAttribute('data-active')).toBe('true')
	expect(tabButton('First').getAttribute('data-active')).toBe('false')
})

test('a tab with a description exposes it as its title', async () => {
	await act(async () => root.render(<Harness />))
	const tabList = container.querySelector('[aria-label="Dashboard sections"]')!
	const tabNodes = Array.from(tabList.querySelectorAll('button'))
	expect(tabNodes.map((node) => node.getAttribute('title'))).toEqual([null, 'Second section'])
})

test('tabs that fit carry no arrows, and overflowing tabs get arrows that page the list', async () => {
	const tabList = () => container.querySelector('[aria-label="Dashboard sections"]')!
	await act(async () => root.render(<Harness />))
	await flushFrames()
	expect(arrow('Scroll tabs right')).toBeUndefined()
	expect(arrow('Scroll tabs left')).toBeUndefined()

	metrics.scrollWidth = 600
	metrics.clientWidth = 300
	await act(async () => tabList().dispatchEvent(new Event('scroll')))
	await flushFrames()
	expect(arrow('Scroll tabs left')).toBeUndefined()
	const right = arrow('Scroll tabs right')
	expect(right).toBeDefined()

	await act(async () => right!.click())
	expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' })

	metrics.scrollLeft = 240
	await act(async () => tabList().dispatchEvent(new Event('scroll')))
	await flushFrames()
	expect(arrow('Scroll tabs left')).toBeDefined()
})

test('the active tab is kept in view by scrolling an overflowing list sideways, never on first mount', async () => {
	metrics.scrollWidth = 600
	metrics.clientWidth = 300
	await act(async () => root.render(<Harness />))
	await flushFrames()
	expect(scrollTo).not.toHaveBeenCalled()
	expect(scrollIntoView).not.toHaveBeenCalled()

	// Once every tab fits, a tab change has nothing to scroll.
	metrics.scrollWidth = 300
	await act(async () => tabButton('Second').click())
	expect(scrollTo).not.toHaveBeenCalled()

	metrics.scrollWidth = 600
	await act(async () => tabButton('First').click())
	expect(scrollIntoView).not.toHaveBeenCalled()
	expect(scrollTo).toHaveBeenCalledOnce()
	const [request] = scrollTo.mock.calls[0] as [ScrollToOptions]
	expect(Object.keys(request).sort()).toEqual(['behavior', 'left'])
	expect(request.left).toBeGreaterThanOrEqual(0)
})
