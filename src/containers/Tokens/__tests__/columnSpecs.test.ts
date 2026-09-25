import { expect, test } from 'vitest'
import { TOKENS_HIDEABLE_COLUMN_SPECS } from '../columnSpecs'
import { TOKENS_COLUMNS } from '../index'

// Specs drive the column picker and the CSV export, so a table column without a spec cannot be hidden or exported.
test('every hideable table column has exactly one spec, in table order', () => {
	const hideableColumnIds = TOKENS_COLUMNS.filter((column) => column.id !== 'rank' && column.id !== 'name').map(
		(column) => column.id
	)
	expect(TOKENS_HIDEABLE_COLUMN_SPECS.map((spec) => spec.id)).toEqual(hideableColumnIds)
})
