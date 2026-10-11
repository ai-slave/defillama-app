// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ComboboxSurface } from '../PopoverSurface'
import { SearchField } from '../SearchField'

let root: Root
let host: HTMLDivElement

const FRUITS = ['Apple', 'Apricot', 'Banana']

// An on-page search with its results under the field, as Raises and the article pickers render it.
function FruitSearch() {
	const [search, setSearch] = useState('')
	const matches = FRUITS.filter((fruit) => fruit.toLowerCase().includes(search.toLowerCase()))
	return (
		<Ariakit.ComboboxProvider setInputValue={setSearch}>
			<SearchField combobox label="Search fruits" placeholder="Search fruits…" />
			<ComboboxSurface variant="search-results" sameWidth>
				{matches.map((fruit) => (
					<Ariakit.ComboboxItem key={fruit} value={fruit} />
				))}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}

function PlainSearch() {
	const [search, setSearch] = useState('')
	return <SearchField label="Search protocols" value={search} onChange={setSearch} />
}

beforeEach(() => {
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

const input = () => host.querySelector<HTMLInputElement>('input')!
const clearButton = () =>
	[...host.querySelectorAll<HTMLElement>('button')].find((button) => accessibleName(button) === 'Clear search')
const options = () => [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)

async function type(value: string) {
	await act(async () => {
		input().focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
		input().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('a combobox search field is named by its label and filters the results as the reader types', async () => {
	await act(async () => root.render(<FruitSearch />))
	expect(input().getAttribute('role')).toBe('combobox')
	expect(accessibleName(input())).toBe('Search fruits')
	expect(clearButton()).toBeUndefined()

	await type('ap')
	await waitForUi(() => expect(options()).toEqual(['Apple', 'Apricot']))
})

test('Escape closes the combobox results and keeps focus in the field', async () => {
	await act(async () => root.render(<FruitSearch />))
	await type('ban')
	await waitForUi(() => expect(options()).toEqual(['Banana']))

	await act(async () =>
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)

	await waitForUi(() => expect(input().getAttribute('aria-expanded')).toBe('false'))
	expect(document.activeElement).toBe(input())
})

test('clearing a combobox search empties the store text and returns focus to the field', async () => {
	await act(async () => root.render(<FruitSearch />))
	await type('ap')
	await waitForUi(() => expect(clearButton()).toBeDefined())

	await act(async () => {
		clearButton()!.focus()
		clearButton()!.click()
	})

	expect(input().value).toBe('')
	expect(clearButton()).toBeUndefined()
	expect(document.activeElement).toBe(input())
	// The store took the empty text, so the next letter filters from the whole list.
	await type('b')
	await waitForUi(() => expect(options()).toEqual(['Banana']))
})

test('clearing a plain search empties it and returns focus to the field', async () => {
	await act(async () => root.render(<PlainSearch />))
	expect(accessibleName(input())).toBe('Search protocols')
	await type('aave')

	await act(async () => {
		clearButton()!.focus()
		clearButton()!.click()
	})

	expect(input().value).toBe('')
	expect(clearButton()).toBeUndefined()
	expect(document.activeElement).toBe(input())
})
