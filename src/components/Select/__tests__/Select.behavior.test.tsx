// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NestedMenu } from '~/components/NestedMenu'
import { Select } from '../Select'
import { SelectWithCombobox } from '../SelectWithCombobox'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/' }) }))

const OPTIONS = [
	{ key: 'tvl', name: 'TVL' },
	{ key: 'fees', name: 'Fees' },
	{ key: 'volume', name: 'Volume' }
]
// Long enough that SelectWithCombobox shows its search field (isSearchable in searchThreshold.ts).
const LONG_OPTIONS = [...OPTIONS, ...Array.from({ length: 9 }, (_, i) => ({ key: `metric-${i}`, name: `Metric ${i}` }))]

function trigger() {
	return document.querySelector<HTMLButtonElement>('button[role="combobox"]')!
}

/** The options a user picks from, without the "Select all" row that leads a multi-select list or each row's "Only". */
function options() {
	return [...document.querySelectorAll<HTMLElement>('[role="option"]')].filter(
		(option) => !option.textContent?.startsWith('Select all') && option.textContent !== 'Only'
	)
}

function optionByText(text: string) {
	return options().find((option) => option.textContent?.includes(text))!
}

// React's value tracker ignores direct `value` writes, so go through the native setter.
async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

function ControlledMetrics({
	searchable = false,
	onChange
}: {
	searchable?: boolean
	onChange: (values: Array<string>) => void
}) {
	const [values, setValues] = useState(['tvl'])
	const Component = searchable ? SelectWithCombobox : Select
	return (
		<Component
			allValues={searchable ? LONG_OPTIONS : OPTIONS}
			selectedValues={values}
			setSelectedValues={(next) => {
				setValues(next)
				onChange(next)
			}}
			label="Metrics"
			variant="filter"
			size="md"
		/>
	)
}

function ControlledMetricsShort() {
	const [values, setValues] = useState(['tvl'])
	return (
		<SelectWithCombobox
			allValues={OPTIONS}
			selectedValues={values}
			setSelectedValues={setValues}
			label="Metrics"
			variant="filter"
			size="md"
		/>
	)
}

describe('Select on the Combobox module', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('toggles multi-select values through the store and marks selected options', async () => {
		const setSelectedValues = vi.fn()
		await act(async () => root.render(<ControlledMetrics onChange={setSelectedValues} />))

		expect(trigger().getAttribute('aria-expanded')).toBe('false')
		await click(trigger())
		expect(trigger().getAttribute('aria-expanded')).toBe('true')
		expect(document.querySelector('[role="listbox"]')).not.toBeNull()
		expect(optionByText('TVL').getAttribute('aria-selected')).toBe('true')
		expect(optionByText('Fees').getAttribute('aria-selected')).toBe('false')

		await click(optionByText('Fees'))
		expect(setSelectedValues).toHaveBeenLastCalledWith(['tvl', 'fees'])
		expect(optionByText('Fees').getAttribute('aria-selected')).toBe('true')
		// Multi-select popovers stay open after toggling an option.
		expect(trigger().getAttribute('aria-expanded')).toBe('true')

		await click(optionByText('TVL'))
		expect(setSelectedValues).toHaveBeenLastCalledWith(['fees'])
		expect(optionByText('TVL').getAttribute('aria-selected')).toBe('false')
	})

	test('"Only" is its own option in the row and selects just that value', async () => {
		const setSelectedValues = vi.fn()
		await act(async () => root.render(<ControlledMetrics onChange={setSelectedValues} />))

		await click(trigger())
		const only = document.querySelector<HTMLElement>('[role="option"][aria-label="Only Fees"]')!
		expect(only.closest('[role="option"]:not([aria-label])')).toBeNull()
		await click(only)
		expect(setSelectedValues).toHaveBeenLastCalledWith(['fees'])
	})

	test('selects a single value and closes the popover', async () => {
		const setSelectedValues = vi.fn()
		await act(async () =>
			root.render(
				<Select
					allValues={OPTIONS}
					selectedValues="tvl"
					setSelectedValues={setSelectedValues}
					label="Metric"
					variant="filter"
					size="md"
				/>
			)
		)

		await click(trigger())
		await click(optionByText('Volume'))
		expect(setSelectedValues).toHaveBeenLastCalledWith('volume')
		expect(trigger().getAttribute('aria-expanded')).toBe('false')
	})

	test('lists every option at once', async () => {
		await act(async () =>
			root.render(
				<Select
					allValues={Array.from({ length: 8 }, (_, index) => `Option ${index + 1}`)}
					selectedValues={[]}
					setSelectedValues={vi.fn()}
					label="Many"
					variant="filter"
					size="md"
				/>
			)
		)

		await click(trigger())
		expect(options().map((option) => option.textContent)).toEqual([
			'Option 1',
			'Option 2',
			'Option 3',
			'Option 4',
			'Option 5',
			'Option 6',
			'Option 7',
			'Option 8'
		])
	})
})

