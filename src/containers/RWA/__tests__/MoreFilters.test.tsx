// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { RWAAssetsMoreFilters } from '../Filters'
import { makeProps } from './filterProps'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/rwa', asPath: '/rwa', query: {}, push: vi.fn() }) }))

let phone = false
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query === '(max-width: 639px)' && phone,
		addEventListener: () => {},
		removeEventListener: () => {}
	}))
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})

const trigger = () => container.querySelector<HTMLButtonElement>('[data-filter-builder]')!
const chips = () => [...document.querySelectorAll('[data-filter-chip]')].map((chip) => chip.textContent)

// Category is narrowed through its inline picker, Types through More filters.
const props = makeProps({
	inlineFilters: ['categories', 'assetGroups', 'accessModels'],
	selections: { selectedCategories: ['Treasuries'], selectedTypes: ['Asset'] }
}) as Parameters<typeof RWAAssetsMoreFilters>[0]

async function openMoreFilters() {
	await act(async () => root.render(<RWAAssetsMoreFilters {...props} />))
	const name = accessibleName(trigger())
	await act(async () => trigger().click())
	return name
}

test('on phones the strip hides the inline pickers, so Filters counts and offers their filters', async () => {
	phone = true
	expect(await openMoreFilters()).toBe('Filters, 2 applied')
	expect(chips()).toEqual(expect.arrayContaining(['Asset Groups', 'Access Model']))
})

test('from sm More filters leaves the inline filters to their pickers', async () => {
	phone = false
	expect(await openMoreFilters()).toBe('More filters, 1 applied')
	expect(chips()).toContain('Platforms')
	expect(chips()).not.toContain('Asset Groups')
})
