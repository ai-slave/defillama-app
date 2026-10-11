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
import { expect, onTestFinished, test, vi } from 'vitest'
import { searchTableFeatures } from '../features/search'
import { PaginatedTable } from '../PaginatedTable'
import { SearchTableProvider } from '../search/SearchTableProvider'
import { SearchTableView } from '../search/SearchTableView'
import { TableSearchInput } from '../search/TableSearchInput'
import { VirtualSearchTableView } from '../search/VirtualSearchTableView'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/assets', query: {} }) }))

type Asset = { name: string; value: number }
const helper = createColumnHelper<typeof searchTableFeatures, Asset>()
const columns = helper.columns([
	helper.accessor('name', { header: 'Name', meta: { headerClassName: 'w-[160px]' } }),
	helper.accessor('value', { header: 'Value', meta: { headerClassName: 'w-[120px]' } })
])
const data = [
	{ name: 'Alpha', value: 1 },
	{ name: 'Beta', value: 2 }
]

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

async function search(container: HTMLElement, value: string) {
	const input = container.querySelector('input')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

const bodyCells = (container: HTMLElement) =>
	[...container.querySelectorAll('tbody td')].map((cell) => [cell.textContent, (cell as HTMLTableCellElement).colSpan])

test.each([false, true])(
	'keeps the headers and shows one full-width "No results found" row while a search matches nothing (virtual: %s)',
	async (virtual) => {
		const container = await render(
			<SearchTableProvider options={{ data, columns }}>
				<TableSearchInput columnId="name" placeholder="Search assets" />
				{virtual ? <VirtualSearchTableView /> : <SearchTableView />}
			</SearchTableProvider>
		)

		await search(container, 'Gamma')
		expect(container.querySelector('thead')?.textContent).toBe('NameValue')
		expect(bodyCells(container)).toEqual([['No results found', 2]])

		await search(container, 'Alp')
		expect(bodyCells(container)).toEqual([
			['Alpha', 1],
			['1', 1]
		])
	}
)

const paginatedFeatures = tableFeatures({
	...searchTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})
const paginatedHelper = createColumnHelper<typeof paginatedFeatures, Asset>()
const paginatedColumns = paginatedHelper.columns([
	paginatedHelper.accessor('name', { header: 'Name', meta: { headerClassName: 'w-[160px]' } }),
	paginatedHelper.accessor('value', { header: 'Value', meta: { headerClassName: 'w-[120px]' } })
])
const noAssets: Array<Asset> = []

function EmptyPaginatedTable({ interactionDisabled = false }) {
	const table = useTable({
		features: paginatedFeatures,
		data: noAssets,
		columns: paginatedColumns,
		initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
	})
	return (
		<PaginatedTable
			table={table}
			pageSizeOptions={[10, 20]}
			interactionDisabled={interactionDisabled}
			emptyMessage="No markets found for AAPL."
		/>
	)
}

test('a paginated table with no rows shows its empty message under the headers, but not while it is loading', async () => {
	const empty = await render(<EmptyPaginatedTable />)
	expect(empty.querySelector('thead')?.textContent).toBe('NameValue')
	expect(bodyCells(empty)).toEqual([['No markets found for AAPL.', 2]])

	const loading = await render(<EmptyPaginatedTable interactionDisabled />)
	expect(bodyCells(loading)).toEqual([])
	expect(loading.querySelector('[role="status"]')?.textContent).toBe('Loading data…')
})
