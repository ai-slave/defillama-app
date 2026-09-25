import { expect, test } from 'vitest'
import { combineCsvsWide } from '../combineCsvsWide'
import { filterCsvByDateRange } from '../csvDateFilter'
import { parseCsv } from '../csvParse'
import { sumCsvColumnsToTotal } from '../sumCsvColumns'

test('keeps quoted newlines, escaped quotes, trailing blanks and BOM headers in their columns', () => {
	expect(
		parseCsv(
			'\uFEFFdate,Name,Notes,Value\r\n2024-01-01,"Alpha, Inc.","line one\r\nline ""two""",\r\n2024-01-02,Beta,"a\rb",0\r\n'
		)
	).toEqual({
		headers: ['date', 'Name', 'Notes', 'Value'],
		rows: [
			{ id: 0, values: ['2024-01-01', 'Alpha, Inc.', 'line one\r\nline "two"', ''] },
			{ id: 1, values: ['2024-01-02', 'Beta', 'a\rb', '0'] }
		]
	})
})

test('date filtering keeps complete records without rewriting their quoted contents', () => {
	const csv = 'date,Notes,Value\n2024-01-01,"old\nrecord",1\n2024-01-02,"keep\n""quoted"" record",0\n2024-01-03,later,3'
	expect(filterCsvByDateRange(csv, { kind: 'custom', from: '2024-01-02', to: '2024-01-02' })).toBe(
		'date,Notes,Value\n2024-01-02,"keep\n""quoted"" record",0'
	)
	expect(filterCsvByDateRange(csv, null)).toBe(csv)
})

test('combining and summing CSVs retain real names, missing cells and numeric zero', () => {
	expect(
		combineCsvsWide([
			{ label: 'Ethereum', value: 'ethereum', csvText: 'date,value\n2024-01-01,0\n2024-01-02,12' },
			{ label: 'Solana', value: 'solana', csvText: 'date,value\n2024-01-02,3' }
		])
	).toEqual([
		['date', 'ethereum', 'solana'],
		['2024-01-01', '0', ''],
		['2024-01-02', '12', '3']
	])
	expect(sumCsvColumnsToTotal('date,"chain\nA",chainB\n2024-01-01,0,\n2024-01-02,12,3', 'Total')).toBe(
		'date,Total\r\n2024-01-01,0\r\n2024-01-02,15'
	)
})

test('keeps literal quotes in unquoted fields without absorbing following records', () => {
	expect(parseCsv('name,note\nfoo,5" pipe\nbar,ok\nbaz,fine')).toEqual({
		headers: ['name', 'note'],
		rows: [
			{ id: 0, values: ['foo', '5" pipe'] },
			{ id: 1, values: ['bar', 'ok'] },
			{ id: 2, values: ['baz', 'fine'] }
		]
	})
	const csv = '\uFEFF"date","note\r\ntext"\r\n2024-01-01,5" pipe\r\n2024-01-02,"keep\r\n""quoted"""'
	expect(parseCsv(csv)).toEqual({
		headers: ['date', 'note\r\ntext'],
		rows: [
			{ id: 0, values: ['2024-01-01', '5" pipe'] },
			{ id: 1, values: ['2024-01-02', 'keep\r\n"quoted"'] }
		]
	})
	expect(filterCsvByDateRange(csv, { kind: 'custom', from: '2024-01-02', to: '2024-01-02' })).toBe(
		'\uFEFF"date","note\r\ntext"\r\n2024-01-02,"keep\r\n""quoted"""'
	)
})
