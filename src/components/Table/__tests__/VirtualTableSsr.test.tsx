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
			headerHelperText: 'Venue identity help'
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

	test('makes helper text on a non-sortable header keyboard reachable', () => {
		const html = renderToStaticMarkup(<TestVirtualTable />)

		expect(html).toMatch(/<button[^>]*type="button"[^>]*>Name<\/button>/)
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

// Header rows as `label colSpan×rowSpan`, read from the rendered cells.
function headerGrid(html: string) {
	const thead = html.match(/<thead[^>]*>(.*?)<\/thead>/s)![1]!
	return [...thead.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map(([, row]) =>
		[...row!.matchAll(/<th([^>]*)>(.*?)<\/th>/gs)].map(([, attributes, content]) => {
			const colSpan = attributes!.match(/colSpan="(\d+)"/i)?.[1] ?? '1'
			const rowSpan = attributes!.match(/rowSpan="(\d+)"/i)?.[1] ?? '1'
			return `${content!.replace(/<[^>]+>/g, '')} ${colSpan}×${rowSpan}`
		})
	)
}

test('spans leaf headers across three levels without duplicate labels', () => {
	expect(headerGrid(renderToStaticMarkup(<GroupedTable />))).toEqual([
		['Name 1×3', 'Metrics 3×1'],
		['Market Cap 1×2', 'Changes 2×1'],
		['Day 1×1', 'Week 1×1']
	])
})

test('recomputes group spans when a nested column is hidden', () => {
	expect(headerGrid(renderToStaticMarkup(<GroupedTable hideDay />))).toEqual([
		['Name 1×3', 'Metrics 2×1'],
		['Market Cap 1×2', 'Changes 1×1'],
		['Week 1×1']
	])
})

test('Table renders every row while VirtualTable limits the initial window', () => {
	const standard = renderToStaticMarkup(<TestVirtualTable renderer="standard" />)
	const virtual = renderToStaticMarkup(<TestVirtualTable />)
	expect(standard).toContain('Asset 40')
	expect(virtual).not.toContain('Asset 40')
})
