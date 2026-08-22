// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StreamDoneContext } from '../../../queries'
import type { UnifiedTableConfig } from '../../../unifiedTable/config/current'
import type { ProtocolsUnifiedTableResponse } from '../../../unifiedTable/contracts'
import { TablePagination } from '../../Table/TablePagination'
import UnifiedTable from '../index'
import type { ProtocolTableLeafRow, ProtocolTableRow } from '../types'
import { UnifiedVirtualTable } from './UnifiedVirtualTable'

vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ getProtocolInfo: () => null }),
	useProDashboardEditorActions: () => ({ handleEditItem: vi.fn() }),
	useProDashboardPermissions: () => ({ isReadOnly: true })
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

const columns: ColumnDef<ProtocolTableRow>[] = [
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

function TableHarness() {
	const [data, setData] = useState(() => Array.from({ length: 21 }, (_, index) => createRow(index + 1)))
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const [sorting, setSorting] = useState<SortingState>([])
	const table = useReactTable({
		data,
		columns,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
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
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('renders equal-sized page changes and resets the virtual scroll window', async () => {
		await act(async () => root.render(<TableHarness />))
		expect(rowNames()).toEqual(Array.from({ length: 10 }, (_, index) => `Row ${index + 1}`))
		expect(container.textContent).toContain('Page 1 of 3')

		virtualizer.scrollToOffset.mockClear()
		await act(async () => button('Next').click())
		expect(rowNames()).toEqual(Array.from({ length: 10 }, (_, index) => `Row ${index + 11}`))
		expect(container.textContent).toContain('Page 2 of 3')
		expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(0, { align: 'start' })

		virtualizer.scrollToOffset.mockClear()
		await act(async () => button('30').click())
		expect(rowNames()).toEqual(Array.from({ length: 21 }, (_, index) => `Row ${index + 1}`))
		expect(container.textContent).not.toContain('Page 2 of 3')
		expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(0, { align: 'start' })
	})

	it('renders same-cardinality data replacements from the current table snapshot', async () => {
		await act(async () => root.render(<TableHarness />))
		await act(async () => button('Reverse data').click())

		expect(rowNames()).toEqual(Array.from({ length: 10 }, (_, index) => `Row ${21 - index}`))
	})

	it('shows an initial query failure distinctly from an empty table and retries from the error state', async () => {
		const fetchMock = vi.fn(async () => new Response('upstream unavailable', { status: 400 }))
		vi.stubGlobal('fetch', fetchMock)
		const queryClient = createQueryClient()

		await act(async () =>
			root.render(
				<QueryClientProvider client={queryClient}>
					<StreamDoneContext.Provider value={true}>
						<UnifiedTable config={unifiedTableConfig} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Failed to load table data.')
		expect(container.textContent).not.toContain('No rows match your scope or filters.')

		const attemptsBeforeRetry = fetchMock.mock.calls.length
		await act(async () => button('Try again').click())
		await waitForContent(container, 'Failed to load table data.')
		expect(fetchMock.mock.calls.length).toBeGreaterThan(attemptsBeforeRetry)
	})

	it('keeps stale table rows visible when a background refresh fails', async () => {
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
					<StreamDoneContext.Provider value={true}>
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
		expect(container.textContent).not.toContain('Failed to load table data.')
	})
})
