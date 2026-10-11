// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { VirtualizedSelect } from '~/ui/VirtualizedSelect'
import { virtualViewport } from '~/utils/testing/virtualLayout'
import { waitForUi } from '~/utils/testing/waitForUi'

const select = vi.fn()
vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('grid refreshes visible rows after scrolling and shrinking or expanding results', async () => {
	const columns = [{ name: 'Name', type: 'VARCHAR' }]
	const rows = Array.from({ length: 100 }, (_, i) => [`Row ${String(i).padStart(3, '0')}`])
	const renderRows = async (nextRows: Array<Array<string>>) => {
		await act(async () => root.render(<ResultsGrid result={{ columns, rows: nextRows }} />))
	}
	await renderRows(rows)
	expect(container.textContent).toContain('Row 000')
	expect(container.textContent).not.toContain('Row 050')
	await act(async () => virtualViewport.scroll(1400, true))
	expect(container.textContent).toContain('Row 050')
	expect(container.textContent).not.toContain('Row 000')
	await act(async () => virtualViewport.scroll(0, false))
	expect(container.textContent).toContain('Row 000')
	await renderRows(rows.slice(0, 2))
	expect(container.textContent).not.toContain('Row 002')
	await renderRows([])
	expect(container.textContent).toContain('0 rows')
	await renderRows(rows)
	expect(container.textContent).toContain('Row 002')
	await renderRows(rows.map(([name]) => [`Updated ${name}`]))
	expect(container.textContent).toContain('Updated Row 000')
})

test('popover scrolling does not reset on rerender, and filtering and reopening refresh rows', async () => {
	const options = Array.from({ length: 100 }, (_, i) => ({
		value: String(i),
		label: `Option ${String(i).padStart(3, '0')}`
	}))
	const renderSelect = async (label: string) => {
		await act(async () =>
			root.render(
				<VirtualizedSelect
					variant="field"
					label={label}
					options={options}
					selectedValue={null}
					onChange={select}
					placeholder="Select…"
				/>
			)
		)
	}
	const trigger = container.querySelector.bind(container, 'button[role="combobox"]')
	const openList = async () => {
		const button = trigger()! as HTMLButtonElement
		await act(async () => button.focus())
		await act(async () =>
			button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
		)
		await waitForUi(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull())
		return document.querySelector('[role="listbox"]')!
	}
	await renderSelect('Choose')
	let list = await openList()
	expect(list.textContent).toContain('Option 000')
	await act(async () => virtualViewport.scroll(1850, true))
	expect(list.textContent).toContain('Option 050')
	expect(list.textContent).not.toContain('Option 000')
	await renderSelect('Choose an option')
	expect(list.textContent).toContain('Option 050')
	const search = document.querySelector<HTMLInputElement>('input[role="combobox"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Option 050')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await waitForUi(() => expect(document.querySelector('[role="listbox"]')!.textContent).toBe('Option 050'))
	const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
		(row) => row.textContent === 'Option 050'
	)!
	await act(async () => option.click())
	expect(select.mock.calls).toEqual([[{ value: '50', label: 'Option 050' }]])
	await waitForUi(() => expect(document.querySelector('[role="listbox"]')).toBeNull())
	list = await openList()
	expect(list.textContent).toContain('Option 000')
})
