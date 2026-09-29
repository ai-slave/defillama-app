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

/** Section tops in the viewport. Borrow is last and short, so a jump to it stops with it low on the screen. */
let tops: Record<string, number>
/** Risks is tall, so it still fills the observer's band when the page stops at the bottom. */
const HEIGHTS: Record<string, number> = { 'token-overview': 600, 'token-risks': 1200, 'token-borrow': 300 }
let reportIntersections: () => void

class FakeIntersectionObserver {
	targets: Array<Element> = []
	constructor(callback: IntersectionObserverCallback) {
		reportIntersections = () =>
			callback(
				this.targets.map((target) => {
					const top = tops[target.id]
					// The observer's root spans 140px from the top to 60% of an 800px viewport.
					return {
						target,
						isIntersecting: top < 320 && top + HEIGHTS[target.id] > 140,
						boundingClientRect: { top } as DOMRectReadOnly
					} as IntersectionObserverEntry
				}),
				this as unknown as IntersectionObserver
			)
	}
	observe(target: Element) {
		this.targets.push(target)
	}
	disconnect() {}
}

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
		return { top: tops[this.id] ?? 0, left: 0, width: 0, height: 0 } as DOMRect
	})
	tops = { 'token-overview': 98, 'token-risks': 698, 'token-borrow': 1898 }
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<>
				<TokenPageSectionNav sections={SECTIONS} />
				{SECTIONS.map((section) => (
					<section key={section.id} id={section.id} />
				))}
			</>
		)
	)
	await act(async () => reportIntersections())
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const highlighted = () => container.querySelector('[aria-current="location"]')?.textContent

async function jumpToBorrow() {
	await act(async () => (container.querySelector('a[href="#token-borrow"]') as HTMLAnchorElement).click())
	// The page cannot scroll far enough for Borrow to reach the top, and Risks still fills the band above it.
	tops = { 'token-overview': -1300, 'token-risks': -700, 'token-borrow': 500 }
}

test('clicking a section that cannot reach the top keeps it highlighted once the jump ends', async () => {
	await jumpToBorrow()
	// The browser reports the scroll's end before the observer reports the new positions.
	await act(async () => window.dispatchEvent(new Event('scrollend')))
	await act(async () => reportIntersections())

	expect(highlighted()).toBe('Borrow')
})

test('the section above a clicked one does not take the highlight while the reader has not scrolled', async () => {
	await jumpToBorrow()
	await act(async () => reportIntersections())
	// Late layout, such as a chart finishing, moves the sections without the reader scrolling.
	tops = { 'token-overview': -1250, 'token-risks': -650, 'token-borrow': 550 }
	await act(async () => reportIntersections())

	expect(highlighted()).toBe('Borrow')
})

test('scrolling back up with the wheel after clicking a section moves the highlight', async () => {
	await jumpToBorrow()
	await act(async () => reportIntersections())

	await act(async () => window.dispatchEvent(new WheelEvent('wheel', { deltaY: -400 })))
	tops = { 'token-overview': -500, 'token-risks': 100, 'token-borrow': 1300 }
	await act(async () => reportIntersections())

	expect(highlighted()).toBe('Risks')
})
