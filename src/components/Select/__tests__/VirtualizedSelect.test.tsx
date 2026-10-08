// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { virtualViewport } from '~/utils/testing/virtualLayout'
import { waitForUi } from '~/utils/testing/waitForUi'
import { VirtualizedMultiSelect, VirtualizedSelect, type VirtualizedSelectOption } from '../VirtualizedSelect'

vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)

const OPTIONS: Array<VirtualizedSelectOption> = Array.from({ length: 200 }, (_, i) => ({
	value: `p${i}`,
	label: `Protocol ${String(i).padStart(3, '0')}`
}))

let root: Root
let host: HTMLDivElement
beforeEach(() => {
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

const trigger = () => document.querySelector<HTMLButtonElement>('button[role="combobox"]')!
const search = () => document.querySelector<HTMLInputElement>('input[role="combobox"]')!
const optionTexts = () => [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)
const activeOption = () => document.getElementById(document.activeElement?.getAttribute('aria-activedescendant') ?? '')
const nameFromLabels = (element: Element) =>
	element
		.getAttribute('aria-labelledby')!
		.split(' ')
		.map((id) => document.getElementById(id)!.textContent)
		.join(' ')

async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
	})
}

async function open() {
	await act(async () => trigger().focus())
	await press(trigger(), 'ArrowDown')
	await waitForUi(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull())
}

async function type(value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search(), value)
		search().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

function SinglePicker({ initial = null, onPick }: { initial?: string | null; onPick?: (value: string) => void }) {
	const [value, setValue] = useState(initial)
	return (
		<VirtualizedSelect
			variant="field"
			label="Protocol"
			options={OPTIONS}
			selectedValue={value}
			onChange={(option) => {
				setValue(option.value)
				onPick?.(option.value)
			}}
			placeholder="Select protocol…"
		/>
	)
}

test('the field is named by its visible label and the pick, and its search field has a name', async () => {
	await act(async () => root.render(<SinglePicker initial="p7" />))
	expect(nameFromLabels(trigger())).toBe('Protocol Protocol 007')

	await open()
	expect(search().getAttribute('aria-label')).toBe('Search Protocol')
	expect(document.querySelector('[role="listbox"]')).not.toBeNull()
})

test('with nothing picked the field shows its placeholder, and a pick takes its place', async () => {
	await act(async () => root.render(<SinglePicker />))
	expect(trigger().textContent).toBe('Select protocol…')

	await open()
	await act(async () => document.querySelector<HTMLElement>('[role="option"]')!.click())
	await waitForUi(() => expect(trigger().textContent).toBe('Protocol 000'))
})

test('arrow keys from the search field reach options past the rendered rows, and Enter picks one', async () => {
	const onPick = vi.fn()
	await act(async () => root.render(<SinglePicker onPick={onPick} />))
	await open()
	expect(optionTexts()).not.toContain('Protocol 040')

	for (let i = 0; i < 41; i++) await press(search(), 'ArrowDown')
	expect(activeOption()?.textContent).toBe('Protocol 040')

	await press(search(), 'Enter')
	await waitForUi(() => expect(trigger().getAttribute('aria-expanded')).toBe('false'))
	expect(onPick.mock.calls).toEqual([['p40']])
	expect(trigger().textContent).toBe('Protocol 040')
	expect(document.activeElement).toBe(trigger())
})

test('the list opens on the selected option, far down the list', async () => {
	await act(async () => root.render(<SinglePicker initial="p150" />))
	await open()

	expect(activeOption()?.textContent).toBe('Protocol 150')
	expect(activeOption()?.getAttribute('aria-selected')).toBe('true')
})

test('a new search starts its results at the top, wherever the list was scrolled', async () => {
	await act(async () => root.render(<SinglePicker />))
	await open()
	await act(async () => virtualViewport.scroll(5000, true))
	expect(optionTexts()).not.toContain('Protocol 001')

	await type('Protocol 0')
	await waitForUi(() => expect(optionTexts().slice(0, 2)).toEqual(['Protocol 000', 'Protocol 001']))
})

test('closing clears the search, so the next open shows every option', async () => {
	await act(async () => root.render(<SinglePicker />))
	await open()
	await type('Protocol 19')
	await waitForUi(() => expect(optionTexts()[0]).toBe('Protocol 190'))

	await press(search(), 'Escape')
	await waitForUi(() => expect(trigger().getAttribute('aria-expanded')).toBe('false'))
	await open()
	expect(search().value).toBe('')
	expect(optionTexts()[0]).toBe('Protocol 000')
})

