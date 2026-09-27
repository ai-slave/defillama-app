// @vitest-environment happy-dom
import {
	functionalUpdate,
	type ColumnFiltersState,
	type SortingState,
	useTable,
	tableFeatures
} from '@tanstack/react-table'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { filteredTableFeatures } from '../features/filtering'
import { paginatedTableFeatures } from '../features/pagination'
import { PaginatedTable } from '../PaginatedTable'

// The rows-per-page picker reads the router query for its URL mode.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }))

const features = tableFeatures({ ...paginatedTableFeatures, ...filteredTableFeatures })
const rows = [
	{ name: 'Zulu', value: 200 },
	{ name: 'Alpha', value: 100 }
]
const requested = { sorting: vi.fn(), filtering: vi.fn(), pagination: vi.fn() }

function ServerTable({ rowCount }: { rowCount: number }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([{ id: 'name', value: 'no match' }])
	const [pagination, setPagination] = useState({ pageIndex: 2, pageSize: 10 })
	const table = useTable(
		{
			features,
			data: rows,
			columns: [
				{ accessorKey: 'name', header: 'Name' },
				{ accessorKey: 'value', header: 'Value' }
			],
			manualSorting: true,
			manualFiltering: true,
			manualPagination: true,
			rowCount,
			state: { sorting, columnFilters, pagination },
			onSortingChange: (updater) => {
				const next = functionalUpdate(updater, sorting)
				requested.sorting(next)
				setSorting(next)
			},
			onColumnFiltersChange: (updater) => {
				const next = functionalUpdate(updater, columnFilters)
				requested.filtering(next)
				setColumnFilters(next)
			},
			onPaginationChange: (updater) => {
				const next = functionalUpdate(updater, pagination)
				requested.pagination(next)
				setPagination(next)
			}
		},
		() => null
	)
	return (
		<>
			<button type="button" onClick={() => table.getColumn('name')!.setFilterValue('Alpha')}>
				Request Alpha
			</button>
			<PaginatedTable table={table} pageSizeOptions={[10, 20]} />
		</>
	)
}

test('leaves processing to the server while controls emit requests and totals drive navigation', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () => root.render(<ServerTable rowCount={42} />))
		const displayedNames = () =>
			Array.from(container.querySelectorAll('tbody tr td:first-child'), (cell) => cell.textContent)
		expect(displayedNames()).toEqual(['Zulu', 'Alpha'])
		expect(container.textContent).toContain('Page 3 of 5')
		const nameHeader = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Name')!
		await act(async () => nameHeader.click())
		expect(requested.sorting).toHaveBeenLastCalledWith([{ id: 'name', desc: true }])
		await act(async () => container.querySelector('button')!.click())
		expect(requested.filtering).toHaveBeenLastCalledWith([{ id: 'name', value: 'Alpha' }])
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Go to last page"]')!.click())
		expect(requested.pagination).toHaveBeenLastCalledWith({ pageIndex: 4, pageSize: 10 })
		expect(container.textContent).toContain('Page 5 of 5')
		expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!.disabled).toBe(true)
		expect(displayedNames()).toEqual(['Zulu', 'Alpha'])
		await act(async () => root.render(<ServerTable rowCount={65} />))
		expect(container.textContent).toContain('Page 5 of 7')
		expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!.disabled).toBe(false)
		expect(displayedNames()).toEqual(['Zulu', 'Alpha'])
	} finally {
		await act(async () => root.unmount())
	}
})

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

test('choosing more rows per page requests the first page at that size', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<ServerTable rowCount={42} />))
		expect(container.textContent).toContain('Page 3 of 5')
		await click(container.querySelector<HTMLElement>('[aria-label="Rows per page dropdown"]')!)
		const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent === '20')!
		await click(option)
		expect(requested.pagination).toHaveBeenLastCalledWith({ pageIndex: 0, pageSize: 20 })
		expect(container.textContent).toContain('Page 1 of 3')
		expect(container.textContent).toContain('Rows per page: 20')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
