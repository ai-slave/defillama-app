import { describe, expect, test } from 'vitest'
import { hasStoredColumnWidths, tableCellAttrs } from '../renderer/articleTable'

const table = (colwidth: Array<number> | null) => ({
	type: 'table',
	content: [
		{
			type: 'tableRow',
			content: [
				{ type: 'tableHeader', attrs: colwidth ? { colwidth } : {} },
				{ type: 'tableHeader', attrs: {} }
			]
		}
	]
})

describe('published article tables', () => {
	test('use a fixed layout only when the editor stored a column width', () => {
		expect(hasStoredColumnWidths(table([400]))).toBe(true)
		expect(hasStoredColumnWidths(table(null))).toBe(false)
	})

	test('keep a resized cell width and its spans', () => {
		expect(tableCellAttrs({ type: 'tableCell', attrs: { colwidth: [400], colspan: 2, rowspan: 1 } })).toEqual({
			colSpan: 2,
			rowSpan: undefined,
			style: { width: '400px' }
		})
		expect(tableCellAttrs({ type: 'tableCell', attrs: { colwidth: null } }).style).toBeUndefined()
	})
})
