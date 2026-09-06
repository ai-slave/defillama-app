// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { tableImageFilename } from '../renderTableImage'
import { readColumnWidths, readTableRows } from '../TableImageButtons'

function tableFrom(html: string): HTMLTableElement {
	const host = document.createElement('div')
	host.innerHTML = html
	return host.querySelector('table') as HTMLTableElement
}

describe('readTableRows', () => {
	test('reads header and body cells in source order', () => {
		const table = tableFrom(`
			<table>
				<thead><tr><th>Metric</th><th>Aave</th></tr></thead>
				<tbody><tr><td>Market cap</td><td>$1.90B</td></tr></tbody>
			</table>
		`)
		expect(readTableRows(table)).toEqual([
			['Metric', 'Aave'],
			['Market cap', '$1.90B']
		])
	})

	test('trims cell text and skips rows with no cells', () => {
		const table = tableFrom(`
			<table>
				<tbody>
					<tr></tr>
					<tr><td>  padded  </td><td></td></tr>
				</tbody>
			</table>
		`)
		expect(readTableRows(table)).toEqual([['padded', '']])
	})

	test('returns an empty list when there is no table', () => {
		expect(readTableRows(null)).toEqual([])
	})
})

describe('readColumnWidths', () => {
	test('reads stored colgroup widths and keeps unset columns null', () => {
		const table = tableFrom(`
			<table>
				<colgroup><col style="width: 233px" /><col /><col style="width: 90px" /></colgroup>
				<tbody><tr><td>a</td><td>b</td><td>c</td></tr></tbody>
			</table>
		`)
		expect(readColumnWidths(table)).toEqual([233, null, 90])
	})

	test('returns undefined when no column carries a width', () => {
		const table = tableFrom(`
			<table>
				<colgroup><col /><col /></colgroup>
				<tbody><tr><td>a</td><td>b</td></tr></tbody>
			</table>
		`)
		expect(readColumnWidths(table)).toBeUndefined()
	})

	test('returns undefined when the table has no colgroup', () => {
		const table = tableFrom('<table><tbody><tr><td>a</td></tr></tbody></table>')
		expect(readColumnWidths(table)).toBeUndefined()
	})
})

describe('tableImageFilename', () => {
	test('slugs the title and appends the date', () => {
		expect(tableImageFilename('Top 5 fee days')).toMatch(/^top-5-fee-days-\d{4}-\d{2}-\d{2}\.png$/)
	})

	test('falls back to a generic name when there is no usable title', () => {
		expect(tableImageFilename(undefined)).toMatch(/^table-\d{4}-\d{2}-\d{2}\.png$/)
		expect(tableImageFilename('  ***  ')).toMatch(/^table-\d{4}-\d{2}-\d{2}\.png$/)
	})
})
