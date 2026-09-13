import { createColumnHelper } from '@tanstack/react-table'
import { expect, test } from 'vitest'
import { constructTestTable } from '../__tests__/helpers/constructTestTable'
import { filteredTableFeatures } from './filtering'

const helper = createColumnHelper<typeof filteredTableFeatures, { name: string; amount: number }>()
const columns = helper.columns([
	helper.accessor('name', { filterFn: 'includesString' }),
	helper.accessor('amount', { filterFn: 'inNumberRange' })
])

test.each([
	{ label: 'case-insensitive substring', column: 'name', filter: 'ALP', expected: ['Alpha'] },
	{ label: 'unmatched text', column: 'name', filter: 'missing', expected: [] },
	{ label: 'inclusive numeric boundaries', column: 'amount', filter: [10, 20], expected: ['Beta', 'Gamma'] },
	{ label: 'outside numeric range', column: 'amount', filter: [11, 19], expected: [] }
])('applies the registered filter: $label', ({ column, filter, expected }) => {
	const table = constructTestTable({
		features: filteredTableFeatures,
		columns,
		data: [
			{ name: 'Alpha', amount: 5 },
			{ name: 'Beta', amount: 10 },
			{ name: 'Gamma', amount: 20 }
		]
	})
	table.getColumn(column)!.setFilterValue(filter)
	expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(expected)
	table.getColumn(column)!.setFilterValue(undefined)
	expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
})
