import { expect, test } from 'vitest'
import { getColumnSelectState, getColumnVisibilityForSelection } from '../columnSelect'

const columns = [
	{ id: 'name', columnDef: { header: 'Name', enableHiding: false } },
	{ id: 'tvl', columnDef: { header: 'TVL', meta: { headerHelperText: 'Total value locked' } } },
	{ id: 'fees', columnDef: { header: 'Fees' } },
	{ id: 'csvOnly', columnDef: { header: 'CSV only', meta: { hidden: true } } }
]

test('offers every column but the identity and export-only ones, selecting those the user has not hidden', () => {
	expect(getColumnSelectState(columns, { name: false, fees: false })).toEqual({
		options: [
			{ key: 'tvl', name: 'TVL', help: 'Total value locked' },
			{ key: 'fees', name: 'Fees' }
		],
		selected: ['tvl']
	})
})

test('keeps the identity column when "Only" picks one metric or the user clears every column', () => {
	expect(getColumnVisibilityForSelection(columns, ['fees'])).toEqual({
		name: true,
		tvl: false,
		fees: true,
		csvOnly: false
	})
	expect(getColumnVisibilityForSelection(columns, [])).toEqual({ name: true, tvl: false, fees: false, csvOnly: false })
})

test('refuses a picker for a table without an identity column', () => {
	expect(() => getColumnSelectState(columns.slice(1), {})).toThrow(
		'A table with a column picker needs an identity column: set enableHiding: false on the column that names the row (columns: tvl, fees, csvOnly)'
	)
})