describe('SelectWithCombobox on one Combobox store', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('filters with the popover input and keeps the filter while toggling values', async () => {
		const setSelectedValues = vi.fn()
		await act(async () => root.render(<ControlledMetrics searchable onChange={setSelectedValues} />))

		await click(trigger())
		const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!
		expect(input).not.toBeNull()
		expect(options()).toHaveLength(12)

		await type(input, 'fe')
		expect(options()).toHaveLength(1)
		expect(optionByText('Fees').getAttribute('aria-selected')).toBe('false')

		await click(optionByText('Fees'))
		expect(setSelectedValues).toHaveBeenLastCalledWith(['tvl', 'fees'])
		expect(optionByText('Fees').getAttribute('aria-selected')).toBe('true')
		expect(input.value).toBe('fe')
		expect(trigger().getAttribute('aria-expanded')).toBe('true')
	})

	test('See more in a multi-select moves focus to the first newly shown option', async () => {
		const many = Array.from({ length: 25 }, (_, i) => ({ key: `protocol-${i + 1}`, name: `Protocol ${i + 1}` }))
		await act(async () =>
			root.render(
				<SelectWithCombobox
					allValues={many}
					selectedValues={[]}
					setSelectedValues={() => {}}
					label="Protocols"
					variant="filter"
					size="md"
				/>
			)
		)
		await click(trigger())
		const seeMore = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
			(option) => option.textContent === 'See more…'
		)!
		await click(seeMore)
		await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
		// The search field keeps DOM focus; the focused option is its active descendant.
		const active = document.activeElement!.getAttribute('aria-activedescendant')!
		expect(document.getElementById(active)?.textContent).toBe('Protocol 21')
	})

	test('a list under 12 options opens without a search field', async () => {
		await act(async () => root.render(<ControlledMetricsShort />))
		await click(trigger())
		expect(document.querySelector('input')).toBeNull()
		expect(options().map((option) => option.textContent)).toEqual(['TVL', 'Fees', 'Volume'])
	})

	test('renders the empty state with the typed filter', async () => {
		await act(async () =>
			root.render(
				<SelectWithCombobox
					allValues={LONG_OPTIONS}
					selectedValues={[]}
					setSelectedValues={vi.fn()}
					label="Metrics"
					variant="filter"
					size="md"
				/>
			)
		)

		await click(trigger())
		const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!
		await type(input, 'zzz')
		expect(document.querySelector('[role="status"]')?.textContent).toBe('No results found for "zzz"')
	})

	test('keeps the footer action when a search matches nothing', async () => {
		await act(async () =>
			root.render(
				<SelectWithCombobox
					allValues={LONG_OPTIONS}
					selectedValues={[]}
					setSelectedValues={vi.fn()}
					label="Columns"
					variant="filter"
					size="md"
					customFooter={<button type="button">Add Custom Column</button>}
				/>
			)
		)

		await click(trigger())
		await type(document.querySelector<HTMLInputElement>('input[role="combobox"]')!, 'zzz')
		expect(document.querySelector('[role="status"]')?.textContent).toBe('No results found for "zzz"')
		expect([...document.querySelectorAll('button')].map((button) => button.textContent)).toContain('Add Custom Column')
	})
})

function buttonByText(text: string) {
	return [...document.querySelectorAll<HTMLElement>('button')].find((button) => button.textContent === text)!
}

