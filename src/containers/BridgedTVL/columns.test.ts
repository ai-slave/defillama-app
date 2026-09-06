import { describe, expect, test } from 'vitest'
import { buildBridgedColumns } from './BridgedTVLChainsList'
import type { IBridgedRow } from './types'

function columnIds(rows: Array<IBridgedRow>): Array<string> {
	return buildBridgedColumns(rows).map((column) => column.id ?? '')
}

const category = { total: 1, breakdown: {} }

const fiveSectionRow: IBridgedRow = {
	name: 'Ethereum',
	deprecated: false,
	total: category,
	canonical: category,
	thirdParty: category,
	native: category,
	ownTokens: category
}

describe('bridged chains columns', () => {
	test('renders no column for a section the producer never reports', () => {
		expect(columnIds([fiveSectionRow])).toEqual(['name', 'total', 'native', 'canonical', 'ownTokens', 'thirdParty'])
	})

	test('adds the v2-only columns once the producer reports them, keeping the original order first', () => {
		const eightSectionRow: IBridgedRow = {
			...fiveSectionRow,
			stablecoins: category,
			rwa: category,
			lst: category
		}

		expect(columnIds([eightSectionRow])).toEqual([
			'name',
			'total',
			'native',
			'canonical',
			'ownTokens',
			'thirdParty',
			'stablecoins',
			'rwa',
			'lst'
		])
	})

	test('keeps a column reported by only one chain during a partial rollout', () => {
		const rwaOnly: IBridgedRow = { ...fiveSectionRow, name: 'Base', rwa: category }

		expect(columnIds([fiveSectionRow, rwaOnly])).toContain('rwa')
		expect(columnIds([fiveSectionRow, rwaOnly])).not.toContain('lst')
	})
})
