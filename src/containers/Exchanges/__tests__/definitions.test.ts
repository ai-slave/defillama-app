import { describe, expect, test } from 'vitest'
import { exchangeDefinitions } from '../definitions'
import { byRealPillarOrder, buildDirectoryColumns, EXECUTION_COLUMN_IDS } from '../directoryColumns'

function columnsById(columns: ReturnType<typeof buildDirectoryColumns>) {
	return Object.fromEntries(columns.map((column) => [column.id, column]))
}

describe('Exchanges definitions', () => {
	// Every execution column reads one segment of the venue; its header helper has to say
	// what that segment figure is built from, or a reader cannot compare it down the table.
	test('each execution column states what it is measured on', () => {
		for (const scope of ['all', 'spot', 'linear_perp', 'inverse_perp'] as const) {
			const byId = columnsById(buildDirectoryColumns(scope, true))
			const definitions: Record<string, { label: string; description: string }> = exchangeDefinitions.directory
			for (const id of EXECUTION_COLUMN_IDS) {
				const helper = String(byId[id]?.meta?.headerHelperText).replace(definitions[id]?.description ?? '', '')
				expect(helper).toMatch(/measured market/)
			}
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
