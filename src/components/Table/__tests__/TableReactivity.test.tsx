// @vitest-environment happy-dom
import {
	createColumnHelper,
	type ColumnDef,
	createPaginatedRowModel,
	rowPaginationFeature,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { TableBody } from '~/containers/ProDashboard/components/Table/TableBody'
import { searchTableFeatures } from '../features/search'
import { PaginatedTable } from '../PaginatedTable'
import { Table } from '../Table'
import { useSortColumnOrders } from '../utils'
import { VirtualTable } from '../VirtualTable'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pairs' }) }))

const features = tableFeatures({
	...searchTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})
const helper = createColumnHelper<typeof features, { name: string; value: number }>()
const columns = helper.columns([
	helper.accessor('name', { header: 'Name', meta: { headerClassName: 'min-w-[180px]' } }),
	helper.accessor('value', { header: 'Value', meta: { headerClassName: 'min-w-[120px]' } })
])
const columnOrders = { 0: ['value'] }
const data = Array.from({ length: 12 }, (_, i) => ({ name: `Asset ${i + 1}`, value: i + 1 }))

const renderOwner = vi.fn()

function Fixture({ rows = data, renderer = 'paginated' }: { rows?: typeof data; renderer?: 'paginated' | 'standard' }) {
	renderOwner()
	const table = useTable(
		{ features, columns, data: rows, initialState: { pagination: { pageIndex: 0, pageSize: 10 } } },
		() => null
	)
	useSortColumnOrders({ instance: table, columnOrders })
	return (
		<>
			<button type="button" onClick={() => table.getColumn('value')!.toggleSorting(true)}>
				Descending
			</button>
			<button type="button" onClick={() => table.getColumn('name')!.setFilterValue('Asset 12')}>
				Filter
			</button>
			<button type="button" onClick={() => table.getColumn('name')!.setFilterValue('')}>
				Clear filter
			</button>
			<button type="button" onClick={() => table.getColumn('name')!.toggleVisibility(false)}>
				Hide
			</button>
			{renderer === 'standard' ? <Table table={table} /> : <PaginatedTable table={table} pageSizeOptions={[10, 20]} />}
		</>
	)
}

test('keeps partial column ordering stable while sort, filter, and visibility update rendered rows', async () => {
	renderOwner.mockClear()
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<Fixture />))
		expect(container.querySelector('tbody tr')?.textContent).toContain('Asset 1')
		const click = async (label: string) => {
			const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)!
			await act(async () => button.click())
		}
		await click('Descending')
		expect(container.querySelector('tbody tr')?.textContent).toContain('Asset 12')
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!.click())
		expect(container.textContent).toContain('Page 2 of 2')
		expect(container.querySelector('[aria-label="Go to next page"]')!.getAttribute('aria-disabled')).toBe('true')
		expect(container.querySelector('[aria-label="Go to previous page"]')!.getAttribute('aria-disabled')).toBeNull()
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Go to previous page"]')!.click())
		expect(container.textContent).toContain('Page 1 of 2')
		expect(container.querySelector('[aria-label="Go to previous page"]')!.getAttribute('aria-disabled')).toBe('true')
		expect(container.querySelector('[aria-label="Go to next page"]')!.getAttribute('aria-disabled')).toBeNull()
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!.click())
		await click('Filter')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		expect(container.querySelector('tbody')?.textContent).toContain('Asset 12')
		await click('Hide')
		expect(container.querySelector('tbody')?.textContent).not.toContain('Asset 12')
		expect(container.querySelector('tbody')?.textContent).toContain('12')
		await click('Clear filter')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(10)
		expect(container.textContent).toContain('Page 1 of 2')
		expect(renderOwner).toHaveBeenCalledTimes(1)
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test('refreshes rows and pagination controls when only the supplied data changes', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () => root.render(<Fixture />))
		expect(container.textContent).toContain('Page 1 of 2')
		await act(async () => root.render(<Fixture rows={[{ name: 'Replacement', value: 99 }]} />))
		expect(container.querySelector('tbody')?.textContent).toContain('Replacement')
		expect(container.textContent).not.toContain('Page 1 of 2')
		await act(async () => root.render(<Fixture rows={[]} />))
		expect(container.querySelector('tbody')?.textContent).toBe('No results found')
	} finally {
		await act(async () => root.unmount())
	}
})

