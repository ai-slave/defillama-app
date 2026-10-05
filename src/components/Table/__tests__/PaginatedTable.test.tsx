// @vitest-environment happy-dom
import {
	createColumnHelper,
	createPaginatedRowModel,
	rowPaginationFeature,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, onTestFinished, test } from 'vitest'
import { searchTableFeatures } from '../features/search'
import { PaginatedTable } from '../PaginatedTable'
import { getPaginationControls } from '../paginationControls'

const features = tableFeatures({
	...searchTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})
const columnHelper = createColumnHelper<typeof features, { name: string }>()

function TestTable({ interactionDisabled = false, stickyHeader = false }) {
	const table = useTable({
		features,
		data: [{ name: 'row-1' }],
		columns: [
			columnHelper.accessor('name', {
				header: 'Name',
				meta: { headerClassName: 'w-[180px]', headerHelperText: 'Name help' }
			})
		],
		initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
	})
	return (
		<PaginatedTable
			table={table}
			pageSizeOptions={[10, 20]}
			interactionDisabled={interactionDisabled}
			stickyHeader={stickyHeader}
		/>
	)
}

const controls = (overrides: Partial<Parameters<typeof getPaginationControls>[0]>) =>
	getPaginationControls({
		rowCount: 11,
		pageCount: 2,
		pageIndex: 0,
		pageSize: 10,
		pageSizeOptions: [10, 20],
		...overrides
	})

describe('pagination controls', () => {
	test.each([0, 1, 10])('hides navigation and the page size selector for %s rows', (rowCount) => {
		expect(controls({ rowCount, pageCount: 1 })).toMatchObject({ showNavigation: false, showPageSizeSelector: false })
	})

	test('shows navigation and the configured page sizes once rows span pages', () => {
		expect(controls({})).toEqual({
			showNavigation: true,
			showPageSizeSelector: true,
			pageLabel: 'Page 1 of 2',
			pageSizeOptions: [10, 20]
		})
	})

	test('keeps a current page size outside the configured options selectable in order', () => {
		expect(controls({ pageSize: 15 }).pageSizeOptions).toEqual([10, 15, 20])
	})

	test('clamps the page label to the last page and shows one page for an empty server total', () => {
		expect(controls({ pageIndex: 7, pageCount: 3 }).pageLabel).toBe('Page 3 of 3')
		expect(controls({ pageIndex: 2, pageCount: 0 }).pageLabel).toBe('Page 1 of 1')
	})
})

async function render(node: ReactNode) {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	await act(async () => root.render(node))
	onTestFinished(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	return container
}

const sortButtons = (container: HTMLElement) =>
	[...container.querySelectorAll('button')].filter((button) => button.textContent?.includes('Name'))

describe('PaginatedTable', () => {
	test('keeps one interactive header control set when the sticky mirror is enabled', async () => {
		const container = await render(<TestTable stickyHeader />)

		expect(container.querySelector('[data-sticky-table-header] table')?.getAttribute('role')).toBe('presentation')
		expect(sortButtons(container)).toHaveLength(1)
	})

	test('announces loading and disables sorting while interactions are disabled', async () => {
		const enabled = await render(<TestTable />)
		expect(sortButtons(enabled).map((button) => button.getAttribute('aria-disabled'))).toEqual(['false'])

		const disabled = await render(<TestTable interactionDisabled />)
		expect(sortButtons(disabled).map((button) => button.getAttribute('aria-disabled'))).toEqual(['true'])
		expect(disabled.querySelector('[role="status"]')?.textContent).toBe('Loading data…')
	})
})
