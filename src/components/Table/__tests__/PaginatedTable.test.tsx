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
import { describe, expect, onTestFinished, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { searchTableFeatures } from '../features/search'
import { PaginatedTable } from '../PaginatedTable'
import { getPaginationControls } from '../paginationControls'

// The page-size picker reads the URL query.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }))

const features = tableFeatures({
	...searchTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})
const columnHelper = createColumnHelper<typeof features, { name: string }>()

const oneRow = [{ name: 'row-1' }]
// Three pages of ten. Module-level, so the table keeps its page across renders.
const threePages = Array.from({ length: 25 }, (_, i) => ({ name: `row-${i + 1}` }))

function TestTable({ interactionDisabled = false, stickyHeader = false, data = oneRow }) {
	const table = useTable({
		features,
		data,
		columns: [
			columnHelper.accessor('name', {
				header: 'Name',
				meta: { headerClassName: 'min-w-[180px]', headerHelperText: 'Name help' }
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
			pageSizeOptions: [10, 20]
		})
	})

	test('keeps a current page size outside the configured options selectable in order', () => {
		expect(controls({ pageSize: 15 }).pageSizeOptions).toEqual([10, 15, 20])
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

	test('a pager button that reaches the end keeps focus', async () => {
		const container = await render(<TestTable data={threePages} />)
		const last = container.querySelector<HTMLButtonElement>('[aria-label="Go to last page"]')!
		last.focus()
		await act(async () => last.click())

		await waitForUi(() => expect(container.textContent).toContain('Page 3 of 3'))
		expect(last.getAttribute('aria-disabled')).toBe('true')
		// Browsers drop focus from a natively disabled button; happy-dom does not, so assert the cause.
		expect(last.disabled).toBe(false)
		expect(document.activeElement).toBe(last)
	})
})
