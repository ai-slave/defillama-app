import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { exchangeDefinitions } from '../definitions'
import { buildDirectoryColumns } from '../directoryColumns'
import type { ExchangeDirectoryRowModel } from '../models'

function columnsById(columns: ColumnDef<ExchangeDirectoryRowModel, any>[]) {
	return Object.fromEntries(columns.map((column) => [column.id, column]))
}

describe('Exchanges definitions', () => {
	it('keeps every directory column label and header helper tied to its definition', () => {
		const columns = buildDirectoryColumns('spot')
		const byId = columnsById(columns)

		expect(Object.keys(byId).sort()).toEqual(Object.keys(exchangeDefinitions.directory).sort())
		for (const [id, definition] of Object.entries(exchangeDefinitions.directory)) {
			expect(byId[id]?.header).toBe(definition.label)
			expect(byId[id]?.meta?.headerHelperText).toBe(definition.description)
		}
	})
})