const changedColumns = helper.columns([
	helper.accessor('name', {
		header: 'Renamed',
		meta: { headerClassName: 'min-w-[180px]' },
		cell: ({ getValue }) => `Updated ${getValue()}`
	})
])
const reformattedColumns = helper.columns([
	helper.accessor('name', {
		header: 'Name',
		meta: { headerClassName: 'min-w-[180px]' },
		cell: ({ getValue }) => `Formatted ${getValue()}`
	}),
	columns[1]
])
const reversedColumns = helper.columns([columns[1], columns[0]])
function ColumnFixture({
	definitions,
	renderer
}: {
	definitions: Array<ColumnDef<typeof features, { name: string; value: number }>>
	renderer: string
}) {
	const table = useTable({ features, columns: definitions, data })
	if (renderer === 'virtual') return <VirtualTable table={table} useStickyHeader={false} />
	if (renderer === 'standard') return <Table table={table} />
	if (renderer === 'pro') return <TableBody table={table} />
	return <PaginatedTable table={table} pageSizeOptions={[10, 20]} />
}
test.each(['standard', 'virtual', 'paginated', 'pro'])('%s refreshes columns with stable data', async (renderer) => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<ColumnFixture definitions={columns} renderer={renderer} />))
		expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(2)
		await act(async () => root.render(<ColumnFixture definitions={reformattedColumns} renderer={renderer} />))
		expect(Array.from(container.querySelectorAll('tbody tr:first-child td'), (cell) => cell.textContent)).toEqual([
			'Formatted Asset 1',
			'1'
		])
		await act(async () => root.render(<ColumnFixture definitions={changedColumns} renderer={renderer} />))
		expect(container.querySelector('thead')?.textContent).toContain('Renamed')
		expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(1)
		expect(container.querySelector('tbody tr')?.textContent).toBe('Updated Asset 1')
		await act(async () => root.render(<ColumnFixture definitions={reversedColumns} renderer={renderer} />))
		expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(2)
		expect(container.querySelector('tbody tr td')?.textContent).toBe('1')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

const rowWork = vi.fn(() => ({}))
const cellWork = vi.fn((name: string) => name)
const measuredColumns = helper.columns([
	helper.accessor('name', {
		header: 'Name',
		meta: { headerClassName: 'min-w-[180px]', cellStyle: rowWork },
		cell: ({ getValue }) => cellWork(getValue())
	}),
	helper.accessor('value', { header: 'Value', meta: { headerClassName: 'min-w-[120px]' } })
])
function MeasuredFixture() {
	const [count, setCount] = useState(0)
	const table = useTable({ features, columns: measuredColumns, data })
	return (
		<>
			<button type="button" onClick={() => setCount(count + 1)}>
				Unrelated {count}
			</button>
			<Table table={table} />
		</>
	)
}
// Perf guard: if the React Compiler stops memoizing Table and TableRow, every cell of a large
// table re-renders on each unrelated owner state change (typing, toggles), and scrolling janks.
test('compiled cells skip unrelated owner updates', async ({ task, skip }) => {
	if (task.file.projectName !== 'compiled') skip()
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		rowWork.mockClear()
		cellWork.mockClear()
		await act(async () => root.render(<MeasuredFixture />))
		expect(rowWork).toHaveBeenCalled()
		expect(cellWork).toHaveBeenCalled()
		rowWork.mockClear()
		cellWork.mockClear()
		await act(async () => container.querySelector('button')!.click())
		expect(container.querySelector('button')?.textContent).toBe('Unrelated 1')
		expect(rowWork).not.toHaveBeenCalled()
		expect(cellWork).not.toHaveBeenCalled()
	} finally {
		await act(async () => root.unmount())
	}
})

test('Table preserves owner pagination and reacts without owner renders', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	renderOwner.mockClear()
	try {
		await act(async () => root.render(<Fixture renderer="standard" />))
		expect(container.querySelectorAll('tbody tr')).toHaveLength(10)
		expect(container.querySelector('[aria-label="Go to next page"]')).toBeNull()
		const click = async (label: string) => {
			const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)!
			await act(async () => button.click())
		}
		await click('Descending')
		expect(container.querySelector('tbody tr')?.textContent).toContain('Asset 12')
		await click('Filter')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		await click('Hide')
		expect(container.querySelectorAll('tbody td')).toHaveLength(1)
		expect(container.querySelector('tbody')?.textContent).toBe('12')
		await click('Clear filter')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(10)
		expect(renderOwner).toHaveBeenCalledTimes(1)
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
