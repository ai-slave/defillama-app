// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DocsDrawer } from '../DocsDrawer'

test('navigates each contents entry to its section and lets the reader close the drawer', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const onClose = vi.fn()
	const scrolled: Array<Element> = []
	const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function () {
		scrolled.push(this)
	})
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<DocsDrawer open onClose={onClose} />))
		const dialog = document.querySelector('[role="dialog"]')!
		const entries = [...dialog.querySelectorAll<HTMLButtonElement>('nav button')]
		expect(entries.length).toBeGreaterThan(0)
		const destinations = new Set<Element>()
		await act(async () => {
			for (const entry of entries) {
				entry.click()
				const target = scrolled.at(-1)!
				destinations.add(target)
				expect(dialog.contains(target)).toBe(true)
				expect(target.textContent).toContain(entry.textContent!.replace(/^\d+\.\s*/, ''))
			}
		})
		expect(destinations.size).toBe(entries.length)
		await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click())
		expect(onClose).toHaveBeenCalledOnce()
	} finally {
		await act(async () => root.unmount())
		container.remove()
		scroll.mockRestore()
	}
})

test('the contents entry for the section nearest the top of the scrolled drawer is marked current', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	/** Tops, within the drawer's scroll body, of the sections inside the observer's band. */
	let tops: Record<string, number> = { overview: 0 }
	const spies: Array<{ report: () => void }> = []
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			targets: Array<Element> = []
			constructor(private callback: IntersectionObserverCallback) {}
			observe(target: Element) {
				// A real observer reports every target once, in one batch, after observation starts.
				if (this.targets.length === 0) queueMicrotask(() => this.report())
				this.targets.push(target)
				// Ariakit observes focusable elements too; the spy is the observer watching the sections.
				if (target.id === 'overview') spies.push(this)
			}
			unobserve() {}
			disconnect() {}
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
	)
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const current = () => document.querySelector('[role="dialog"] nav [aria-current="location"]')?.textContent
	try {
		await act(async () => root.render(<DocsDrawer open onClose={() => {}} />))
		const sectionSpy = await waitForUi(() => {
			if (spies.length === 0) throw new Error('The sections are not observed yet')
			return spies[0]
		})
		expect(current()).toBe('1. Overview')

		tops = { 'calculation-methodology': -300, 'how-to-interpret': 60 }
		await act(async () => sectionSpy.report())
		expect(current()).toBe('2. Calculation methodology')
	} finally {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	}
})
