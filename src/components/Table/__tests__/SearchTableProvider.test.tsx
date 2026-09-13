// @vitest-environment happy-dom
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { act } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { TotalValueLostContainer } from '~/containers/Hacks/TotalValueLost'
import { usePaginatedTable } from '../features/pagination'
import type { searchTableFeatures } from '../features/search'
import { useSearchTableContext } from '../search/context'
import { SearchTableProvider, type SearchTableOptions } from '../search/SearchTableProvider'
import { SearchTableView } from '../search/SearchTableView'
import { TableColumnSelect } from '../search/TableColumnSelect'
import { TableCsvExport } from '../search/TableCsvExport'
import { TableSearchInput } from '../search/TableSearchInput'
import { VirtualSearchTableView } from '../search/VirtualSearchTableView'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/mica' }) }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))
vi.mock('~/ui/Icon', () => ({ Icon: () => null }))
vi.mock('~/ui/Tooltip', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => children }))
const { csvRows } = vi.hoisted(() => ({ csvRows: vi.fn() }))
vi.mock('~/components/CsvDownloadButton', () => ({
	CSVDownloadButton: ({ prepareCsv }: { prepareCsv: () => { rows: unknown } }) => (
		<button type="button" onClick={() => csvRows(prepareCsv().rows)}>
			Export
		</button>
	)
}))
vi.mock('~/components/Select/SelectWithCombobox', () => ({
	SelectWithCombobox: ({
		selectedValues,
		setSelectedValues
	}: {
		selectedValues: Array<string>
		setSelectedValues: (values: Array<string>) => void
	}) => (
		<button
			type="button"
			onClick={() =>
				setSelectedValues(
					selectedValues.includes('Net User Loss')
						? selectedValues.includes('Name')
							? selectedValues.filter((id) => id !== 'Name')
							: ['Name', ...selectedValues]
						: selectedValues.includes('value')
							? ['name']
							: ['name', 'value']
				)
			}
		>
			Columns
		</button>
	)
}))
type Asset = { name: string; value: number }
const helper = createColumnHelper<typeof searchTableFeatures, Asset>()
const columns = helper.columns([
	helper.accessor('name', { header: 'Name', meta: { headerClassName: 'w-[160px]' } }),
	helper.accessor('value', { header: 'Value', meta: { headerClassName: 'w-[120px]' } })
])
const data = [
	{ name: 'Beta', value: 2 },
	{ name: 'Alpha, Inc.', value: 1 }
]
const renderOwner = vi.fn()
function ResetSearch() {
	const table = useSearchTableContext()
	return (
		<>
			<button type="button" onClick={() => table.resetColumnFilters()}>
				Reset
			</button>
			<button type="button" onClick={() => table.getColumn('name')!.setFilterValue('Beta')}>
				Set Beta
			</button>
			<button type="button" onClick={() => table.getColumn('name')!.toggleVisibility(false)}>
				Hide name
			</button>
		</>
	)
}
function Fixture({
	definitions = columns,
	rows = data,
	virtual = false,
	exportAll = false
}: {
	definitions?: Array<ColumnDef<typeof searchTableFeatures, Asset>>
	rows?: Array<Asset>
	virtual?: boolean
	exportAll?: boolean
}) {
	renderOwner()
	return (
		<SearchTableProvider
			options={{ data: rows, columns: definitions, initialState: { sorting: [{ id: 'value', desc: false }] } }}
		>
			<TableSearchInput columnId="name" placeholder="Search assets" />
			<TableColumnSelect />
			<TableCsvExport filename="assets" includeHiddenColumns={exportAll} />
			<ResetSearch />
			{virtual ? <VirtualSearchTableView /> : <SearchTableView />}
		</SearchTableProvider>
	)
}
async function click(container: HTMLElement, name: string) {
	const button = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === name)!
	await act(async () => button.click())
}
test('composes search, visibility, sorting, reset, and CSV without rerendering the owner', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	renderOwner.mockClear()
	csvRows.mockClear()
	try {
		await act(async () => root.render(<Fixture />))
		expect(container.querySelector('tbody tr')?.textContent).toBe('Alpha, Inc.1')
		const input = container.querySelector('input')!
		await act(async () => {
			input.value = 'Beta'
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		await click(container, 'Columns')
		expect(container.querySelectorAll('thead th')).toHaveLength(1)
		expect(container.querySelector('tbody')?.textContent).toBe('Beta')
		await click(container, 'Export')
		expect(csvRows).toHaveBeenLastCalledWith([['Name'], ['Beta']])
		await click(container, 'Reset')
		expect(input.value).toBe('')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
		await click(container, 'Columns')
		await click(container, 'Value')
		expect(container.querySelector('tbody tr')?.textContent).toBe('Beta2')
		expect(renderOwner).toHaveBeenCalledTimes(1)
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test.each([false, true])('refreshes same-ID columns and data through the provider (virtual: %s)', async (virtual) => {
	const container = document.createElement('div')
	const root = createRoot(container)
	const formatted = helper.columns([
		helper.accessor('name', {
			header: 'Renamed',
			meta: { headerClassName: 'w-[160px]' },
			cell: ({ getValue }) => `New ${getValue()}`
		}),
		columns[1]
	])
	try {
		await act(async () => root.render(<Fixture virtual={virtual} />))
		await act(async () => root.render(<Fixture virtual={virtual} definitions={formatted} />))
		expect(container.querySelector('thead')?.textContent).toContain('Renamed')
		expect(container.querySelector('tbody tr')?.textContent).toBe('New Alpha, Inc.1')
		await act(async () =>
			root.render(<Fixture virtual={virtual} definitions={formatted} rows={[{ name: 'Replacement', value: 3 }]} />)
		)
		expect(container.querySelector('tbody')?.textContent).toBe('New Replacement3')
	} finally {
		await act(async () => root.unmount())
	}
})
function NestedPagination({ children }: { children: React.ReactNode }) {
	const table = usePaginatedTable({ columns: [], data: [] })
	return <table.AppTable>{children}</table.AppTable>
}
test('does not bind searchable controls to a different preset provider', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(
				<SearchTableProvider options={{ columns, data }}>
					<NestedPagination>
						<TableSearchInput columnId="name" placeholder="Outer search" />
						<SearchTableView />
					</NestedPagination>
				</SearchTableProvider>
			)
		)
		const input = container.querySelector('input')!
		await act(async () => {
			input.value = 'Beta'
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		expect(container.querySelector('tbody')?.textContent).toBe('Beta2')
	} finally {
		await act(async () => root.unmount())
	}
})
test('infers rows from native options and rejects incompatible data', () => {
	const options: SearchTableOptions<Asset> = { data, columns }
	expect(options.columns).toBe(columns)
	// @ts-expect-error A provider must receive rows matching its column definitions.
	const invalid: SearchTableOptions<Asset> = { data: [{ name: 'Bad', value: 'not a number' }], columns }
	void invalid
})

test('keeps nested searchable tables independent', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(
				<SearchTableProvider options={{ columns, data }}>
					<section>
						<TableSearchInput columnId="name" placeholder="Outer" />
						<SearchTableView />
					</section>
					<SearchTableProvider options={{ columns, data }}>
						<section>
							<TableSearchInput columnId="name" placeholder="Inner" />
							<SearchTableView />
						</section>
					</SearchTableProvider>
				</SearchTableProvider>
			)
		)
		const input = container.querySelectorAll('input')[1]
		await act(async () => {
			input.value = 'Beta'
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		const sections = container.querySelectorAll('section')
		expect(sections[0].querySelectorAll('tbody tr')).toHaveLength(2)
		expect(sections[1].querySelectorAll('tbody tr')).toHaveLength(1)
	} finally {
		await act(async () => root.unmount())
	}
})

test('rejects controls without a searchable provider, even inside another preset', async () => {
	const root = createRoot(document.createElement('div'))
	try {
		await expect(
			act(async () =>
				root.render(
					<NestedPagination>
						<TableSearchInput columnId="name" placeholder="Search" />
					</NestedPagination>
				)
			)
		).rejects.toThrow('inside <SearchTableProvider>')
	} finally {
		await act(async () => root.unmount())
	}
})

function typeImmediately(input: HTMLInputElement, value: string) {
	flushSync(() => {
		input.value = value
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('commits urgent input before filtering and applies the latest rapid input', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () => root.render(<Fixture />))
		const input = container.querySelector('input')!
		await act(async () => {
			typeImmediately(input, 'Beta')
			expect(input.value).toBe('Beta')
			expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
			typeImmediately(input, 'Alpha')
			expect(input.value).toBe('Alpha')
			expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
		})
		expect(container.querySelector('tbody')?.textContent).toBe('Alpha, Inc.1')
		await act(async () => typeImmediately(input, ''))
		expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
	} finally {
		await act(async () => root.unmount())
	}
})

test.each(['', 'Beta'])('cancels pending text when resetting an applied filter of %j', async (initial) => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () => root.render(<Fixture />))
		const input = container.querySelector('input')!
		await act(async () => typeImmediately(input, initial))
		await act(async () => {
			typeImmediately(input, 'Alpha')
			Array.from(container.querySelectorAll('button'))
				.find((button) => button.textContent === 'Reset')!
				.click()
		})
		expect(input.value).toBe('')
		expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
	} finally {
		await act(async () => root.unmount())
	}
})

