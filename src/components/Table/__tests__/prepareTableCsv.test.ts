import { createPaginatedRowModel, rowPaginationFeature, tableFeatures } from '@tanstack/react-table'
import { expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import { serializeCsv } from '~/utils/csv'
import { searchTableFeatures } from '../features/search'
import { prepareTableCsv } from '../utils'
const features = tableFeatures({
	...searchTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

test('exports every filtered and sorted row before pagination with literal CSV values', () => {
	const table = constructTestTable({
		features,
		data: [
			{ name: 'Alpha, Inc.', volume: 12 },
			{ name: 'Beta', volume: -3 },
			{ name: 'Excluded', volume: 99 }
		],
		columns: [
			{ accessorKey: 'name', header: 'Name', filterFn: (row, id, value) => row.getValue(id) !== value },
			{ accessorKey: 'volume', header: 'Volume', meta: { csvHeader: 'Volume (USD)' } }
		],
		state: {
			pagination: { pageSize: 1, pageIndex: 0 },
			sorting: [{ id: 'volume', desc: false }],
			columnFilters: [{ id: 'name', value: 'Excluded' }],
			columnVisibility: { volume: false }
		},

		renderFallbackValue: null
	})
	expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(['Beta'])
	expect(serializeCsv(prepareTableCsv({ instance: table, filename: 'markets' }).rows)).toBe('Name\nBeta\n"Alpha, Inc."')
	expect(serializeCsv(prepareTableCsv({ instance: table, filename: 'markets', includeHiddenColumns: true }).rows)).toBe(
		'Name,Volume (USD)\nBeta,-3\n"Alpha, Inc.",12'
	)
})
