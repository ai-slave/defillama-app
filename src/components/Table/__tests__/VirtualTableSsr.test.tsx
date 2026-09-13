import { createColumnHelper, useTable } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { searchTableFeatures } from '../features/search'
import { Table } from '../Table'
import { VirtualTable } from '../VirtualTable'
const features = searchTableFeatures

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/stablecoins' })
}))

type TestRow = {
	name: string
	mcap: number
}

const columnHelper = createColumnHelper<typeof features, TestRow>()
const columns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: (info) => info.getValue(),
		meta: {
			headerClassName: 'w-[180px]',
			headerHelperText: 'Venue identity help',
			cellStyle: (row) => (row.name === 'Asset 1' ? { backgroundColor: 'red' } : undefined)
		}
	}),
	columnHelper.accessor('mcap', {
		header: 'Market Cap',
		cell: (info) => info.getValue(),
		meta: { headerClassName: 'w-[120px]', align: 'end' }
	})
]

function TestVirtualTable({
	rowSize,
	tableLayout,
	compact = false,
	renderer = 'virtual'
}: {
	rowSize?: number
	tableLayout?: 'fixed' | 'auto'
	compact?: boolean
	renderer?: 'standard' | 'virtual'
}) {
	const data: Array<TestRow> = Array.from({ length: 40 }, (_, index) => ({
		name: `Asset ${index + 1}`,
		mcap: index + 1
	}))
	const instance = useTable({
		features,
		data,
		columns
	})

	if (renderer === 'standard')
		return <Table table={instance} rowSize={rowSize} tableLayout={tableLayout} compact={compact} />
	return <VirtualTable table={instance} rowSize={rowSize} tableLayout={tableLayout} compact={compact} />
}

describe('VirtualTable SSR', () => {
	test('renders an initial virtual window before browser measurement', () => {
		const html = renderToStaticMarkup(<TestVirtualTable />)

		expect(html).toContain('Asset 1')
		expect(html).toContain('Asset 2')
		expect(html).not.toContain('Asset 40')
	})

	test('can render auto table layout without fixed column widths', () => {
		const html = renderToStaticMarkup(<TestVirtualTable tableLayout="auto" />)

		expect(html).toContain('table-layout:auto')
		expect(html).not.toContain('<colgroup')
	})

	test('uses the normal and compact row sizes unless explicitly overridden', () => {
		const normalHtml = renderToStaticMarkup(<TestVirtualTable />)
		const compactHtml = renderToStaticMarkup(<TestVirtualTable compact />)
		const overriddenHtml = renderToStaticMarkup(<TestVirtualTable compact rowSize={64} />)

		expect(normalHtml).toContain('height:50px')
		expect(compactHtml).toContain('height:40px')
		expect(overriddenHtml).toContain('height:64px')
	})

	test('makes helper text on a non-sortable header keyboard reachable', () => {
		const html = renderToStaticMarkup(<TestVirtualTable />)

		expect(html).toMatch(/<button[^>]*type="button"[^>]*>Name<\/button>/)
	})

	test('applies row-derived cell styles', () => {
		const html = renderToStaticMarkup(<TestVirtualTable />)

		expect(html).toContain('background-color:red')
	})
})

const groupedColumns = columnHelper.columns([
	columnHelper.accessor('name', { header: 'Name', meta: { headerClassName: 'w-[180px]' } }),
	columnHelper.group({
		id: 'metrics',
		header: 'Metrics',
		columns: [
			columnHelper.accessor('mcap', { header: 'Market Cap', meta: { headerClassName: 'w-[120px]' } }),
			columnHelper.group({
				id: 'changes',
				header: 'Changes',
				columns: [
					columnHelper.display({ id: 'day', header: 'Day', meta: { headerClassName: 'w-[100px]' } }),
					columnHelper.display({ id: 'week', header: 'Week', meta: { headerClassName: 'w-[100px]' } })
				]
			})
		]
	})
])

function GroupedTable({ hideDay = false }: { hideDay?: boolean }) {
	const table = useTable({
		features,
		columns: groupedColumns,
		data: [{ name: 'Asset', mcap: 1 }],
		state: { columnVisibility: { day: !hideDay } }
	})
	return <Table table={table} />
}

test('spans leaf headers across three levels without duplicate labels', () => {
	const html = renderToStaticMarkup(<GroupedTable />)
	expect(html.match(/>Name</g)).toHaveLength(1)
	expect(html.match(/>Market Cap</g)).toHaveLength(1)
	expect(html).toMatch(/<th[^>]*rowSpan="3"/i)
	expect(html).toMatch(/<th[^>]*rowSpan="2"/i)
})

test('recomputes group spans when a nested column is hidden', () => {
	const html = renderToStaticMarkup(<GroupedTable hideDay />)
	expect(html).not.toContain('>Day<')
	expect(html).toContain('>Week<')
	expect(html).toMatch(/<th[^>]*colSpan="2"/i)
	expect(html.match(/>Name</g)).toHaveLength(1)
})

test('Table renders every row while VirtualTable limits the initial window', () => {
	const standard = renderToStaticMarkup(<TestVirtualTable renderer="standard" />)
	const virtual = renderToStaticMarkup(<TestVirtualTable />)
	expect(standard).toContain('Asset 40')
	expect(virtual).not.toContain('Asset 40')
	expect(standard).toContain('height:50px')
	expect(standard).toContain('background-color:red')
	expect(standard).not.toContain('data-index=')
	expect(virtual).toContain('data-index="0"')
})
