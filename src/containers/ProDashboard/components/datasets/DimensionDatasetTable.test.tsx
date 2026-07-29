// @vitest-environment happy-dom

import type { ColumnDef, Table } from '@tanstack/react-table'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'

interface ModalProps {
	onClose: () => void
	onApply: (include: string[], exclude: string[]) => void
	onClear: () => void
	categories: string[]
	initialInclude: string[]
	initialExclude: string[]
}

interface DatasetQueryMock {
	data: DimensionDatasetProtocol[]
	isLoading: boolean
	error: Error | null
	unavailableChains: string[]
}

const mocks = vi.hoisted<{
	query: DatasetQueryMock
	handleTableFiltersChange: ReturnType<typeof vi.fn>
	downloadCSV: ReturnType<typeof vi.fn>
	modalProps: ModalProps | null
}>(() => ({
	query: {
		data: [],
		isLoading: false,
		error: null,
		unavailableChains: []
	},
	handleTableFiltersChange: vi.fn(),
	downloadCSV: vi.fn(),
	modalProps: null
}))

vi.mock('./useDimensionDatasetData', () => ({
	useDimensionDatasetData: () => mocks.query
}))
vi.mock('../../ProDashboardAPIContext', () => ({
	useProDashboardEditorActions: () => ({ handleTableFiltersChange: mocks.handleTableFiltersChange })
}))
vi.mock('~/hooks/useBreakpointWidth', () => ({ useBreakpointWidth: () => 1200 }))
vi.mock('~/utils/download', () => ({ downloadCSV: mocks.downloadCSV }))
vi.mock('../LoadingSpinner', () => ({ LoadingSpinner: () => <div>Loading</div> }))
vi.mock('../ProTable/CsvButton', () => ({
	ProTableCSVButton: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>CSV</button>
}))
vi.mock('../ProTable/TablePagination', () => ({ TablePagination: () => null }))
vi.mock('../ProTable/TableBody', () => ({
	TableBody: ({ table }: { table: Table<DimensionDatasetProtocol> }) => (
		<div>
			{table.getAllLeafColumns().map((column) => {
				const header = column.columnDef.header
				return <div key={column.id}>{typeof header === 'function' ? header({} as never) : header}</div>
			})}
			<div data-testid="rows">
				{table
					.getRowModel()
					.rows.map((row) => row.original.name)
					.join(',')}
			</div>
		</div>
	)
}))
vi.mock('../CategoryFilterModal', () => ({
	CategoryFilterModal: (props: ModalProps) => {
		mocks.modalProps = props
		return <div data-testid="category-modal" />
	}
}))

import { DimensionDatasetTable } from './DimensionDatasetTable'

const columns: ColumnDef<DimensionDatasetProtocol>[] = [
	{ id: 'name', accessorKey: 'name', header: 'Name' },
	{ accessorKey: 'category', header: 'Category' },
	{ accessorKey: 'total24h', header: '24h' }
]

const data: DimensionDatasetProtocol[] = [
	{ name: 'Alpha', category: 'Lending', total24h: 10, chains: ['Ethereum'] },
	{ name: 'Beta', category: 'Dexes', total24h: 20, chains: ['Base'] }
]

const renderTable = (filters?: { categories?: string[]; excludedCategories?: string[] }, tableId = 'table-1') => (
	<DimensionDatasetTable
		datasetType="revenue"
		tableId={tableId}
		{...(filters !== undefined ? { filters } : {})}
		columns={columns}
		title="Protocol Revenue"
		loadingText="Loading revenue data..."
		errorText="Failed to load revenue data"
		csvFilename="revenue-data.csv"
		csvMetricLabel="Revenue"
		categoryFiltering
		omitChangeColumnsWithChains
		searchInputClassName="search"
	/>
)

