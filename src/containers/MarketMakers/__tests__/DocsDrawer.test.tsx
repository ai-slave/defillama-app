// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
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
		await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click())
		expect(onClose).toHaveBeenCalledOnce()
	} finally {
		await act(async () => root.unmount())
		container.remove()
		scroll.mockRestore()
	}
})