function MultiPicker({
	options = OPTIONS.slice(0, 5),
	maxSelections,
	onPick
}: {
	options?: Array<VirtualizedSelectOption>
	maxSelections?: number
	onPick: (values: Array<string>) => void
}) {
	const [values, setValues] = useState(['p3'])
	return (
		<VirtualizedMultiSelect
			label="Protocols"
			options={options}
			selectedValues={values}
			onChange={(next) => {
				setValues(next)
				onPick(next)
			}}
			placeholder="Select protocols…"
			maxSelections={maxSelections}
		/>
	)
}

async function clickOption(text: string) {
	const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((row) =>
		row.textContent?.startsWith(text)
	)!
	await act(async () => option.click())
}

test('Select all picks every option, then clears them, and with a search acts on the shown ones', async () => {
	const onPick = vi.fn()
	await act(async () => root.render(<MultiPicker options={OPTIONS.slice(0, 12)} onPick={onPick} />))
	await open()

	await clickOption('Select all')
	await clickOption('Select all')
	await type('Protocol 001')
	await waitForUi(() => expect(optionTexts()).toEqual(['Select all shown', 'Protocol 001']))
	await clickOption('Select all shown')

	expect(onPick.mock.calls).toEqual([
		[['p3', 'p0', 'p1', 'p2', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11']],
		[[]],
		[['p1']]
	])
	expect(trigger().getAttribute('aria-expanded')).toBe('true')
})

test('a list under 12 options opens without a search field, and arrow keys pick from the trigger', async () => {
	const onPick = vi.fn()
	await act(async () =>
		root.render(
			<VirtualizedSelect
				variant="field"
				label="Chart type"
				options={OPTIONS.slice(0, 3)}
				selectedValue="p1"
				onChange={(option) => onPick(option.value)}
				placeholder="Select chart type…"
			/>
		)
	)
	await open()
	expect(document.querySelector('input')).toBeNull()
	expect(activeOption()?.textContent).toBe('Protocol 001')

	await press(document.activeElement as HTMLElement, 'ArrowDown')
	await press(document.activeElement as HTMLElement, 'Enter')
	await waitForUi(() => expect(trigger().getAttribute('aria-expanded')).toBe('false'))
	expect(onPick.mock.calls).toEqual([['p2']])
	expect(document.activeElement).toBe(trigger())
})

test('a capped list that cannot pick every option leaves out Select all, and at the cap says why the rest are disabled', async () => {
	const onPick = vi.fn()
	await act(async () => root.render(<MultiPicker maxSelections={2} onPick={onPick} />))
	await open()
	expect(optionTexts()[0]).toBe('Protocol 000')

	await clickOption('Protocol 000')
	const disabled = [...document.querySelectorAll('[role="option"][aria-disabled="true"]')].map((row) => row.textContent)
	expect(disabled).toEqual(['Protocol 001', 'Protocol 002', 'Protocol 004'])
	expect(document.querySelector('[role="status"]')?.textContent).toBe('2 of 2 picked. Remove one to pick another.')

	await clickOption('Protocol 001')
	await clickOption('Protocol 003')
	expect(onPick.mock.calls).toEqual([[['p3', 'p0']], [['p0']]])
})

test('under a cap, Select all stays while every option still fits', async () => {
	const onPick = vi.fn()
	await act(async () => root.render(<MultiPicker maxSelections={5} onPick={onPick} />))
	await open()

	await clickOption('Select all')
	expect(onPick.mock.calls).toEqual([[['p3', 'p0', 'p1', 'p2', 'p4']]])
	expect(document.querySelector('[role="status"]')?.textContent).toBe('5 of 5 picked. Remove one to pick another.')
})

test('a server-searched picker reports the query and lists the options it is given unfiltered', async () => {
	const onSearchChange = vi.fn()
	await act(async () =>
		root.render(
			<VirtualizedSelect
				variant="field"
				label="Token"
				options={[{ value: 'usdc', label: 'USD Coin' }]}
				selectedValue={null}
				onChange={() => {}}
				onSearchChange={onSearchChange}
				placeholder="Select token…"
			/>
		)
	)
	await open()
	await type('usdc')

	await waitForUi(() => expect(onSearchChange.mock.calls).toEqual([['usdc']]))
	expect(optionTexts()).toEqual(['USD Coin'])
})
