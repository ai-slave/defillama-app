// @vitest-environment happy-dom
import { act, StrictMode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { buildDashboardLayout } from '../../dashboardLayout/buildDashboardLayout'
import {
	DASHBOARD_ITEM_REVEAL_EVENT,
	type DashboardItemRevealOptions,
	readDashboardItemIdFromHash,
	requestDashboardItemReveal,
	useDashboardItemDeepLink
} from '../useDashboardItemDeepLink'

const items: Array<DashboardItemConfig> = [
	{ id: 'tab-a', kind: 'section', title: 'A', displayAs: 'tab' },
	{ id: 'text-a', kind: 'text', content: 'A' },
	{ id: 'tab-b', kind: 'section', title: 'B', displayAs: 'tab' },
	{ id: 'text-b', kind: 'text', content: 'B' }
]
const layout = buildDashboardLayout(items)
const activeTabs: Array<string> = []
const noop = () => {}

function Harness({
	enabled = true,
	onRevealRequest
}: {
	enabled?: boolean
	onRevealRequest?: (itemId: string, options: DashboardItemRevealOptions) => void
}) {
	const [activeTabId, setActiveTabId] = useState('tab-a')
	useDashboardItemDeepLink({ layout, setActiveTab: setActiveTabId, enabled, onRevealRequest })
	activeTabs.push(activeTabId)
	const tab = layout.tabs?.find((candidate) => candidate.section.id === activeTabId)
	return (
		<div>
			{tab?.groups
				.flatMap((group) => group.items)
				.map((item) => (
					<div key={item.id} id={`item-${item.id}`}>
						{item.id}
					</div>
				))}
		</div>
	)
}

let root: Root
let container: HTMLDivElement
const scrollIntoView = vi.fn()

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
	HTMLElement.prototype.scrollIntoView = scrollIntoView
	scrollIntoView.mockClear()
	activeTabs.length = 0
	window.location.hash = ''
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

async function flushFrames(count: number) {
	await act(async () => {
		vi.advanceTimersByTime(count * 16)
	})
}

test('switches to the tab holding the hashed item, scrolls to it and highlights it briefly', async () => {
	window.location.hash = '#item=text-b'
	await act(async () => root.render(<Harness />))
	expect(activeTabs.at(-1)).toBe('tab-b')
	expect(scrollIntoView).not.toHaveBeenCalled()

	await flushFrames(3)
	expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center', behavior: 'smooth' })
	const target = scrollIntoView.mock.contexts[0] as HTMLElement
	expect(target.id).toBe('item-text-b')
	expect(target.dataset.arrived).toBe('true')

	await act(async () => {
		vi.advanceTimersByTime(2000)
	})
	expect(target.dataset.arrived).toBeUndefined()
})

test('asks the caller to reveal a hidden item and waits for it before scrolling', async () => {
	window.location.hash = '#item=text-a'
	const revealItem = vi.fn()
	function HiddenHarness({ hidden }: { hidden: boolean }) {
		useDashboardItemDeepLink({ layout, setActiveTab: noop, enabled: true, revealItem })
		return (
			<div hidden={hidden}>
				<div id="item-text-a">text-a</div>
			</div>
		)
	}
	await act(async () => root.render(<HiddenHarness hidden />))
	await flushFrames(10)
	expect(revealItem).toHaveBeenCalledWith('text-a')
	expect(scrollIntoView).not.toHaveBeenCalled()

	await act(async () => root.render(<HiddenHarness hidden={false} />))
	await flushFrames(5)
	expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center', behavior: 'smooth' })
	expect((scrollIntoView.mock.contexts[0] as HTMLElement).id).toBe('item-text-a')
})

test('reacts to hash changes after mount and ignores unrelated hashes', async () => {
	window.location.hash = '#tab=tab-b'
	await act(async () => root.render(<Harness />))
	await flushFrames(3)
	expect(scrollIntoView).not.toHaveBeenCalled()
	expect(activeTabs.at(-1)).toBe('tab-a')

	await act(async () => {
		window.location.hash = '#item=text-a'
		window.dispatchEvent(new Event('hashchange'))
	})
	await flushFrames(3)
	expect(scrollIntoView).toHaveBeenCalledOnce()
	expect((scrollIntoView.mock.contexts[0] as HTMLElement).id).toBe('item-text-a')
})

test('a repeated hashchange for the unchanged hash does not restart the reveal', async () => {
	window.location.hash = '#item=text-b'
	await act(async () => root.render(<Harness />))
	await flushFrames(3)
	expect(scrollIntoView).toHaveBeenCalledOnce()

	await act(async () => {
		window.dispatchEvent(new Event('hashchange'))
	})
	await flushFrames(3)
	expect(scrollIntoView).toHaveBeenCalledOnce()
})

test('does nothing while disabled', async () => {
	window.location.hash = '#item=text-b'
	await act(async () => root.render(<Harness enabled={false} />))
	await flushFrames(5)
	expect(scrollIntoView).not.toHaveBeenCalled()
	expect(activeTabs.at(-1)).toBe('tab-a')
})

test('readDashboardItemIdFromHash only accepts the item prefix', () => {
	expect(readDashboardItemIdFromHash('#item=chart-1')).toBe('chart-1')
	expect(readDashboardItemIdFromHash('#item=')).toBeNull()
	expect(readDashboardItemIdFromHash('#section-1')).toBeNull()
	expect(readDashboardItemIdFromHash('')).toBeNull()
})

test('a reveal request scrolls and highlights the item the way a hash does', async () => {
	await act(async () => root.render(<Harness />))
	await act(async () => requestDashboardItemReveal('text-b', { scroll: 'nearest' }))
	await flushFrames(3)
	expect(activeTabs.at(-1)).toBe('tab-b')
	expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', behavior: 'smooth' })
	const target = scrollIntoView.mock.contexts[0] as HTMLElement
	expect(target.id).toBe('item-text-b')
	expect(target.dataset.arrived).toBe('true')

	await act(async () => {
		vi.advanceTimersByTime(2000)
	})
	expect(target.dataset.arrived).toBeUndefined()
})

test('a reveal request that asks for the title hands its options to onRevealRequest', async () => {
	const onRevealRequest = vi.fn()
	await act(async () => root.render(<Harness onRevealRequest={onRevealRequest} />))
	await act(async () => {
		window.dispatchEvent(
			new CustomEvent(DASHBOARD_ITEM_REVEAL_EVENT, { detail: { itemId: 'text-a', focusTitle: true } })
		)
	})
	await flushFrames(3)
	expect(onRevealRequest).toHaveBeenCalledWith('text-a', { focusTitle: true })
	expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center', behavior: 'smooth' })
})

test('a reveal dispatched before the grid mounts is replayed once the listener arrives', async () => {
	requestDashboardItemReveal('text-b', { scroll: 'nearest' })
	await act(async () => root.render(<Harness />))
	await flushFrames(3)
	expect(activeTabs.at(-1)).toBe('tab-b')
	expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', behavior: 'smooth' })
	const target = scrollIntoView.mock.contexts[0] as HTMLElement
	expect(target.id).toBe('item-text-b')
	expect(target.dataset.arrived).toBe('true')
})

test('an unhandled reveal older than five seconds is dropped instead of hijacking the next mount', async () => {
	requestDashboardItemReveal('text-b')
	const staleNow = Date.now() + 6000
	const dateNow = vi.spyOn(Date, 'now').mockReturnValue(staleNow)
	try {
		await act(async () => root.render(<Harness />))
		await flushFrames(5)
		expect(scrollIntoView).not.toHaveBeenCalled()
		expect(activeTabs.at(-1)).toBe('tab-a')
	} finally {
		dateNow.mockRestore()
	}
})

test('a hash on the incoming page wins over a reveal left pending by the previous one', async () => {
	requestDashboardItemReveal('text-a')
	window.location.hash = '#item=text-b'
	await act(async () => root.render(<Harness />))
	await flushFrames(5)
	expect(scrollIntoView).toHaveBeenCalledOnce()
	expect((scrollIntoView.mock.contexts[0] as HTMLElement).id).toBe('item-text-b')
})

test('a reveal already handled while mounted is not replayed on the next mount', async () => {
	await act(async () => root.render(<Harness />))
	await act(async () => requestDashboardItemReveal('text-b'))
	await flushFrames(3)
	expect(scrollIntoView).toHaveBeenCalledOnce()

	await act(async () => root.unmount())
	root = createRoot(container)
	await act(async () => root.render(<Harness />))
	await flushFrames(5)
	expect(scrollIntoView).toHaveBeenCalledOnce()
})

test('a second reveal clears the highlight from the item it leaves behind', async () => {
	function TwoItems() {
		useDashboardItemDeepLink({ layout, setActiveTab: noop, enabled: true })
		return (
			<div>
				<div id="item-one">one</div>
				<div id="item-two">two</div>
			</div>
		)
	}
	await act(async () => root.render(<TwoItems />))
	await act(async () => requestDashboardItemReveal('one'))
	await flushFrames(3)
	const first = document.getElementById('item-one')!
	expect(first.dataset.arrived).toBe('true')

	await act(async () => requestDashboardItemReveal('two'))
	await flushFrames(3)
	const second = document.getElementById('item-two')!
	expect(second.dataset.arrived).toBe('true')
	expect(first.dataset.arrived).toBeUndefined()
})

test('a newer reveal replaces one still waiting for its item to appear', async () => {
	function LateItem({ showFirst }: { showFirst: boolean }) {
		useDashboardItemDeepLink({ layout, setActiveTab: noop, enabled: true })
		return (
			<div>
				<div id="item-one" hidden={!showFirst}>
					one
				</div>
				<div id="item-two">two</div>
			</div>
		)
	}
	await act(async () => root.render(<LateItem showFirst={false} />))
	await act(async () => requestDashboardItemReveal('one'))
	await flushFrames(3)
	expect(scrollIntoView).not.toHaveBeenCalled()

	await act(async () => requestDashboardItemReveal('two'))
	await flushFrames(3)
	await act(async () => root.render(<LateItem showFirst />))
	await flushFrames(10)
	expect(scrollIntoView.mock.contexts.map((element) => (element as HTMLElement).id)).toEqual(['item-two'])
	expect(document.getElementById('item-one')!.dataset.arrived).toBeUndefined()
})

test('a hash reveal survives Strict Mode rehearsing an unmount', async () => {
	window.location.hash = '#item=text-b'
	await act(async () =>
		root.render(
			<StrictMode>
				<Harness />
			</StrictMode>
		)
	)
	await flushFrames(3)
	expect(scrollIntoView).toHaveBeenCalledOnce()
	expect((scrollIntoView.mock.contexts[0] as HTMLElement).id).toBe('item-text-b')
})

test('unmounting while a reveal waits for its item stops the reveal', async () => {
	function Listener() {
		useDashboardItemDeepLink({ layout, setActiveTab: noop, enabled: true })
		return null
	}
	const item = document.createElement('div')
	item.id = 'item-late'
	await act(async () => root.render(<Listener />))
	await act(async () => requestDashboardItemReveal('late'))
	await act(async () => root.unmount())
	root = createRoot(container)
	document.body.append(item)
	await flushFrames(10)
	expect(scrollIntoView).not.toHaveBeenCalled()
	expect(item.dataset.arrived).toBeUndefined()
	item.remove()
})
