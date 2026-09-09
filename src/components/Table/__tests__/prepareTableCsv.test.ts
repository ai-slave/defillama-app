import {
	createTable,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel
} from '@tanstack/react-table'
import { expect, test } from 'vitest'
import { serializeCsv } from '~/utils/csv'
import { prepareTableCsv } from '../utils'

test('exports every filtered and sorted row before pagination with literal CSV values', () => {
	const table = createTable({
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
		onStateChange: () => {},
		renderFallbackValue: null,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})
	expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(['Beta'])
	expect(serializeCsv(prepareTableCsv({ instance: table, filename: 'markets' }).rows)).toBe('Name\nBeta\n"Alpha, Inc."')
	expect(serializeCsv(prepareTableCsv({ instance: table, filename: 'markets', includeHiddenColumns: true }).rows)).toBe(
		'Name,Volume (USD)\nBeta,-3\n"Alpha, Inc.",12'
	)
})
