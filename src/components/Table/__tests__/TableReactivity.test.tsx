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
import { VirtualTable } from '../Table'
import { useSortColumnOrders } from '../utils'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pairs' }) }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))

vi.mock('~/ui/Icon', () => ({ Icon: () => null }))
vi.mock('~/ui/Tooltip', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => children }))

const features = tableFeatures({
	...searchTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})
const helper = createColumnHelper<typeof features, { name: string; value: number }>()
const columns = helper.columns([
	helper.accessor('name', { header: 'Name', meta: { headerClassName: 'w-[180px]' } }),
	helper.accessor('value', { header: 'Value', meta: { headerClassName: 'w-[120px]' } })
])
const columnOrders = { 0: ['value'] }
const data = Array.from({ length: 12 }, (_, i) => ({ name: `Asset ${i + 1}`, value: i + 1 }))

const renderOwner = vi.fn()

function Fixture({ rows = data }: { rows?: typeof data }) {
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
			<PaginatedTable table={table} pageSizeOptions={[10, 20]} />
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
		expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!.disabled).toBe(true)
		expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to previous page"]')!.disabled).toBe(false)
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Go to previous page"]')!.click())
		expect(container.textContent).toContain('Page 1 of 2')
		expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to previous page"]')!.disabled).toBe(true)
		expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!.disabled).toBe(false)
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
		expect(container.querySelectorAll('tbody tr')).toHaveLength(0)
	} finally {
		await act(async () => root.unmount())
	}
})

const changedColumns = helper.columns([
	helper.accessor('name', {
		header: 'Renamed',
		meta: { headerClassName: 'w-[180px]' },
		cell: ({ getValue }) => `Updated ${getValue()}`
	})
])
const reformattedColumns = helper.columns([
	helper.accessor('name', {
		header: 'Name',
		meta: { headerClassName: 'w-[180px]' },
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
	if (renderer === 'virtual') return <VirtualTable table={table} skipVirtualization useStickyHeader={false} />
	if (renderer === 'pro') return <TableBody table={table} />
	return <PaginatedTable table={table} pageSizeOptions={[10, 20]} />
}
test.each(['virtual', 'paginated', 'pro'])('%s refreshes columns with stable data', async (renderer) => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<ColumnFixture definitions={columns} renderer={renderer} />))
		expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(2)
		await act(async () => root.render(<ColumnFixture definitions={reformattedColumns} renderer={renderer} />))
		expect(container.querySelector('tbody tr')?.textContent).toBe('Formatted Asset 11')
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
		meta: { headerClassName: 'w-[180px]', cellStyle: rowWork },
		cell: ({ getValue }) => cellWork(getValue())
	}),
	helper.accessor('value', { header: 'Value', meta: { headerClassName: 'w-[120px]' } })
])
function MeasuredFixture() {
	const [count, setCount] = useState(0)
	const table = useTable({ features, columns: measuredColumns, data })
	return (
		<>
			<button type="button" onClick={() => setCount(count + 1)}>
				Unrelated {count}
			</button>
			<button type="button" onClick={() => table.getColumn('name')!.toggleSorting(true)}>
				Sort measured
			</button>
			<button type="button" onClick={() => table.getColumn('name')!.setFilterValue('Asset 12')}>
				Filter measured
			</button>
			<button type="button" onClick={() => table.getColumn('value')!.toggleVisibility(false)}>
				Hide measured
			</button>
			<VirtualTable table={table} skipVirtualization useStickyHeader={false} />
		</>
	)
}
test('measures row and cell work across table and unrelated updates', async ({ task }) => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const samples: Record<string, { rows: number; cells: number }> = {}
	try {
		await act(async () => root.render(<MeasuredFixture />))
		for (const label of ['Unrelated 0', 'Sort measured', 'Filter measured', 'Hide measured']) {
			rowWork.mockClear()
			cellWork.mockClear()
			const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)!
			await act(async () => button.click())
			samples[label] = { rows: rowWork.mock.calls.length, cells: cellWork.mock.calls.length }
		}
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		expect(container.querySelectorAll('tbody td')).toHaveLength(1)
		expect(container.querySelector('tbody')?.textContent).toBe('Asset 12')
		const unrelatedWork = task.file.projectName === 'compiled' ? 0 : 10
		expect(samples['Unrelated 0']).toEqual({ rows: unrelatedWork, cells: unrelatedWork })
		for (const sample of Object.values(samples)) {
			expect(sample.rows).toBeLessThanOrEqual(10)
			expect(sample.cells).toBeLessThanOrEqual(10)
		}
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

const groupedColumns = helper.columns([
	columns[0],
	helper.group({ id: 'metrics', header: 'Metrics', columns: [columns[1]] })
])
test('keeps the first Pro column width on a spanning placeholder header', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () => root.render(<ColumnFixture definitions={groupedColumns} renderer="pro" />))
		expect(container.querySelector<HTMLTableCellElement>('thead th[rowspan="2"]')?.style.minWidth).toBe('120px')
		expect(container.querySelector<HTMLTableCellElement>('tbody td')?.style.minWidth).toBe('120px')
	} finally {
		await act(async () => root.unmount())
	}
})
