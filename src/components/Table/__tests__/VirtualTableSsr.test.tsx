import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { VirtualTable } from '../Table'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/stablecoins' })
}))

type TestRow = {
	name: string
	mcap: number
}

const columnHelper = createColumnHelper<TestRow>()
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
	compact = false
}: {
	rowSize?: number
	tableLayout?: 'fixed' | 'auto'
	compact?: boolean
}) {
	const data: TestRow[] = Array.from({ length: 40 }, (_, index) => ({
		name: `Asset ${index + 1}`,
		mcap: index + 1
	}))
	const instance = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel()
	})

	return <VirtualTable instance={instance} rowSize={rowSize} tableLayout={tableLayout} compact={compact} />
}

describe('VirtualTable SSR', () => {
	it('renders an initial virtual window before browser measurement', () => {
		const html = renderToStaticMarkup(<TestVirtualTable />)

		expect(html).toContain('Asset 1')
		expect(html).toContain('Asset 2')
		expect(html).not.toContain('Asset 40')
	})

	it('can render auto table layout without fixed column widths', () => {
		const html = renderToStaticMarkup(<TestVirtualTable tableLayout="auto" />)

		expect(html).toContain('table-layout:auto')
		expect(html).not.toContain('<colgroup')
	})

	it('uses the normal and compact row sizes unless explicitly overridden', () => {
		const normalHtml = renderToStaticMarkup(<TestVirtualTable />)
		const compactHtml = renderToStaticMarkup(<TestVirtualTable compact />)
		const overriddenHtml = renderToStaticMarkup(<TestVirtualTable compact rowSize={64} />)

		expect(normalHtml).toContain('height:50px')
		expect(compactHtml).toContain('height:40px')
		expect(overriddenHtml).toContain('height:64px')
	})

	it('makes helper text on a non-sortable header keyboard reachable', () => {
		const html = renderToStaticMarkup(<TestVirtualTable />)

		expect(html).toMatch(/<button[^>]*type="button"[^>]*>Name<\/button>/)
	})

	it('applies row-derived cell styles', () => {
		const html = renderToStaticMarkup(<TestVirtualTable />)

		expect(html).toContain('background-color:red')
	})
})
