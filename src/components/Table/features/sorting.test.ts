import { createColumnHelper, rowPaginationFeature, tableFeatures } from '@tanstack/react-table'
import { describe, expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import type { PaginatedTableInstance, PaginationFeatures } from './contracts'
import { sortedTableFeatures } from './sorting'

function getPages<F extends PaginationFeatures>(table: PaginatedTableInstance<F, { name: string }>) {
	return table.getPageCount()
}

const columns = createColumnHelper<typeof sortedTableFeatures, { name: string; amount: number }>()
// @ts-expect-error Accessors must name a field on this row.
columns.accessor('missing', {})
// @ts-expect-error Named functions must be registered on these features.
columns.accessor('name', { sortFn: 'unregistered' })
// @ts-expect-error Metadata callbacks must accept this table's row.
columns.accessor('name', { meta: { csvValue: (row: { other: boolean }) => String(row.other) } })

const paginationFeatures = tableFeatures({ rowPaginationFeature })
const extendedFeatures = tableFeatures({ ...sortedTableFeatures, rowPaginationFeature })
const paginationOnly = constructTestTable({
	features: paginationFeatures,
	columns: [{ accessorKey: 'name' }],
	data: [{ name: 'a' }]
})
const extended = constructTestTable({
	features: extendedFeatures,
	columns: [{ accessorKey: 'name' }],
	data: [{ name: 'a' }]
})
getPages(paginationOnly)
getPages(extended)
function assertMissingSortingApi() {
	// @ts-expect-error A pagination-only table has no sorting API.
	paginationOnly.setSorting([])
}
void assertMissingSortingApi

describe('selective sorting features', () => {
	test.each([
		['numbers', [10, 2, 30], [2, 10, 30]],
		['text', ['Zulu', 'alpha', 'Beta'], ['alpha', 'Beta', 'Zulu']],
		['alphanumeric', ['Pool 10', 'Pool 2', 'Pool 1'], ['Pool 1', 'Pool 2', 'Pool 10']],
		[
			'dates',
			[new Date('2026-03-01'), new Date('2026-01-01'), new Date('2026-02-01')],
			[new Date('2026-01-01'), new Date('2026-02-01'), new Date('2026-03-01')]
		]
	])('automatically sorts %s in both directions', (_name, values, expected) => {
		const table = constructTestTable({
			features: sortedTableFeatures,
			data: values.map((value) => ({ value })),
			columns: [{ accessorKey: 'value' }]
		})
		table.setSorting([{ id: 'value', desc: false }])
		expect(table.getRowModel().rows.map((row) => row.original.value)).toEqual(expected)
		table.setSorting([{ id: 'value', desc: true }])
		expect(table.getRowModel().rows.map((row) => row.original.value)).toEqual([...expected].reverse())
	})

	test('keeps undefined last in both directions and renders replaced data', () => {
		const table = constructTestTable({
			features: sortedTableFeatures,
			data: [{ value: undefined }, { value: 2 }, { value: 1 }],
			columns: [{ accessorKey: 'value', sortUndefined: 'last' }]
		})
		table.setSorting([{ id: 'value', desc: false }])
		expect(table.getRowModel().rows.map((row) => row.original.value)).toEqual([1, 2, undefined])
		table.setSorting([{ id: 'value', desc: true }])
		expect(table.getRowModel().rows.map((row) => row.original.value)).toEqual([2, 1, undefined])
		table.setOptions((previous) => ({ ...previous, data: [{ value: 4 }, { value: 3 }] }))
		expect(table.getRowModel().rows.map((row) => row.original.value)).toEqual([4, 3])
	})
})

function assertColumnTupleTypes() {
	const definitions = columns.columns([
		columns.accessor((row) => row.name, { id: 'name' }),
		columns.accessor((row) => row.amount, { id: 'amount' })
	])
	const row = { name: 'Alpha', amount: 1 }
	const name: string = definitions[0].accessorFn(row, 0)
	const amount: number = definitions[1].accessorFn(row, 0)
	// @ts-expect-error Combining columns must not widen a string accessor to any.
	const invalid: number = definitions[0].accessorFn(row, 0)
	return { name, amount, invalid }
}
void assertColumnTupleTypes
