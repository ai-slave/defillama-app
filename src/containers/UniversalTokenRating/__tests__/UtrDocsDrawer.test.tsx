// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { UtrDocsDrawer } from '../UtrDocsDrawer'

/** Tops, within the drawer's scroll body, of the sections inside the observer's band. The rest are out of it. */
let tops: Record<string, number>
const observers = new Set<FakeIntersectionObserver>()

class FakeIntersectionObserver {
	targets: Array<Element> = []
	constructor(private callback: IntersectionObserverCallback) {
		observers.add(this)
	}
	observe(target: Element) {
		// A real observer reports every target once, in one batch, after observation starts.
		if (this.targets.length === 0) queueMicrotask(() => this.report())
		this.targets.push(target)
	}
	unobserve() {}
	disconnect() {
		observers.delete(this)
	}
	report() {
		const entries = this.targets.map(
			(target) =>
				({
					target,
					isIntersecting: target.id in tops,
					boundingClientRect: { top: tops[target.id] ?? 0 } as DOMRectReadOnly
				}) as IntersectionObserverEntry
		)
		this.callback(entries, this as unknown as IntersectionObserver)
	}
}

let container: HTMLDivElement
let root: Root
/** Sections scrolled into view. Ariakit also scrolls the close button it focuses, which sits outside the body. */
let scrolledSections: Array<string>

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	tops = { 'utr-docs-preface': 0 }
	scrolledSections = []
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
		if (this.tagName === 'SECTION') scrolledSections.push(this.id)
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	observers.clear()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

// Ariakit observes focusable elements too, so the spy is the observer watching the chapters.
const chapterSpy = () => {
	const spy = [...observers].find((observer) => observer.targets.some((target) => target.id === 'utr-docs-preface'))
	if (!spy) throw new Error('The chapters are not observed yet')
	return spy
}
const currentChapter = () => document.querySelector('[role="dialog"] nav [aria-current="location"]')?.textContent

test('opening the docs on a chapter scrolls that chapter into view', async () => {
	await act(async () =>
		root.render(<UtrDocsDrawer open onClose={() => {}} initialChapterId="performance-axis" scoringConfig={null} />)
	)

	await waitForUi(() => expect(scrolledSections).toEqual(['utr-docs-performance-axis']))
})

test('the chapter nearest the top of the scrolled drawer is marked current', async () => {
	await act(async () => root.render(<UtrDocsDrawer open onClose={() => {}} scoringConfig={null} />))
	const spy = await waitForUi(chapterSpy)
	expect(currentChapter()).toBe('1. Preface')

	tops = { 'utr-docs-disclosure-axis': 40, 'utr-docs-performance-axis': 180 }
	await act(async () => spy.report())

	expect(currentChapter()).toBe('3. Disclosure Axis')
})
