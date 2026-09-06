import { describe, expect, test } from 'vitest'
import type { ParsedCsvRow } from './csvParse'
import { createPreviewSearchIndex, filterPreviewRows } from './previewSearch'

const rows: Array<ParsedCsvRow> = [
	{ id: 0, values: ['Aave', 'Ethereum', 'trailing value'] },
	{ id: 1, values: ['Morpho', 'Base', 'another trailing value'] }
]
const searchIndex = createPreviewSearchIndex(rows, 2)

describe('preview search index', () => {
	test('searches header-backed cells case-insensitively while preserving row order', () => {
		expect(filterPreviewRows(rows, searchIndex, 'a')).toEqual(rows)
		expect(filterPreviewRows(rows, searchIndex, 'ethereum')).toEqual([rows[0]])
	})

	test('does not search trailing cells without a header', () => {
		expect(filterPreviewRows(rows, searchIndex, 'trailing')).toEqual([])
	})

	test('returns the original rows for an empty search', () => {
		expect(filterPreviewRows(rows, searchIndex, '')).toBe(rows)
	})
})
