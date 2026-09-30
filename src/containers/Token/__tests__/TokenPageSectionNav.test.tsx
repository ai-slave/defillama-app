// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TokenPageSectionNav } from '../TokenPageSectionNav'

const SECTIONS = [
	{ id: 'token-overview', label: 'Overview' },
	{ id: 'token-risks', label: 'Risks' },
	{ id: 'token-borrow', label: 'Borrow' }
]

/** Heading tops in the viewport. The page sets them as it scrolls; the nav reads them through the DOM. */
let tops: Record<string, number>
let reportBodyResize: () => void

class FakeResizeObserver {
	constructor(callback: ResizeObserverCallback) {
		reportBodyResize = () => callback([], this as unknown as ResizeObserver)
	}
	observe() {}
	disconnect() {}
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.stubGlobal('ResizeObserver', FakeResizeObserver)
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
		return { top: tops[this.id] ?? 0, left: 0, width: 0, height: 0 } as DOMRect
	})
	tops = { 'token-overview': 98, 'token-risks': 698, 'token-borrow': 1898 }
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

async function renderNav() {
	await act(async () =>
		root.render(
			<>
				<TokenPageSectionNav sections={SECTIONS} />
				{SECTIONS.map((section) => (
					<h2 key={section.id} id={section.id} />
				))}
			</>
		)
	)
}

async function scrollPage(nextTops: Record<string, number>) {
	tops = nextTops
	await act(async () => window.dispatchEvent(new Event('scroll')))
}

const highlighted = () => container.querySelector('[aria-current="location"]')?.textContent

async function jumpToBorrow() {
	await act(async () => (container.querySelector('a[href="#token-borrow"]') as HTMLAnchorElement).click())
	// The page cannot scroll far enough for Borrow to reach the top, and the Risks heading has passed the line.
	await scrollPage({ 'token-overview': -1300, 'token-risks': -700, 'token-borrow': 500 })
}

test('a page restored mid-scroll highlights the section it shows', async () => {
	tops = { 'token-overview': -900, 'token-risks': -300, 'token-borrow': 700 }
	await renderNav()

	expect(highlighted()).toBe('Risks')
})

test('the highlight follows the page when a scroll jumps past headings', async () => {
	await renderNav()

	// One jump carries the Risks heading from below the fold to well above the nav.
	await scrollPage({ 'token-overview': -1200, 'token-risks': -600, 'token-borrow': 600 })
	expect(highlighted()).toBe('Risks')

	await scrollPage({ 'token-overview': -1900, 'token-risks': -1300, 'token-borrow': 100 })
	expect(highlighted()).toBe('Borrow')

	await scrollPage({ 'token-overview': 98, 'token-risks': 698, 'token-borrow': 1898 })
	expect(highlighted()).toBe('Overview')
})

test('a section that grows above the reader without a scroll moves the highlight back to it', async () => {
	tops = { 'token-overview': -900, 'token-risks': -300, 'token-borrow': 700 }
	await renderNav()

	// The overview chart finishes loading and pushes the Risks heading back below the nav, with no scroll event.
	tops = { 'token-overview': -900, 'token-risks': 500, 'token-borrow': 1500 }
	await act(async () => reportBodyResize())

	expect(highlighted()).toBe('Overview')
})

test('clicking a section that cannot reach the top keeps it highlighted once the jump ends', async () => {
	await renderNav()
	await jumpToBorrow()
	await act(async () => window.dispatchEvent(new Event('scrollend')))

	expect(highlighted()).toBe('Borrow')
})

test('the section above a clicked one does not take the highlight while the reader has not scrolled', async () => {
	await renderNav()
	await jumpToBorrow()
	// Late layout, such as a chart finishing, moves the sections and the browser's scroll anchoring scrolls with them.
	await scrollPage({ 'token-overview': -1250, 'token-risks': -650, 'token-borrow': 550 })

	expect(highlighted()).toBe('Borrow')
})

test('scrolling back up with the wheel after clicking a section moves the highlight', async () => {
	await renderNav()
	await jumpToBorrow()

	await act(async () => window.dispatchEvent(new WheelEvent('wheel', { deltaY: -400 })))
	await scrollPage({ 'token-overview': -500, 'token-risks': 100, 'token-borrow': 1300 })

	expect(highlighted()).toBe('Risks')
})
