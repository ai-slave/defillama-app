import { createColumnHelper, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import { cloneElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PaginatedTable } from '../PaginatedTable'

vi.mock('~/ui/Icon', () => ({
	Icon: ({ name }: { name: string }) => <span>{name}</span>
}))

vi.mock('~/ui/Tooltip', () => ({
	Tooltip: ({
		children,
		content,
		render
	}: {
		children: React.ReactNode
		content: string
		render?: React.ReactElement<Record<string, unknown>>
	}) => (render ? cloneElement(render, { 'data-tooltip-content': content }, children) : <>{children}</>)
}))

const columnHelper = createColumnHelper<{ name: string }>()

function TestTable({
	rowCount,
	initialPageSize = 10,
	interactionDisabled = false,
	paginationClassName,
	shell,
	stickyHeader = false
}: {
	rowCount: number
	initialPageSize?: number
	interactionDisabled?: boolean
	paginationClassName?: string
	shell?: 'default' | 'none'
	stickyHeader?: boolean
}) {
	const data = Array.from({ length: rowCount }, (_, index) => ({ name: `row-${index + 1}` }))
	const table = useReactTable({
		data,
		columns: [
			columnHelper.accessor('name', {
				header: 'Name',
				meta: {
					headerClassName: 'sticky left-0 w-[180px]',
					headerHelperText: 'Name help'
				}
			})
		],
		initialState: {
			pagination: {
				pageIndex: 0,
				pageSize: initialPageSize
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	return (
		<PaginatedTable
			table={table}
			pageSizeOptions={[10, 20, 30, 50] as const}
			interactionDisabled={interactionDisabled}
			paginationClassName={paginationClassName}
			shell={shell}
			stickyHeader={stickyHeader}
		/>
	)
}

describe('PaginatedTable', () => {
	it('hides pagination controls when there are ten or fewer rows', () => {
		const html = renderToStaticMarkup(<TestTable rowCount={10} />)

		expect(html).not.toContain('Page 1 of')
		expect(html).not.toContain('Rows per page')
	})

	it('keeps configured rows-per-page options available for paginated tables', () => {
		const html = renderToStaticMarkup(<TestTable rowCount={11} />)

		expect(html).toContain('Page 1 of 2')
		expect(html).toContain('Rows per page')
		expect(html).toContain('<option value="50">50</option>')
	})

	it('applies optional footer styling only when pagination is rendered', () => {
		const paginatedHtml = renderToStaticMarkup(<TestTable rowCount={11} paginationClassName="pagination-panel" />)
		const shortTableHtml = renderToStaticMarkup(<TestTable rowCount={10} paginationClassName="pagination-panel" />)

		expect(paginatedHtml).toContain('pagination-panel')
		expect(shortTableHtml).not.toContain('pagination-panel')
	})

	it('renders the sticky header mirror only when explicitly enabled', () => {
		const defaultHtml = renderToStaticMarkup(<TestTable rowCount={11} />)
		const stickyHtml = renderToStaticMarkup(<TestTable rowCount={11} stickyHeader />)

		expect(defaultHtml).not.toContain('data-sticky-table-header')
		expect(stickyHtml).toContain('data-sticky-table-header')
		expect(stickyHtml).toContain('translateX(var(--paginated-header-scroll-left, 0px))')
	})

	it('keeps one interactive control set on the presentational sticky mirror', () => {
		const html = renderToStaticMarkup(<TestTable rowCount={1} stickyHeader />)

		expect(html).toContain('data-sticky-header-mirror="true"')
		expect(html).toContain('role="presentation"')
		expect(html.match(/<button/g)).toHaveLength(1)
		expect(html.match(/data-tooltip-content="Name help"/g)).toHaveLength(1)
		expect(html).not.toContain('<thead aria-hidden="true"')
	})

	it('shows rows-per-page when at least two valid options remain', () => {
		const html = renderToStaticMarkup(<TestTable rowCount={20} />)

		expect(html).toContain('Page 1 of 2')
		expect(html).toContain('Rows per page')
	})

	it('keeps the current page size available when it is not in configured options', () => {
		const html = renderToStaticMarkup(<TestTable rowCount={20} initialPageSize={15} />)

		expect(html).toContain('Rows per page')
		expect(html).toContain('<option value="15" selected="">15</option>')
	})

	it('marks sortable headers as disabled when interactions are disabled', () => {
		const enabledHtml = renderToStaticMarkup(<TestTable rowCount={20} />)
		const disabledHtml = renderToStaticMarkup(<TestTable rowCount={20} interactionDisabled />)

		expect(enabledHtml).toContain('aria-disabled="false"')
		expect(disabledHtml).toContain('aria-disabled="true"')
		expect(disabledHtml).toContain('role="status"')
		expect(disabledHtml).toContain('Loading data...')
	})
})
