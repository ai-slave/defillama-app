import { createColumnHelper } from '@tanstack/react-table'
import { expect, test } from 'vitest'
import { constructTestTable } from '../../__tests__/helpers/constructTestTable'
import type { SearchTableFeatures } from '../search'
import { searchTableOptions } from '../searchHook'

type Row = { name: string; tvl?: number; subRows?: Array<Row> }
const helper = createColumnHelper<SearchTableFeatures, Row>()
const columns = helper.columns([helper.accessor('name', { filterFn: 'includesString' })])

function searchTable() {
	return constructTestTable({
		...searchTableOptions,
		columns,
		data: [{ name: 'Parent', subRows: [{ name: 'Child match' }] }, { name: 'Other' }],
		getSubRows: (row) => row.subRows,
		renderFallbackValue: null
	})
}

test('toggling a sorted search column flips its direction instead of clearing the sort', () => {
	const table = searchTable()
	const name = table.getColumn('name')!
	const directions = []
	for (let click = 0; click < 3; click++) {
		name.toggleSorting()
		directions.push(name.getIsSorted())
	}
	expect(directions).toEqual(['asc', 'desc', 'asc'])
})

test('a search that matches only a sub row keeps its parent row', () => {
	const table = searchTable()
	table.getColumn('name')!.setFilterValue('match')
	expect(table.getFilteredRowModel().rows.map((row) => row.original.name)).toEqual(['Parent'])
})

test('rows without a value stay last whichever way a search column is sorted', () => {
	const table = constructTestTable({
		...searchTableOptions,
		columns: helper.columns([helper.accessor('tvl', {})]),
		data: [{ name: 'Unknown' }, { name: 'Small', tvl: 1 }, { name: 'Large', tvl: 2 }],
		renderFallbackValue: null
	})
	const names = () => table.getRowModel().rows.map((row) => row.original.name)

	table.setSorting([{ id: 'tvl', desc: false }])
	expect(names()).toEqual(['Small', 'Large', 'Unknown'])
	table.setSorting([{ id: 'tvl', desc: true }])
	expect(names()).toEqual(['Large', 'Small', 'Unknown'])
})
