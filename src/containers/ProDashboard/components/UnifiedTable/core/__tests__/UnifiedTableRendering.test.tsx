import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { type ColumnDef, type PaginationState, type SortingState, useTable } from '@tanstack/react-table'
import { act, useMemo, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TablePager } from '~/components/Table/TablePager'
import { accessibleName } from '~/utils/testing/accessibleName'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { UnifiedTableConfig } from '../../../../unifiedTable/config/current'
import type { ProtocolsUnifiedTableResponse } from '../../../../unifiedTable/contracts'
import UnifiedTable from '../../index'
import type { ProtocolTableLeafRow, ProtocolTableRow } from '../../types'
import type { ActiveFilterChip } from '../../utils/filterChips'
import { UnifiedTableHeader } from '../UnifiedTableHeader'
import { UnifiedVirtualTable } from '../UnifiedVirtualTable'
import { tableFeaturesConfig, useUnifiedTable } from '../useUnifiedTable'

const dashboardMocks = {
	handleDuplicateUnifiedTable: vi.fn(),
	handleEditItem: vi.fn(),
	permissions: { isReadOnly: true, hideDuplicateButton: false },
	variables: [] as Array<{
		id: string
		kind: 'chain' | 'protocol'
		label: string
		value: string
	}>
}

function Dashboard({ streamDone, children }: { streamDone: boolean; children: React.ReactNode }) {
	const { isReadOnly, hideDuplicateButton } = dashboardMocks.permissions
	return (
		<DashboardTestProvider
			mode={isReadOnly ? 'view' : 'edit'}
			streamDone={streamDone}
			permissions={{ isReadOnly, hideDuplicateButton }}
			variables={{ variables: dashboardMocks.variables }}
			editorActions={{
				handleDuplicateUnifiedTable: dashboardMocks.handleDuplicateUnifiedTable,
				handleEditItem: dashboardMocks.handleEditItem
			}}
		>
			{children}
		</DashboardTestProvider>
	)
}

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
const http = installFixtureFetch()
const ROWS_ROUTE = '/api/public/pro-dashboard/unified-table/protocols'
const rowRequests = () => http.requests.filter((request) => request.url.pathname === ROWS_ROUTE).length

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
	await waitForUi(() => expect(container.textContent).toContain(content))
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
			<button type="button" onClick={() => table.setPageSize(30)}>
				Show 30 rows
			</button>
			<TablePager
				pageIndex={pagination.pageIndex}
				pageCount={table.getPageCount()}
				onPageChange={(index) => table.setPageIndex(index)}
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
		const match = Array.from(container.querySelectorAll('button')).find((element) => accessibleName(element) === label)
		if (!match) throw new Error(`Expected button: ${label}`)
		return match
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		virtualizer.scrollToOffset.mockReset()
		dashboardMocks.handleDuplicateUnifiedTable.mockReset().mockReturnValue({ status: 'saved', ids: ['copy'] })
		dashboardMocks.handleEditItem.mockReset()
		dashboardMocks.permissions.isReadOnly = true
		dashboardMocks.permissions.hideDuplicateButton = false
		dashboardMocks.variables = []
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test.each(['tvl', 'fees24h'])(
		'sorts missing %s last without losing measured zero or negative values',
		async (columnId) => {
			const data: ProtocolsUnifiedTableResponse = {
				...unifiedTableResponse,
				rows: [100, null, 0, -20].map((value, index) => ({ ...createRow(index), metrics: { [columnId]: value } }))
			}
			http.serve({ [ROWS_ROUTE]: data })
			await act(async () =>
				root.render(
					<QueryClientProvider client={createQueryClient()}>
						<Dashboard streamDone>
							<SortingHarness columnId={columnId} />
						</Dashboard>
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

	test('scrolls the virtual window back to the top on page and page-size changes', async () => {
		await act(async () => root.render(<TableHarness />))

		virtualizer.scrollToOffset.mockClear()
		await act(async () => button('Go to next page').click())
		expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(0, { align: 'start' })

		virtualizer.scrollToOffset.mockClear()
		await act(async () => button('Show 30 rows').click())
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
					<Dashboard streamDone={false}>
						<UnifiedTable config={unifiedTableConfig} />
					</Dashboard>
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
						<Dashboard streamDone={false}>
							<UnifiedTable key={String(dashboardMocks.permissions.isReadOnly)} config={boundConfig} />
						</Dashboard>
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

	test('the collapsed row search expands into an input that filters the rows', async () => {
		const response: ProtocolsUnifiedTableResponse = {
			...unifiedTableResponse,
			rows: [
				...unifiedTableResponse.rows,
				{
					...unifiedTableResponse.rows[0],
					id: 'compound',
					name: 'compound',
					protocolId: 'compound',
					displayName: 'Compound'
				}
			]
		}
		http.serve({ [ROWS_ROUTE]: response })
		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<Dashboard streamDone>
						<UnifiedTable config={unifiedTableConfig} />
					</Dashboard>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Compound')
		expect(container.querySelector('input[aria-label="Search table rows"]')).toBeNull()
		await act(async () =>
			(container.querySelector('button[aria-label="Search table rows"]') as HTMLButtonElement).click()
		)
		const input = container.querySelector<HTMLInputElement>('input[aria-label="Search table rows"]')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'aave')
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await waitForUi(() => expect(container.textContent).not.toContain('Compound'))
		expect(container.textContent).toContain('Aave')
		expect(container.textContent).not.toContain('Compound')
	})

	test('collapsing the search with Escape keeps the query and returns focus to the search button', async () => {
		http.serve({ [ROWS_ROUTE]: unifiedTableResponse })
		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<Dashboard streamDone>
						<UnifiedTable config={unifiedTableConfig} />
					</Dashboard>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')
		await act(async () =>
			(container.querySelector('button[aria-label="Search table rows"]') as HTMLButtonElement).click()
		)
		const input = container.querySelector<HTMLInputElement>('input[aria-label="Search table rows"]')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'aave')
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

	test('an empty search that loses focus to another control collapses without pulling focus back', async () => {
		http.serve({ [ROWS_ROUTE]: unifiedTableResponse })
		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<Dashboard streamDone>
						<UnifiedTable config={unifiedTableConfig} />
					</Dashboard>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')
		await act(async () =>
			(container.querySelector('button[aria-label="Search table rows"]') as HTMLButtonElement).click()
		)
		const input = container.querySelector<HTMLInputElement>('input[aria-label="Search table rows"]')!
		await act(async () => input.focus())
		const elsewhere = document.createElement('button')
		container.append(elsewhere)
		await act(async () => elsewhere.focus())
		expect(container.querySelector('input[aria-label="Search table rows"]')).toBeNull()
		expect(container.querySelector('button[aria-label="Search table rows"]')).not.toBeNull()
		expect(document.activeElement).toBe(elsewhere)
	})

	test.each([
		[true, false],
		[false, true]
	])('read-only %s shows grouping and column controls: %s', async (isReadOnly, showsControls) => {
		dashboardMocks.permissions.isReadOnly = isReadOnly
		http.serve({ [ROWS_ROUTE]: unifiedTableResponse })
		await act(async () =>
			root.render(
				<QueryClientProvider client={createQueryClient()}>
					<Dashboard streamDone>
						<UnifiedTable config={unifiedTableConfig} onEdit={() => {}} />
					</Dashboard>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')
		expect(container.querySelector('[aria-label="Group table rows"]') !== null).toBe(showsControls)
		expect(container.textContent?.includes('Customize columns')).toBe(showsControls)
		expect(container.querySelector('button[aria-label="Search table rows"]')).not.toBeNull()
	})

	test('shows an initial query failure distinctly from an empty table and retries from the error state', async () => {
		http.serve({ [ROWS_ROUTE]: fixtureStatus(400, { message: 'upstream unavailable' }) })
		const queryClient = createQueryClient()

		await act(async () =>
			root.render(
				<QueryClientProvider client={queryClient}>
					<Dashboard streamDone>
						<UnifiedTable config={unifiedTableConfig} />
					</Dashboard>
				</QueryClientProvider>
			)
		)
		await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
		expect(container.textContent).not.toContain('No rows match your scope or filters.')
		// The retry belongs to the alert in place of the table, not to a refresh notice over stale rows.
		expect(button('Try again').closest('[role="alert"]')).not.toBeNull()

		const attemptsBeforeRetry = rowRequests()
		await act(async () => button('Try again').click())
		await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
		expect(rowRequests()).toBeGreaterThan(attemptsBeforeRetry)
	})

	test('keeps stale rows visible and offers a retry when a background refresh fails', async () => {
		let shouldFail = false
		const failure = fixtureStatus(400, { message: 'upstream unavailable' })
		http.serve({ [ROWS_ROUTE]: () => (shouldFail ? failure() : Response.json(unifiedTableResponse)) })
		const queryClient = createQueryClient()

		await act(async () =>
			root.render(
				<QueryClientProvider client={queryClient}>
					<Dashboard streamDone>
						<UnifiedTable config={unifiedTableConfig} />
					</Dashboard>
				</QueryClientProvider>
			)
		)
		await waitForContent(container, 'Aave')

		shouldFail = true
		await act(async () => {
			await queryClient.invalidateQueries()
		})
		// A failed refresh is a warning over the stale rows, not an alert in their place.
		const notice = await waitForUi(() => {
			const status = button('Try again').closest('[role="status"]')
			expect(status).not.toBeNull()
			return status!
		})
		expect(container.textContent).toContain('Aave')
		expect(alertTexts(container)).toEqual([])

		shouldFail = false
		const attemptsBeforeRetry = rowRequests()
		await act(async () => button('Try again').click())
		await waitForUi(() => expect(notice.isConnected).toBe(false))
		expect(rowRequests()).toBeGreaterThan(attemptsBeforeRetry)
		expect(container.textContent).toContain('Aave')
	})

	describe('removing a filter chip', () => {
		const chips: Array<ActiveFilterChip> = [
			{ id: 'chains', label: 'Chains', value: 'Ethereum', clearKeys: ['chains'] },
			{ id: 'tvl', label: 'TVL', value: '> $1m', clearKeys: ['tvlMin'] }
		]
		function ChipsHarness({ withFiltersButton }: { withFiltersButton: boolean }) {
			const [shown, setShown] = useState(chips)
			return (
				<Dashboard streamDone>
					<section aria-label="Table card" tabIndex={-1}>
						<UnifiedTableHeader
							title="Protocols"
							scopeDescription="All protocols"
							rowHeadersSummary={null}
							onSearchChange={() => {}}
							filterChips={shown}
							onFilterRemove={(chip) => setShown((current) => current.filter((item) => item.id !== chip.id))}
							onClearFilters={() => setShown([])}
							filtersEditable
							activeFilterCount={shown.length}
							{...(withFiltersButton ? { onFiltersClick: () => {} } : {})}
						/>
					</section>
				</Dashboard>
			)
		}
		const chip = (label: string) =>
			container.querySelector<HTMLButtonElement>(`[aria-label="Remove filter: ${label}"]`)!
		async function remove(label: string) {
			await act(async () => {
				chip(label).focus()
				chip(label).click()
			})
		}

		test('hands focus to the next chip, then to the Filters button after the last', async () => {
			dashboardMocks.permissions.isReadOnly = false
			await act(async () => root.render(<ChipsHarness withFiltersButton />))
			await remove('Chains')
			expect(document.activeElement).toBe(chip('TVL'))
			await remove('TVL')
			expect(document.activeElement?.textContent).toBe('Filters')
		})

		test('hands focus to the card after the last chip when there is no Filters button', async () => {
			dashboardMocks.permissions.isReadOnly = false
			await act(async () => root.render(<ChipsHarness withFiltersButton={false} />))
			await remove('TVL')
			expect(document.activeElement).toBe(chip('Chains'))
			await remove('Chains')
			expect(document.activeElement).toBe(container.querySelector('section'))
		})
	})
})