describe('DimensionDatasetTable category persistence', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mocks.query = { data: [], isLoading: false, error: null, unavailableChains: [] }
		mocks.modalProps = null
		mocks.handleTableFiltersChange.mockReset()
		mocks.downloadCSV.mockReset()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	it('keeps persisted categories while data is empty, sanitizes on arrival, and follows external updates', async () => {
		await act(async () => root.render(renderTable({ categories: ['Stale', 'Lending'] })))
		mocks.query = { data, isLoading: false, error: null, unavailableChains: [] }
		await act(async () => root.render(renderTable({ categories: ['Stale', 'Lending'] })))

		await act(async () => (container.querySelector('button[title="Filter categories"]') as HTMLButtonElement).click())
		expect(mocks.modalProps?.categories).toEqual(['Dexes', 'Lending'])
		expect(mocks.modalProps?.initialInclude).toEqual(['Lending'])

		await act(async () => mocks.modalProps?.onClose())
		await act(async () => root.render(renderTable({ categories: ['Dexes'], excludedCategories: ['Lending'] })))
		await act(async () => (container.querySelector('button[title="Filter categories"]') as HTMLButtonElement).click())
		expect(mocks.modalProps?.initialInclude).toEqual(['Dexes'])
		expect(mocks.modalProps?.initialExclude).toEqual(['Lending'])
		expect(container.querySelector('[data-testid="rows"]')?.textContent).toBe('Beta')

		const search = container.querySelector('input[placeholder="Search protocols..."]') as HTMLInputElement
		search.value = 'Alpha'
		await act(async () => search.dispatchEvent(new InputEvent('input', { bubbles: true })))
		expect(container.querySelector('[data-testid="rows"]')?.textContent).toBe('')
	})

	it('sanitizes applied filters, persists undefined for empty arrays, and requires a table id', async () => {
		mocks.query = { data, isLoading: false, error: null, unavailableChains: [] }
		await act(async () => root.render(renderTable()))
		await act(async () => (container.querySelector('button[title="Filter categories"]') as HTMLButtonElement).click())
		await act(async () => mocks.modalProps?.onApply(['Dexes', 'Stale'], ['Lending']))

		expect(mocks.handleTableFiltersChange).toHaveBeenLastCalledWith('table-1', {
			categories: ['Dexes'],
			excludedCategories: ['Lending']
		})
		await act(async () => mocks.modalProps?.onClear())
		expect(mocks.handleTableFiltersChange).toHaveBeenLastCalledWith('table-1', {})

		mocks.handleTableFiltersChange.mockClear()
		await act(async () => root.render(renderTable(undefined, '')))
		await act(async () => mocks.modalProps?.onApply(['Dexes'], []))
		expect(mocks.handleTableFiltersChange).not.toHaveBeenCalled()
	})

	it('preserves loading, error, and empty-data frames', async () => {
		mocks.query = { data: [], isLoading: true, error: null, unavailableChains: [] }
		await act(async () => root.render(renderTable()))
		expect(container.textContent).toContain('Protocol Revenue')
		expect(container.textContent).toContain('Loading revenue data...')

		mocks.query = { data: [], isLoading: false, error: new Error('failed'), unavailableChains: [] }
		await act(async () => root.render(renderTable()))
		expect(container.textContent).toContain('Failed to load revenue data')

		mocks.query = { data: [], isLoading: false, error: null, unavailableChains: [] }
		await act(async () => root.render(renderTable()))
		expect(container.textContent).toContain('Protocol Revenue')
		expect(container.textContent).toContain('CSV')
		expect(container.querySelector('[data-testid="rows"]')?.textContent).toBe('')
	})

	it('labels successful rows as partial when a selected chain is unavailable', async () => {
		mocks.query = { data, isLoading: false, error: null, unavailableChains: ['Base'] }
		await act(async () => root.render(renderTable()))

		expect(container.textContent).toContain('Partial data: Base was unavailable.')
		expect(container.querySelector('[data-testid="rows"]')?.textContent).toBe('Beta,Alpha')
	})

	it('omits change columns only for chain-selected metrics that already did so', async () => {
		const metricColumns: ColumnDef<DimensionDatasetProtocol>[] = [
			...columns,
			{ accessorKey: 'change_1d', header: '24h Change' },
			{ accessorKey: 'change_7d', header: '7d Change' }
		]
		mocks.query = { data, isLoading: false, error: null, unavailableChains: [] }

		await act(async () =>
			root.render(
				<DimensionDatasetTable
					datasetType="revenue"
					chains={['Ethereum']}
					columns={metricColumns}
					title="Ethereum Revenue"
					loadingText="Loading"
					errorText="Error"
					csvFilename="revenue-data.csv"
					csvMetricLabel="Revenue"
					categoryFiltering={false}
					omitChangeColumnsWithChains
					searchInputClassName="search"
				/>
			)
		)
		expect(container.textContent).not.toContain('24h Change')
		expect(container.textContent).not.toContain('7d Change')
		await act(async () => (container.querySelector('button') as HTMLButtonElement).click())
		expect(mocks.downloadCSV).toHaveBeenLastCalledWith(
			'revenue-data.csv',
			expect.stringMatching(/^Protocol,Category,24h Revenue,7d Revenue,30d Revenue,Chains\n/),
			{ addTimestamp: true }
		)

		mocks.downloadCSV.mockClear()
		await act(async () =>
			root.render(
				<DimensionDatasetTable
					datasetType="fees"
					chains={['Ethereum']}
					columns={metricColumns}
					title="Ethereum Fees"
					loadingText="Loading"
					errorText="Error"
					csvFilename="fees-data.csv"
					csvMetricLabel="Fees"
					categoryFiltering={false}
					omitChangeColumnsWithChains={false}
					searchInputClassName="search"
				/>
			)
		)
		expect(container.textContent).toContain('24h Change')
		expect(container.textContent).toContain('7d Change')
		await act(async () => (container.querySelector('button') as HTMLButtonElement).click())
		expect(mocks.downloadCSV).toHaveBeenLastCalledWith(
			'fees-data.csv',
			expect.stringMatching(/^Protocol,Category,24h Fees,7d Fees,30d Fees,24h Change,7d Change,Chains\n/),
			{ addTimestamp: true }
		)
	})
})
