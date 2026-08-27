import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { exchangeDefinitions } from '../definitions'
import { buildDirectoryColumns, EXECUTION_COLUMN_IDS } from '../directoryColumns'
import type { ExchangeDirectoryRowModel } from '../models'

function columnsById(columns: ColumnDef<ExchangeDirectoryRowModel, any>[]) {
	return Object.fromEntries(columns.map((column) => [column.id, column]))
}

describe('Exchanges definitions', () => {
	it('keeps every directory column label and header helper tied to its definition', () => {
		const columns = buildDirectoryColumns('spot', true)
		const byId = columnsById(columns)

		expect(Object.keys(byId).sort()).toEqual(Object.keys(exchangeDefinitions.directory).sort())
		for (const [id, definition] of Object.entries(exchangeDefinitions.directory)) {
			// Execution headers append the measured basket, which is data and cannot live
			// in a static definition; everything else must match its definition exactly.
			if (EXECUTION_COLUMN_IDS.includes(id)) {
				expect(byId[id]?.header).toContain(definition.label)
				expect(byId[id]?.meta?.headerHelperText).toContain(definition.description)
				continue
			}
			expect(byId[id]?.header).toBe(definition.label)
			expect(byId[id]?.meta?.headerHelperText).toBe(definition.description)
		}
	})

	// Cost to trade and fill quality are published on different baskets on purpose, so a
	// column can only be compared DOWN the table, not across a row. Each header helper
	// has to name its own scope or a reader has no way to know that.
	it('each execution column states the basket it is measured on', () => {
		const byId = columnsById(buildDirectoryColumns('linear_perp', true, ['BTC', 'ETH'], ['BTC', 'ETH', 'SOL']))
		const helper = (id: string) =>
			String(byId[id]?.meta?.headerHelperText).replace(exchangeDefinitions.directory[id].description, '')

		expect(helper('execCostToTrade')).toContain('BTC, ETH perps')
		expect(helper('execSlippage10k')).toContain('BTC, ETH, SOL perps')
		// Slippage and markout share one basket: both are fill quality.
		expect(helper('execMarkout1m')).toBe(helper('execSlippage10k'))
		expect(helper('execCostToTrade')).not.toBe(helper('execSlippage10k'))
	})

	it('falls back to naming each venue’s own perps when nothing is shared', () => {
		const byId = columnsById(buildDirectoryColumns('linear_perp', true, [], []))
		for (const id of EXECUTION_COLUMN_IDS) {
			expect(String(byId[id]?.meta?.headerHelperText)).toContain('own covered perps')
		}
	})
})