async function press(element: HTMLElement, key: string) {
	await act(async () => element.focus())
	await act(async () => {
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

function NestedFilters({ searchable = false, many = false, single = false }) {
	const [selectedValues, setSelectedValues] = useState(['tvl'])
	const [singleValue, setSingleValue] = useState('tvl')
	const Component = searchable ? SelectWithCombobox : Select
	return (
		<NestedMenu label="Filters">
			{single ? (
				<Select
					nestedMenu
					allValues={OPTIONS}
					selectedValues={singleValue}
					setSelectedValues={setSingleValue}
					label="Metrics"
					variant="filter"
					size="md"
				/>
			) : (
				<Component
					nestedMenu
					allValues={many ? Array.from({ length: 8 }, (_, i) => `Option ${i + 1}`) : OPTIONS}
					selectedValues={selectedValues}
					setSelectedValues={setSelectedValues}
					label="Metrics"
					variant="filter"
					size="md"
				/>
			)}
			<output>{single ? singleValue : selectedValues.join(',')}</output>
		</NestedMenu>
	)
}

describe('nested filter composition', () => {
	let container: HTMLDivElement
	let root: Root
	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})
	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	async function open(props: Parameters<typeof NestedFilters>[0] = {}) {
		await act(async () => root.render(<NestedFilters {...props} />))
		await click(buttonByText('Filters'))
		await click(buttonByText('Metrics'))
	}
	test('navigates plain checkable items with arrows, End and typeahead and updates controlled selection', async () => {
		await open()
		const items = [...document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')]
		expect(items).toHaveLength(3)
		expect(items[0].getAttribute('aria-checked')).toBe('true')
		await press(items[0], 'ArrowDown')
		expect(document.activeElement).toBe(items[1])
		await press(items[1], 'Enter')
		expect(items[1].getAttribute('aria-checked')).toBe('true')
		expect(document.querySelector('output')?.textContent).toBe('tvl,fees')
		await press(items[1], 'End')
		expect(document.activeElement).toBe(items[2])
		await press(items[2], 't')
		expect(document.activeElement).toBe(items[0])
		await click(items[0].querySelector('span')!)
		expect(items[0].getAttribute('aria-checked')).toBe('false')
		expect(document.querySelector('output')?.textContent).toBe('fees')
		await click(items[0].querySelector('span')!)
		expect(items[0].getAttribute('aria-checked')).toBe('true')
		expect(document.querySelector('output')?.textContent).toBe('fees,tvl')
		await press(items[0], 'ArrowLeft')
		expect(buttonByText('Metrics').getAttribute('aria-expanded')).toBe('false')
		expect(buttonByText('Filters').getAttribute('aria-expanded')).toBe('true')
	})
	test('keeps single selection exclusive and the nested menu open', async () => {
		await open({ single: true })
		const items = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
		expect(items).toHaveLength(3)
		await click(items[1])
		expect(items[0].getAttribute('aria-checked')).toBe('false')
		expect(items[1].getAttribute('aria-checked')).toBe('true')
		expect(document.querySelector('output')?.textContent).toBe('fees')
		expect(buttonByText('Metrics').getAttribute('aria-expanded')).toBe('true')
	})
	test('a nested select lists every option at once', async () => {
		await open({ many: true })
		expect([...document.querySelectorAll('[role="menuitemcheckbox"]')].map((item) => item.textContent)).toEqual(
			Array.from({ length: 8 }, (_, i) => `Option ${i + 1}`)
		)
	})
	test('says a nested search matched nothing', async () => {
		await open({ searchable: true })
		await type(document.querySelector<HTMLInputElement>('input[role="combobox"]')!, 'zzz')
		expect(options()).toHaveLength(0)
		expect(document.querySelector('[role="status"]')?.textContent).toBe('No results found for "zzz"')
	})
	test('keeps searchable nested options in the listbox and preserves search while toggling', async () => {
		await open({ searchable: true })
		const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!
		expect(options()).toHaveLength(3)
		expect(document.querySelector('[role="listbox"] [role="menuitem"]')).toBeNull()
		await click(input)
		await type(input, 'fe')
		expect(options()).toHaveLength(1)
		await click(optionByText('Fees'))
		expect(optionByText('Fees').getAttribute('aria-selected')).toBe('true')
		expect(input.value).toBe('fe')
		await click(optionByText('Fees'))
		expect(optionByText('Fees').getAttribute('aria-selected')).toBe('false')
		await click(document.querySelector<HTMLElement>('[aria-label="Back to parent menu"]')!)
		expect(buttonByText('Metrics').getAttribute('aria-expanded')).toBe('false')
		expect(buttonByText('Filters').getAttribute('aria-expanded')).toBe('true')
		await click(buttonByText('Metrics'))
		expect(document.querySelector<HTMLInputElement>('input[role="combobox"]')!.value).toBe('')
		const submenu = document.querySelector('[role="listbox"]')!.closest('[role="dialog"]')!
		await click(submenu.querySelector<HTMLElement>('button[aria-label="Close menu"]')!)
		expect(buttonByText('Filters').getAttribute('aria-expanded')).toBe('false')
	})
})
