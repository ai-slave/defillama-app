// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { UrlSearchInput } from '../UrlSearchInput'

let container: HTMLDivElement
let root: Root
const updateSearch = vi.fn<(search: string) => void>()

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers()
	updateSearch.mockReset()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

/** The router applies a pushed search a render or more after the push, as the URL it reads changes. */
const showUrlSearch = (search: string) =>
	act(async () =>
		root.render(
			<UrlSearchInput search={search} updateSearch={updateSearch} label="Search tokens" placeholder="Search tokens" />
		)
	)

const field = () => container.querySelector('input')!

async function type(value: string) {
	await act(async () => {
		field().value = value
		field().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

const waitForDebounce = () => act(async () => vi.advanceTimersByTime(300))

test('a letter typed while the URL catches up with the previous search stays in the field', async () => {
	await showUrlSearch('')
	await type('bit')
	await waitForDebounce()
	expect(updateSearch.mock.calls).toEqual([['bit']])

	await type('bitc')
	await showUrlSearch('bit')
	expect(field().value).toBe('bitc')

	await waitForDebounce()
	expect(updateSearch.mock.calls).toEqual([['bit'], ['bitc']])
	await showUrlSearch('bitc')
	expect(field().value).toBe('bitc')
})

test('a search cleared from outside the field, such as by removing its pill, clears the field and drops pending typing', async () => {
	await showUrlSearch('')
	await type('bit')
	await waitForDebounce()
	await showUrlSearch('bit')

	await type('bitc')
	await showUrlSearch('')
	expect(field().value).toBe('')

	await waitForDebounce()
	expect(updateSearch.mock.calls).toEqual([['bit']])
})
