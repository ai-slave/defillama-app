import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { type ColumnDef, type PaginationState, type SortingState, useTable } from '@tanstack/react-table'
import { act, useMemo, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { StreamDoneContext } from '../../../queries'
import type { UnifiedTableConfig } from '../../../unifiedTable/config/current'
import type { ProtocolsUnifiedTableResponse } from '../../../unifiedTable/contracts'
import { TablePagination } from '../../Table/TablePagination'
import UnifiedTable from '../index'
import type { ProtocolTableLeafRow, ProtocolTableRow } from '../types'
import { UnifiedVirtualTable } from './UnifiedVirtualTable'
import { tableFeaturesConfig, useUnifiedTable } from './useUnifiedTable'

const dashboardMocks = vi.hoisted(() => ({
	handleDuplicateUnifiedTable: vi.fn(),
	handleEditItem: vi.fn(),
	permissions: { isReadOnly: true, hideDuplicateButton: false },
	variables: [] as Array<{
		id: string
		kind: 'chain' | 'protocol'
		label: string
		value: string
	}>
}))

vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ getProtocolInfo: () => null }),
	useProDashboardEditorActions: () => ({
		handleDuplicateUnifiedTable: dashboardMocks.handleDuplicateUnifiedTable,
		handleEditItem: dashboardMocks.handleEditItem
	}),
	useProDashboardPermissions: () => ({ ...dashboardMocks.permissions }),
	useProDashboardDashboard: () => ({
		currentDashboard: null,
		dashboardId: null
	}),
	useProDashboardItemsState: () => ({ items: [] }),
	useProDashboardVariables: () => ({ variables: dashboardMocks.variables }),
	useProDashboardAnnotations: () => ({ annotations: [] })
}))

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))

const virtualizer = vi.hoisted(() => {
	let count = 0
	const scrollToOffset = vi.fn()
	return {
		setCount: (nextCount: number) => {
			count = nextCount
		},
		scrollToOffset,
		instance: {
			getVirtualItems: () =>
				Array.from({ length: count }, (_, index) => ({
					index,
					key: index,
					start: index * 50,
					end: (index + 1) * 50,
					size: 50,
					lane: 0
				})),
			getTotalSize: () => count * 50,
			scrollToOffset
		}
	}
})

vi.mock('@tanstack/react-virtual', () => ({
	useVirtualizer: ({ count }: { count: number }) => {
		virtualizer.setCount(count)
		return virtualizer.instance
	}
}))

const createRow = (index: number): ProtocolTableLeafRow => {
	const id = `protocol-${index}`
	return {
		rowType: 'protocol',
		nodeType: 'leaf',
		id,
		name: `Row ${index}`,
		protocolId: id,
		displayName: `Row ${index}`,
		logo: '',
		category: null,
		chains: [],
		oracles: [],
		parentProtocolId: null,
		parentProtocolName: null,
		parentProtocolLogo: null,
		metrics: {},
		chain: null,
		filteredShares: {},
		customValues: {}
	}
}

const columns: Array<ColumnDef<typeof tableFeaturesConfig, ProtocolTableRow>> = [
	{
		id: 'name',
		header: 'Name',
		accessorFn: (row) => row.name,
		cell: ({ row }) => <span data-testid="row-name">{row.original.name}</span>,
		size: 120
	}
]

const unifiedTableConfig: UnifiedTableConfig = {
	id: 'table',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['protocol'],
	columnOrder: ['name', 'tvl'],
	columnVisibility: { name: true, tvl: true },
	defaultSorting: [],
	colSpan: 2
}

const unifiedTableResponse: ProtocolsUnifiedTableResponse = {
	strategy: 'protocols',
	rows: [
		{
			rowType: 'protocol',
			id: 'aave',
			name: 'aave',
			protocolId: 'aave',
			displayName: 'Aave',
			logo: '',
			category: 'Lending',
			chains: ['Ethereum'],
			oracles: [],
			parentProtocolId: null,
			parentProtocolName: null,
			parentProtocolLogo: null,
			metrics: { tvl: 100 },
			chain: null
		}
	],
	parentMetrics: {}
}

function createQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
}

async function waitForContent(container: HTMLElement, content: string) {
	for (let attempt = 0; attempt < 20; attempt++) {
		if (container.textContent?.includes(content)) return
		await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
	}
	throw new Error(`Expected rendered content: ${content}`)
}

function SortingHarness({ columnId }: { columnId: string }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: columnId, desc: true }])
	const columnOrder = useMemo(() => ['name', columnId], [columnId])
	const columnVisibility = useMemo(() => ({ name: true, [columnId]: true }), [columnId])
	const { table } = useUnifiedTable({
		config: unifiedTableConfig,
		rowHeaders: unifiedTableConfig.rowHeaders,
		searchTerm: '',
		columnOrder,
		columnVisibility,
		sorting,
		onSortingChange: setSorting
	})
	return (
		<>
			<button type="button" onClick={() => setSorting([{ id: columnId, desc: false }])}>
				Ascending
			</button>
			<output data-testid="sorted-rows">
				{table
					.getSortedRowModel()
					.rows.map((row) => `${row.original.displayName}:${row.getValue(columnId) ?? 'missing'}`)
					.join(',')}
			</output>
		</>
	)
}

function TableHarness() {
	const [data, setData] = useState(() => Array.from({ length: 21 }, (_, index) => createRow(index + 1)))
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const [sorting, setSorting] = useState<SortingState>([])
	const table = useTable({
		features: tableFeaturesConfig,
		data,
		columns,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting
	})

	return (
		<>
			<button type="button" onClick={() => setData((rows) => [...rows].reverse())}>
				Reverse data
			</button>
			<UnifiedVirtualTable
				rows={table.getRowModel().rows}
				headerGroups={table.getHeaderGroups()}
				visibleLeafColumns={table.getVisibleLeafColumns()}
				totalTableWidth={table.getTotalSize()}
				pageIndex={pagination.pageIndex}
				pageSize={pagination.pageSize}
			/>
			<TablePagination
				pageSize={pagination.pageSize}
				pageIndex={pagination.pageIndex}
				pageCount={table.getPageCount()}
				canPreviousPage={table.getCanPreviousPage()}
				canNextPage={table.getCanNextPage()}
				previousPage={table.previousPage}
				nextPage={table.nextPage}
				setPageSize={table.setPageSize}
				showPageSizes
			/>
		</>
	)
}

