import { describe, expect, test } from 'vitest'
import { exchangeDefinitions } from '../definitions'
import { byRealPillarOrder, buildDirectoryColumns, EXECUTION_COLUMN_IDS } from '../directoryColumns'

function columnsById(columns: ReturnType<typeof buildDirectoryColumns>) {
	return Object.fromEntries(columns.map((column) => [column.id, column]))
}

describe('Exchanges definitions', () => {
	// Cost to trade and fill quality are published on different baskets on purpose, so a
	// column can only be compared DOWN the table, not across a row. Each header helper
	// has to name its own scope or a reader has no way to know that.
	test('each execution column states the basket it is measured on', () => {
		const byId = columnsById(buildDirectoryColumns('linear_perp', true, ['BTC', 'ETH'], ['BTC', 'ETH', 'SOL']))
		const definitions: Record<string, { label: string; description: string }> = exchangeDefinitions.directory
		const helper = (id: string) =>
			String(byId[id]?.meta?.headerHelperText).replace(definitions[id]?.description ?? '', '')

		expect(helper('execCostToTrade')).toContain('BTC, ETH perps')
		expect(helper('execSlippage10k')).toContain('BTC, ETH, SOL perps')
		// Slippage and markout share one basket: both are fill quality.
		expect(helper('execMarkout1m')).toBe(helper('execSlippage10k'))
		expect(helper('execCostToTrade')).not.toBe(helper('execSlippage10k'))
	})

	test('falls back to naming each venue’s own perps when nothing is shared', () => {
		const byId = columnsById(buildDirectoryColumns('linear_perp', true, [], []))
		for (const id of EXECUTION_COLUMN_IDS) {
			expect(String(byId[id]?.meta?.headerHelperText)).toContain('own covered perps')
		}
	})
})

// The name only reads if the pillars render in order, and the payload does not promise one.
describe('REAL pillar order', () => {
	test('orders pillars R, E, A, L whatever order the payload arrives in', () => {
		expect(['L', 'A', 'E', 'R'].sort(byRealPillarOrder)).toEqual(['R', 'E', 'A', 'L'])
	})

	test('sorts a pillar key it does not know last, never first', () => {
		expect(['X', 'L', 'R'].sort(byRealPillarOrder)).toEqual(['R', 'L', 'X'])
	})
})
