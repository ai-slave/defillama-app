// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { AriakitVirtualizedSelect } from '~/containers/ProDashboard/components/AriakitVirtualizedSelect'

const viewport = vi.hoisted(() => ({
	scroll: (_offset: number, _isScrolling: boolean) => {},
	select: vi.fn()
}))
vi.mock('@tanstack/react-virtual', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@tanstack/react-virtual')>()
	return {
		...actual,
		useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) =>
			actual.useVirtualizer({
				...options,
				// Supply layout missing from happy-dom, retaining the real virtualizer and its stable instance.
				observeElementRect: (_, callback) => {
					callback({ width: 300, height: 280 })
					return () => {}
				},
				observeElementOffset: (_, callback) => {
					viewport.scroll = callback
					callback(0, false)
					return () => {}
				},
				scrollToFn: (offset) => {
					viewport.scroll(offset, false)
				}
			})
	}
})

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
	await act(async () => viewport.scroll(1400, true))
	expect(container.textContent).toContain('Row 050')
	expect(container.textContent).not.toContain('Row 000')
	await act(async () => viewport.scroll(0, false))
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
				<AriakitVirtualizedSelect label={label} options={options} selectedValue={null} onChange={viewport.select} />
			)
		)
	}
	await renderSelect('Choose')
	const disclosure = container.querySelector<HTMLButtonElement>('button')!
	await act(async () => disclosure.click())
	const popover = document.querySelector('[role="dialog"]')!
	expect(popover.textContent).toContain('Option 000')
	await act(async () => viewport.scroll(2200, true))
	expect(popover.textContent).toContain('Option 050')
	expect(popover.textContent).not.toContain('Option 000')
	await renderSelect('Choose an option')
	expect(popover.textContent).toContain('Option 050')
	const search = popover.querySelector<HTMLInputElement>('input')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Option 050')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(popover.textContent).toContain('Option 050')
	expect(popover.textContent).not.toContain('Option 049')
	const option = [...popover.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Option 050'
	)!
	await act(async () => option.click())
	expect(viewport.select.mock.calls).toEqual([[{ value: '50', label: 'Option 050' }]])
	await act(async () => disclosure.click())
	expect(popover.textContent).toContain('Option 000')
})