describe('UnifiedTable rendering', () => {
	let container: HTMLDivElement
	let root: Root

	const rowNames = () =>
		Array.from(container.querySelectorAll('[data-testid="row-name"]'), (element) => element.textContent)

	const button = (label: string) => {
		const match = Array.from(container.querySelectorAll('button')).find((element) => element.textContent === label)
		if (!match) throw new Error(`Expected button: ${label}`)
		return match
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		virtualizer.scrollToOffset.mockReset()
		dashboardMocks.handleDuplicateUnifiedTable.mockReset()
		dashboardMocks.handleEditItem.mockReset()
		dashboardMocks.permissions.isReadOnly = true
		dashboardMocks.permissions.hideDuplicateButton = false
		dashboardMocks.variables = []
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	test.each(['tvl', 'fees24h'])(
		'sorts missing %s last without losing measured zero or negative values',
		async (columnId) => {
			const data: ProtocolsUnifiedTableResponse = {
				...unifiedTableResponse,
				rows: [100, null, 0, -20].map((value, index) => ({ ...createRow(index), metrics: { [columnId]: value } }))
			}
			vi.stubGlobal(
				'fetch',
				vi.fn(
					async () =>
						new Response(JSON.stringify(data), {
							status: 200,
							headers: { 'content-type': 'application/json' }
						})
				)
			)
			await act(async () =>
				root.render(
					<QueryClientProvider client={createQueryClient()}>
						<StreamDoneContext.Provider value>
							<SortingHarness columnId={columnId} />
						</StreamDoneContext.Provider>
					</QueryClientProvider>
				)
			)
			await waitForContent(container, 'Row 0:100')
			const order = () => container.querySelector('[data-testid="sorted-rows"]')!.textContent
			expect(order()).toBe('Row 0:100,Row 2:0,Row 3:-20,Row 1:missing')

			await act(async () => button('Ascending').click())
			expect(order()).toBe('Row 3:-20,Row 2:0,Row 0:100,Row 1:missing')
		}
	)

	test('renders equal-sized page changes and resets the virtual scroll window', async () => {
		await act(async () => root.render(<TableHarness />))
		expect(rowNames()).toEqual(Array.from({ length: 10 }, (_, index) => `Row ${index + 1}`))
		expect(container.textContent).toContain('Page 1 of 3')

		virtualizer.scrollToOffset.mockClear()
		await act(async () => button('Next').click())
		expect(rowNames()).toEqual(Array.from({ length: 10 }, (_, index) => `Row ${index + 11}`))
		expect(container.textContent).toContain('Page 2 of 3')
		expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(0, { align: 'start' })

		virtualizer.scrollToOffset.mockClear()
		await act(async () => container.querySelector<HTMLInputElement>('input[type="radio"][value="30"]')!.click())
		expect(rowNames()).toEqual(Array.from({ length: 21 }, (_, index) => `Row ${index + 1}`))
		expect(container.textContent).not.toContain('Page 2 of 3')
		expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(0, { align: 'start' })
	})

	test('renders same-cardinality data replacements from the current table snapshot', async () => {
		await act(async () => root.render(<TableHarness />))
		await act(async () => button('Reverse data').click())

		expect(rowNames()).toEqual(Array.from({ length: 10 }, (_, index) => `Row ${21 - index}`))
	})

	test('confirms before duplicating an editable unified table', async () => {
		dashboardMocks.permissions.isReadOnly = false

		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<StreamDoneContext.Provider value={false}>
						<UnifiedTable config={unifiedTableConfig} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)

		await act(async () => (container.querySelector('[aria-label="More actions"]') as HTMLButtonElement).click())
		const duplicateItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
			(node) => node.textContent === 'Duplicate'
		)
		if (!duplicateItem) throw new Error('Expected duplicate menu item')
		await act(async () => duplicateItem.click())
		expect(dashboardMocks.handleDuplicateUnifiedTable).not.toHaveBeenCalled()
		await waitForContent(document.body, 'Create a duplicate of this table in the dashboard?')

		const dialog = document.body.querySelector('[role="dialog"]')
		const confirmButton = Array.from(dialog?.querySelectorAll('button') ?? []).find(
			(element) => element.textContent === 'Duplicate'
		)
		if (!confirmButton) throw new Error('Expected duplicate confirmation button')
		await act(async () => confirmButton.click())

		expect(dashboardMocks.handleDuplicateUnifiedTable).toHaveBeenCalledWith(unifiedTableConfig)
	})

	test('shows the bound dashboard parameter beside the title only while the table is editable', async () => {
		dashboardMocks.permissions.isReadOnly = false
		dashboardMocks.variables = [{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }]
		const boundConfig: UnifiedTableConfig = {
			...unifiedTableConfig,
			bindings: { chains: 'chain' }
		}

		const renderBound = () =>
			act(async () =>
				root.render(
					<QueryClientProvider client={createQueryClient()}>
						<StreamDoneContext.Provider value={false}>
							<UnifiedTable key={String(dashboardMocks.permissions.isReadOnly)} config={boundConfig} />
						</StreamDoneContext.Provider>
					</QueryClientProvider>
				)
			)

		await renderBound()
		const badge = container.querySelector('[title="Bound to dashboard parameter"]')
		expect(badge?.textContent).toBe('Chain')

		dashboardMocks.permissions.isReadOnly = true
		await renderBound()
		expect(container.querySelector('[title="Bound to dashboard parameter"]')).toBeNull()
	})

	test('collapses the row search into an icon that expands into an input', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(unifiedTableResponse), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					})
			)
		)
		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<StreamDoneContext.Provider value>
						<UnifiedTable config={unifiedTableConfig} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')
		expect(container.querySelector('input[aria-label="Search table rows"]')).toBeNull()
		await act(async () =>
			(container.querySelector('button[aria-label="Search table rows"]') as HTMLButtonElement).click()
		)
		const input = container.querySelector<HTMLInputElement>('input[aria-label="Search table rows"]')
		expect(input).not.toBeNull()
		await act(async () => {
			input!.value = 'aave'
			input!.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(input!.value).toBe('aave')
	})

	test('collapsing the search with Escape keeps the query and returns focus to the search button', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(unifiedTableResponse), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					})
			)
		)
		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<StreamDoneContext.Provider value>
						<UnifiedTable config={unifiedTableConfig} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')
		await act(async () =>
			(container.querySelector('button[aria-label="Search table rows"]') as HTMLButtonElement).click()
		)
		const input = container.querySelector<HTMLInputElement>('input[aria-label="Search table rows"]')!
		await act(async () => {
			input.value = 'aave'
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await act(async () => {
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		})
		expect(container.querySelector('input[aria-label="Search table rows"]')).toBeNull()
		const searchButton = container.querySelector<HTMLButtonElement>('button[aria-label="Search table rows"]')
		expect(searchButton).not.toBeNull()
		expect(document.activeElement).toBe(searchButton)
		await act(async () => searchButton!.click())
		expect(container.querySelector<HTMLInputElement>('input[aria-label="Search table rows"]')!.value).toBe('aave')
	})

	test('a read-only table offers no grouping select and no columns button', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(unifiedTableResponse), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					})
			)
		)
		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<StreamDoneContext.Provider value>
						<UnifiedTable config={unifiedTableConfig} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')
		expect(container.querySelector('[aria-label="Group table rows"]')).toBeNull()
		expect(container.textContent).not.toContain('Customize columns')
		expect(container.querySelector('button[aria-label="Search table rows"]')).not.toBeNull()
	})

	test('shows an initial query failure distinctly from an empty table and retries from the error state', async () => {
		const fetchMock = vi.fn(async () => new Response('upstream unavailable', { status: 400 }))
		vi.stubGlobal('fetch', fetchMock)
		const queryClient = createQueryClient()

		await act(async () =>
			root.render(
				<QueryClientProvider client={queryClient}>
					<StreamDoneContext.Provider value>
						<UnifiedTable config={unifiedTableConfig} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, "Couldn't load this table")
		expect(container.textContent).not.toContain('No rows match your scope or filters.')

		const attemptsBeforeRetry = fetchMock.mock.calls.length
		await act(async () => button('Try again').click())
		await waitForContent(container, "Couldn't load this table")
		expect(fetchMock.mock.calls.length).toBeGreaterThan(attemptsBeforeRetry)
	})

	test('keeps stale table rows visible when a background refresh fails', async () => {
		let shouldFail = false
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				shouldFail
					? new Response('upstream unavailable', { status: 400 })
					: new Response(JSON.stringify(unifiedTableResponse), {
							status: 200,
							headers: { 'content-type': 'application/json' }
						})
			)
		)
		const queryClient = createQueryClient()

		await act(async () =>
			root.render(
				<QueryClientProvider client={queryClient}>
					<StreamDoneContext.Provider value>
						<UnifiedTable config={unifiedTableConfig} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')

		shouldFail = true
		await act(async () => {
			await queryClient.invalidateQueries()
		})
		expect(container.textContent).toContain('Aave')
		expect(container.textContent).not.toContain("Couldn't load this table")
	})
})
