// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { waitForUi } from '~/utils/testing/waitForUi'
import { FilterBuilder } from '../FilterBuilder'

let root: Root
let container: HTMLDivElement
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

function Builder() {
	const [filters, setFilters] = useState<UnifiedTableFilters>({})
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

const buttonNamed = (name: string) =>
	[...container.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name
	)

async function addTvlFilter() {
	await act(async () => root.render(<Builder />))
	const tvl = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent?.trim() === 'TVL'
	)!
	await act(async () => tvl.click())
}

test('Done on a new filter without a value removes it', async () => {
	await addTvlFilter()
	expect(container.querySelector('[aria-label="TVL value"]')).not.toBeNull()
	await act(async () => buttonNamed('Done')!.click())
	expect(container.querySelector('[aria-label="TVL value"]')).toBeNull()
	expect(container.textContent).toContain('Active (0)')
})

test('Escape in a filter value closes the editor without reaching the dialog', async () => {
	const dialogEscape = vi.fn()
	document.addEventListener('keydown', dialogEscape)
	try {
		await addTvlFilter()
		const value = container.querySelector<HTMLInputElement>('[aria-label="TVL value"]')!
		await act(async () => {
			value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		})
		expect(dialogEscape).not.toHaveBeenCalled()
	} finally {
		document.removeEventListener('keydown', dialogEscape)
	}
})

test('a range filter offers only the operators a saved table keeps', async () => {
	await addTvlFilter()
	const operator = container.querySelector<HTMLElement>('[aria-label="TVL operator"]')!
	await act(async () => operator.click())
	const options = await waitForUi(() => {
		const found = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)
		expect(found.length).toBeGreaterThan(0)
		return found
	})
	expect(options).toEqual(['>=', '<=', 'between'])
})

test('a typed minimum saves, and between keeps it as both bounds until a maximum is typed', async () => {
	await addTvlFilter()
	const type = async (label: string, text: string) => {
		const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}
	await type('TVL value', '1m')
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 1_000_000 })

	await act(async () => container.querySelector<HTMLElement>('[aria-label="TVL operator"]')!.click())
	const between = await waitForUi(() => {
		const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
			(o) => o.textContent === 'between'
		)
		expect(option).toBeDefined()
		return option!
	})
	await act(async () => between.click())
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 1_000_000, tvlMax: 1_000_000 })

	await type('TVL maximum', '5m')
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 1_000_000, tvlMax: 5_000_000 })
	await type('TVL minimum', '9m')
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 5_000_000, tvlMax: 9_000_000 })
})

test('an added filter takes focus in its value, and Done hands it to the saved filter', async () => {
	await act(async () => root.render(<Builder />))
	const tvl = buttonNamed('TVL')!
	await act(async () => {
		tvl.focus()
		tvl.click()
	})
	const value = container.querySelector<HTMLInputElement>('[aria-label="TVL value"]')!
	expect(document.activeElement).toBe(value)
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(value, '1m')
		value.dispatchEvent(new Event('input', { bubbles: true }))
	})
	const done = buttonNamed('Done')!
	await act(async () => {
		done.focus()
		done.click()
	})
	expect(document.activeElement?.textContent).toContain('TVL')
	expect(document.activeElement?.textContent).toContain('>= $1M')
})

test('switching the operator shows the bounds the filter keeps in its fields', async () => {
	await addTvlFilter()
	const value = container.querySelector<HTMLInputElement>('[aria-label="TVL value"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(value, '1m')
		value.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => container.querySelector<HTMLElement>('[aria-label="TVL operator"]')!.click())
	const between = await waitForUi(() => {
		const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
			(o) => o.textContent === 'between'
		)
		expect(option).toBeDefined()
		return option!
	})
	await act(async () => between.click())
	expect(changes).toHaveBeenLastCalledWith({ tvlMin: 1_000_000, tvlMax: 1_000_000 })
	expect(container.querySelector<HTMLInputElement>('[aria-label="TVL minimum"]')!.value).toBe('1000000')
	expect(container.querySelector<HTMLInputElement>('[aria-label="TVL maximum"]')!.value).toBe('1000000')
})
