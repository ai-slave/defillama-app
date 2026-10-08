// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { waitForUi } from '~/utils/testing/waitForUi'
import { FilterBuilder } from '../index'

// The shared Select reads the router for URL selections; these pickers hold local state.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }))

let container: HTMLDivElement
let root: Root
const changes = vi.fn()

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	changes.mockReset()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function Builder({ initial }: { initial: UnifiedTableFilters }) {
	const [filters, setFilters] = useState(initial)
	return (
		<FilterBuilder
			filters={filters}
			onFiltersChange={(next) => {
				changes(next)
				setFilters(next)
			}}
		/>
	)
}

const categoryHeader = (label: string) =>
	[...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((button) =>
		button.textContent?.startsWith(label)
	)!
const buttonNamed = (name: string) =>
	[...container.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name
	)
const field = (label: string) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)

async function type(label: string, text: string) {
	const input = field(label)!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function addTvlFilter() {
	await act(async () => root.render(<Builder initial={{}} />))
	const tvl = buttonNamed('TVL')!
	await act(async () => {
		tvl.focus()
		tvl.click()
	})
}

async function pressFocused(button: HTMLButtonElement) {
	await act(async () => {
		button.focus()
		button.click()
	})
}

async function pickOperator(label: string) {
	await act(async () => field('TVL operator')!.click())
	const option = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent === label)
		expect(found).toBeDefined()
		return found!
	})
	await act(async () => option.click())
}

test('a category that a search opened collapses when its header is clicked', async () => {
	await act(async () => root.render(<FilterBuilder filters={undefined} onFiltersChange={() => {}} />))
	expect(categoryHeader('Volume').getAttribute('aria-expanded')).toBe('false')

	await type('Search filters', 'volume')
	expect(categoryHeader('Volume').getAttribute('aria-expanded')).toBe('true')
	expect(buttonNamed('Volume (7d)')).toBeDefined()

	await act(async () => categoryHeader('Volume').click())

	expect(categoryHeader('Volume').getAttribute('aria-expanded')).toBe('false')
	expect(buttonNamed('Volume (7d)')).toBeUndefined()
})

test('Done on a new filter without a value removes it and returns focus to its option', async () => {
	await addTvlFilter()
	expect(field('TVL value')).not.toBeNull()
	const done = buttonNamed('Done')!
	await act(async () => {
		done.focus()
		done.click()
	})
	expect(field('TVL value')).toBeNull()
	expect(container.textContent).toContain('Active (0)')
	expect(document.activeElement).toBe(buttonNamed('TVL'))
})

test('Escape in a filter value closes the editor without reaching the dialog', async () => {
	const dialogEscape = vi.fn()
	document.addEventListener('keydown', dialogEscape)
	try {
		await addTvlFilter()
		const value = field('TVL value')!
		expect(document.activeElement).toBe(value)
		await act(async () => {
			value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		})
		expect(dialogEscape).not.toHaveBeenCalled()
		expect(field('TVL value')).toBeNull()
		expect(container.textContent).toContain('Active (0)')
		expect(document.activeElement).toBe(buttonNamed('TVL'))
	} finally {
		document.removeEventListener('keydown', dialogEscape)
	}
})

test('a new filter closed while its category is collapsed hands focus to the filter search', async () => {
	await addTvlFilter()
	await act(async () => buttonNamed('Collapse')!.click())
	const done = buttonNamed('Done')!
	await act(async () => {
		done.focus()
		done.click()
	})
	expect(buttonNamed('TVL')).toBeUndefined()
	expect(document.activeElement).toBe(field('Search filters'))
})

test('a range filter offers only the operators a saved table keeps', async () => {
	await addTvlFilter()
	await act(async () => field('TVL operator')!.click())
	const options = await waitForUi(() => {
		const found = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)
		expect(found.length).toBeGreaterThan(0)
		return found
	})
	expect(options).toEqual(['>=', '<=', 'between'])
})

test('a typed minimum saves, and between keeps it as both bounds until a maximum is typed', async () => {
	await addTvlFilter()
	await type('TVL value', '1m')
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 1_000_000 })

	await pickOperator('between')
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 1_000_000, tvlMax: 1_000_000 })
	// The fields swap with the operator and show the bounds the filter kept.
	expect(field('TVL minimum')!.value).toBe('1000000')
	expect(field('TVL maximum')!.value).toBe('1000000')

	await type('TVL maximum', '5m')
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 1_000_000, tvlMax: 5_000_000 })
	await type('TVL minimum', '9m')
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 5_000_000, tvlMax: 9_000_000 })
})

test('an added filter takes focus in its value, and Done hands it to the saved filter', async () => {
	await addTvlFilter()
	const value = field('TVL value')!
	expect(document.activeElement).toBe(value)
	await type('TVL value', '1m')
	const done = buttonNamed('Done')!
	await act(async () => {
		done.focus()
		done.click()
	})
	expect(document.activeElement?.textContent).toContain('TVL')
	expect(document.activeElement?.textContent).toContain('>= $1M')
})

test.each([
	['the next filter', 'Remove TVL filter', 'Remove Market Cap filter'],
	['the previous filter when the last one is removed', 'Remove Market Cap filter', 'Remove TVL filter']
])('removing a filter hands focus to the × of %s', async (_, removed, focused) => {
	await act(async () => root.render(<Builder initial={{ tvlMin: 1_000_000, mcapMin: 2_000_000 }} />))
	await pressFocused(buttonNamed(removed)!)
	expect(buttonNamed(removed)).toBeUndefined()
	expect(container.textContent).toContain('Active (1)')
	expect(document.activeElement).toBe(buttonNamed(focused))
})

test('removing the only filter hands focus back to its option', async () => {
	await act(async () => root.render(<Builder initial={{ tvlMin: 1_000_000 }} />))
	await pressFocused(buttonNamed('Remove TVL filter')!)
	expect(changes).toHaveBeenLastCalledWith({})
	expect(container.textContent).toContain('Active (0)')
	expect(document.activeElement).toBe(buttonNamed('TVL'))
})

test('Clear all leaves with the filters and hands focus to the filter search', async () => {
	await act(async () => root.render(<Builder initial={{ tvlMin: 1_000_000, mcapMin: 2_000_000 }} />))
	await pressFocused(buttonNamed('Clear all')!)
	expect(buttonNamed('Clear all')).toBeUndefined()
	expect(container.textContent).toContain('Active (0)')
	expect(document.activeElement).toBe(field('Search filters'))
})
