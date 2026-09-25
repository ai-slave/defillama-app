import { expect, test } from 'vitest'
import { getColumnSelectState, getColumnVisibilityForSelection } from '../columnSelect'

const columns = [
	{ id: 'name', columnDef: { header: 'Name' } },
	{ id: 'tvl', columnDef: { header: 'TVL', meta: { headerHelperText: 'Total value locked' } } },
	{ id: 'csvOnly', columnDef: { header: 'CSV only', meta: { hidden: true } } }
]

test('offers visible-capable columns with their label and help, selecting those not hidden by the user', () => {
	expect(getColumnSelectState(columns, { name: false })).toEqual({
		options: [
			{ key: 'name', name: 'Name' },
			{ key: 'tvl', name: 'TVL', help: 'Total value locked' }
		],
		selected: ['tvl']
	})
})

test('hides every column left out of the selection, including export-only columns', () => {
	expect(getColumnVisibilityForSelection(columns, ['name'])).toEqual({ name: true, tvl: false, csvOnly: false })
})