test('lets a nonempty external filter supersede pending text', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () => root.render(<Fixture />))
		const input = container.querySelector('input')!
		await act(async () => {
			typeImmediately(input, 'Alpha')
			Array.from(container.querySelectorAll('button'))
				.find((button) => button.textContent === 'Set Beta')!
				.click()
		})
		expect(input.value).toBe('Beta')
		expect(container.querySelector('tbody')?.textContent).toBe('Beta2')
	} finally {
		await act(async () => root.unmount())
	}
})

test.each([false, true])(
	'searches hidden columns and exports the requested visibility (all: %s)',
	async (exportAll) => {
		const container = document.createElement('div')
		const root = createRoot(container)
		try {
			await act(async () => root.render(<Fixture exportAll={exportAll} />))
			await click(container, 'Hide name')
			await act(async () => typeImmediately(container.querySelector('input')!, 'Beta'))
			expect(container.querySelector('tbody')?.textContent).toBe('2')
			await click(container, 'Export')
			expect(csvRows).toHaveBeenLastCalledWith(
				exportAll
					? [
							['Name', 'Value'],
							['Beta', 2]
						]
					: [['Value'], [2]]
			)
		} finally {
			await act(async () => root.unmount())
		}
	}
)

test('requests a controlled filter once while its owner has not applied it', async () => {
	const container = document.createElement('div')
	const root = createRoot(container)
	const onColumnFiltersChange = vi.fn()
	try {
		await act(async () =>
			root.render(
				<SearchTableProvider options={{ columns, data, state: { columnFilters: [] }, onColumnFiltersChange }}>
					<TableSearchInput columnId="name" placeholder="Search" />
				</SearchTableProvider>
			)
		)
		await act(async () => typeImmediately(container.querySelector('input')!, 'Beta'))
		expect(onColumnFiltersChange).toHaveBeenCalledTimes(1)
		expect(container.querySelector('input')!.value).toBe('Beta')
	} finally {
		await act(async () => root.unmount())
	}
})

test('Hacks keeps search and CSV working when Name is hidden and restored', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(
				<TotalValueLostContainer
					protocols={[
						{ name: 'Alpha', slug: 'alpha', route: null, totalHackedUsd: 20, returnedFundsUsd: 5 },
						{ name: 'Beta', slug: 'beta', route: null, totalHackedUsd: 10, returnedFundsUsd: 2 }
					]}
				/>
			)
		)
		await click(container, 'Columns')
		expect(container.querySelector('thead')?.textContent).not.toContain('Name')
		const input = container.querySelector('input')!
		await act(async () => {
			input.value = 'Beta'
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
		await click(container, 'Export')
		expect(csvRows).toHaveBeenLastCalledWith([
			['Total Hacked', 'Returned Funds', 'Net User Loss'],
			[10, 2, 8]
		])
		await click(container, 'Columns')
		expect(container.querySelector('tbody')?.textContent).toContain('Beta')
		await act(async () => {
			input.value = ''
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
		expect(container.querySelector('tbody tr')?.textContent).toContain('Alpha')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
