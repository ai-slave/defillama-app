// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TokensFiltersDialog } from '~/containers/Tokens/TokensFiltersDialog'
import { accessibleName } from '~/utils/testing/accessibleName'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function control(name: string) {
	return [...document.querySelectorAll<HTMLElement>('button, input')].find((el) => accessibleName(el) === name)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
function field(label: string) {
	return [...document.querySelectorAll('label')].find((el) => el.textContent === label)!.querySelector('input')!
}
const chips = () => [...document.querySelectorAll<HTMLButtonElement>('[data-filter-chip]')]

test('adding a filter keeps focus in the list, its fields are named, and Apply writes the draft', async () => {
	const change = vi.fn()
	await act(async () => root.render(<TokensFiltersDialog filters={[]} onFiltersChange={change} />))
	await click(control('Filters'))

	const rank = control('MCap Rank')
	const next = chips()[chips().indexOf(rank as HTMLButtonElement) + 1]
	await click(rank)
	expect(chips().includes(rank as HTMLButtonElement)).toBe(false)
	expect(document.activeElement).toBe(next)

	await type(field('MCap Rank minimum'), '10')
	await click(control('Apply'))
	expect(change).toHaveBeenCalledExactlyOnceWith([{ id: 'rank', min: 10, max: null }])
})

test('removing a filter moves focus to the active filters instead of the page', async () => {
	await act(async () =>
		root.render(<TokensFiltersDialog filters={[{ id: 'rank', min: 1, max: 100 }]} onFiltersChange={() => {}} />)
	)
	await click(control('Filters, 1 applied'))
	await click(control('Remove MCap Rank filter'))

	expect(control('Remove MCap Rank filter')).toBeUndefined()
	expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('filter-builder-active')
})
