import type { Table } from '@tanstack/react-table'
import { describe, expect, test } from 'vitest'
import { prepareTableCsv } from '../utils'

type Row = { name: string; volume: number }

function tableStub(): Table<Row> {
	const columns = [
		{ id: 'name', columnDef: { header: 'Name' } },
		{ id: 'volume', columnDef: { header: 'Volume' } }
	]
	const row = {
		original: { name: 'Example', volume: 42 },
		getValue: (id: string) => (id === 'name' ? 'Example' : 42)
	}

	return {
		getVisibleLeafColumns: () => [columns[0]],
		getAllLeafColumns: () => columns,
		getPrePaginationRowModel: () => ({ rows: [row] })
	} as unknown as Table<Row>
}

describe('prepareTableCsv', () => {
	test('exports visible columns by default', () => {
		expect(prepareTableCsv({ instance: tableStub(), filename: 'markets' }).rows).toEqual([['Name'], ['Example']])
	})

	test('can export columns hidden only for presentation', () => {
		expect(prepareTableCsv({ instance: tableStub(), filename: 'markets', includeHiddenColumns: true }).rows).toEqual([
			['Name', 'Volume'],
			['Example', 42]
		])
	})
})
