// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { FilterBuilder } from '../index'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const categoryHeader = (label: string) =>
	[...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((button) =>
		button.textContent?.startsWith(label)
	)!
const filterOption = (label: string) =>
	[...container.querySelectorAll('button')].find((button) => button.textContent === label)

test('a category that a search opened collapses when its header is clicked', async () => {
	await act(async () => root.render(<FilterBuilder filters={undefined} onFiltersChange={() => {}} />))
	expect(categoryHeader('Volume').getAttribute('aria-expanded')).toBe('false')

	const search = container.querySelector<HTMLInputElement>('input[aria-label="Search filters"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'volume')
		search.dispatchEvent(new InputEvent('input', { bubbles: true }))
	})
	expect(categoryHeader('Volume').getAttribute('aria-expanded')).toBe('true')
	expect(filterOption('Volume (7d)')).toBeDefined()

	await act(async () => categoryHeader('Volume').click())

	expect(categoryHeader('Volume').getAttribute('aria-expanded')).toBe('false')
	expect(filterOption('Volume (7d)')).toBeUndefined()
})
