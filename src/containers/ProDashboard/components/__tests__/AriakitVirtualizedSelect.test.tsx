// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AriakitVirtualizedSelect } from '../AriakitVirtualizedSelect'

const viewport = vi.hoisted(() => ({ scroll: (_offset: number, _isScrolling: boolean) => {} }))
vi.mock('@tanstack/react-virtual', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@tanstack/react-virtual')>()
	return {
		...actual,
		useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) =>
			actual.useVirtualizer({
				...options,
				// happy-dom has no layout or scrolling; this stands in for the list's size and scroll position.
				observeElementRect: (_, callback) => {
					callback({ width: 300, height: 280 })
					return () => {}
				},
				observeElementOffset: (_, callback) => {
					viewport.scroll = callback
					callback(0, false)
					return () => {}
				},
				scrollToFn: (offset) => {
					viewport.scroll(offset, false)
				}
			})
	}
})

const options = Array.from({ length: 100 }, (_, i) => ({
	value: String(i),
	label: `Option ${String(i).padStart(3, '0')}`
}))
let root: Root
let container: HTMLDivElement
beforeEach(async () => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(<AriakitVirtualizedSelect label="Choose" options={options} selectedValue={null} onChange={vi.fn()} />)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const disclosure = () => container.querySelector<HTMLButtonElement>('button')!
const list = () => document.querySelector<HTMLElement>('[role="dialog"]')!

async function openScrolledDown() {
	await act(async () => disclosure().click())
	await act(async () => viewport.scroll(2200, true))
	expect(list().textContent).toContain('Option 050')
	expect(list().textContent).not.toContain('Option 000')
}

test('reopening the list after scrolling down starts at the first option', async () => {
	await openScrolledDown()
	await act(async () => disclosure().click())
	expect(list().hidden).toBe(true)

	await act(async () => disclosure().click())
	expect(list().hidden).toBe(false)
	expect(list().textContent).toContain('Option 000')
})

test('typing a search after scrolling down starts the results at the first match', async () => {
	await openScrolledDown()
	const search = list().querySelector<HTMLInputElement>('input')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Option')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(list().textContent).toContain('Option 000')
	expect(list().textContent).not.toContain('Option 050')
})
