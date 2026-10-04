// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { SelectWithCombobox } from '../SelectWithCombobox'

const router = vi.hoisted(() => ({
	pathname: '/fees',
	asPath: '/fees',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

const CATEGORIES = ['Dexs', 'Lending', 'Bridge']
// From 12 options the picker opens with a search field (searchThreshold.ts).
const SEARCHABLE_CATEGORIES = [
	...CATEGORIES,
	'CDP',
	'Yield',
	'Derivatives',
	'Liquid Staking',
	'RWA',
	'Options',
	'Farm',
	'Launchpad',
	'Oracle'
]

let container: HTMLDivElement
let root: Root

let labelType: 'smol' | 'regular' = 'smol'
let categories = CATEGORIES
const picker = () => (
	<SelectWithCombobox
		allValues={categories}
		includeQueryKey="category"
		excludeQueryKey="excludeCategory"
		label="Category"
		labelType={labelType}
		variant="filter"
		size="md"
	/>
)

// Shallow routing in the browser re-renders the page with the new query; the mock does the same.
router.push.mockImplementation(async ({ query }: { query: Record<string, string | Array<string>> }) => {
	router.query = query
	await act(async () => root.render(picker()))
})

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

const trigger = () => document.querySelector<HTMLButtonElement>('button[role="combobox"]')!
const selectAllRow = () =>
	[...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) =>
		option.textContent?.startsWith('Select all')
	)!
const selected = () =>
	[...document.querySelectorAll('[role="option"]')]
		.filter((option) => option.getAttribute('aria-selected') === 'true')
		.map((option) => option.textContent)

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	router.query = {}
	labelType = 'smol'
	categories = CATEGORIES
})

test('the Select all row shows how much the URL selects and writes all or none back to it', async () => {
	router.query = { excludeCategory: 'Lending' }
	await act(async () => root.render(picker()))
	await click(trigger())
	expect(selected()).toEqual(['Dexs', 'Bridge'])
	expect(selectAllRow().textContent).toBe('Select all, some selected')

	await click(selectAllRow())
	expect(router.query).toEqual({})
	expect(selected()).toEqual(['Dexs', 'Lending', 'Bridge'])
	expect(selectAllRow().textContent).toBe('Select all, all selected')

	await click(selectAllRow())
	expect(router.query).toEqual({ category: 'None' })
	expect(selected()).toEqual([])
	expect(selectAllRow().textContent).toBe('Select all')
})

test('names an empty or all-except selection on the trigger, so a filter never looks like the default', async () => {
	labelType = 'regular'
	router.query = { excludeCategory: 'Lending' }
	await act(async () => root.render(picker()))
	expect(trigger().textContent).toBe('Category: All except Lending')

	router.query = { category: 'None' }
	await act(async () => root.render(picker()))
	expect(trigger().textContent).toBe('Category: None')

	router.query = { category: 'Dexs' }
	await act(async () => root.render(picker()))
	expect(trigger().textContent).toBe('Category: Dexs')
})

async function press(key: string) {
	const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!
	await act(async () => {
		input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		await Promise.resolve()
	})
}

test("a keyboard reader reaches an option's Only with the right arrow and selects just that option", async () => {
	// Nothing selected, so the list opens without an active option.
	categories = SEARCHABLE_CATEGORIES
	router.query = { category: 'None' }
	await act(async () => root.render(picker()))
	await click(trigger())
	await waitForUi(() => expect(document.activeElement?.getAttribute('role')).toBe('combobox'))
	// Select all, then Dexs, then the Only beside Dexs.
	await press('ArrowDown')
	await press('ArrowDown')
	await press('ArrowRight')
	await waitForUi(() =>
		expect(document.querySelector('[data-active-item]')?.getAttribute('aria-label')).toBe('Only Dexs')
	)
	await press('Enter')
	expect(router.query).toEqual({ category: 'Dexs' })
})
