import { describe, expect, test } from 'vitest'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import {
	assertCustomDataSizeAllowed,
	CUSTOM_DATA_MAX_COLUMNS,
	CUSTOM_DATA_MAX_ROWS,
	CUSTOM_DATA_MAX_TEXT_LENGTH,
	CustomDataParseError,
	parseCustomDataCsv
} from './parseCustomDataCsv'

describe('parseCustomDataCsv', () => {
	test('sniffs column types that the SQL chart classifier understands', () => {
		const parsed = parseCustomDataCsv(
			[
				'day,ts,count,amount,active,label',
				'2026-01-01,2026-01-01T00:00:00Z,10,1.5,true,Alpha',
				'2026-01-02,2026-01-02T12:30:00Z,-3,2e3,FALSE,Beta',
				'2026-01-03,,,,,'
			].join('\n')
		)
		expect(parsed.columns).toEqual([
			{ name: 'day', type: 'DATE' },
			{ name: 'ts', type: 'TIMESTAMP' },
			{ name: 'count', type: 'BIGINT' },
			{ name: 'amount', type: 'DOUBLE' },
			{ name: 'active', type: 'BOOLEAN' },
			{ name: 'label', type: 'VARCHAR' }
		])
		expect(parsed.rows).toEqual([
			[Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1), 10, 1.5, true, 'Alpha'],
			[Date.UTC(2026, 0, 2), Date.UTC(2026, 0, 2, 12, 30), -3, 2000, false, 'Beta'],
			[Date.UTC(2026, 0, 3), null, null, null, null, null]
		])
		expect(parsed.result).toEqual({ columns: parsed.columns, rows: parsed.rows })
		expect(classifyColumns(parsed.result).map((column) => column.coarse)).toEqual([
			'date',
			'date',
			'number',
			'number',
			'category',
			'category'
		])
	})

	test('falls back to text when a column mixes kinds and treats empty columns as text', () => {
		const parsed = parseCustomDataCsv('mixed,empty\n1,\nabc,\n2026-01-01,')
		expect(parsed.columns).toEqual([
			{ name: 'mixed', type: 'VARCHAR' },
			{ name: 'empty', type: 'VARCHAR' }
		])
		expect(parsed.rows).toEqual([
			['1', null],
			['abc', null],
			['2026-01-01', null]
		])
	})

	test('keeps quoted values, suffixes duplicate headers and names blank headers', () => {
		const parsed = parseCustomDataCsv('name,name,,name\n"Doe, Jane",1,2,3\n')
		expect(parsed.columns.map((column) => column.name)).toEqual(['name', 'name_2', 'column_3', 'name_3'])
		expect(parsed.rows[0]).toEqual(['Doe, Jane', 1, 2, 3])
	})

	test('never produces a suffixed name that another header already uses', () => {
		const parsed = parseCustomDataCsv('date,value,value,value_2\n2026-01-01,1,2,3\n')
		expect(parsed.columns.map((column) => column.name)).toEqual(['date', 'value', 'value_2', 'value_2_2'])
	})

	test('reports shape problems with row numbers that match the spreadsheet', () => {
		expect(() => parseCustomDataCsv('')).toThrow(new CustomDataParseError('The CSV has no header row.'))
		expect(() => parseCustomDataCsv('a,b\n')).toThrow('The CSV has a header but no data rows.')
		expect(() => parseCustomDataCsv('a,b,c\n1,2,3\n4,5\n')).toThrow('Row 3 has 2 columns, expected 3.')
	})

	test('enforces the column, row and text-size limits before doing expensive work', () => {
		const wideHeader = Array.from({ length: CUSTOM_DATA_MAX_COLUMNS + 1 }, (_, index) => `c${index}`).join(',')
		expect(() => parseCustomDataCsv(`${wideHeader}\n${wideHeader}`)).toThrow(
			`The CSV has ${CUSTOM_DATA_MAX_COLUMNS + 1} columns. The limit is ${CUSTOM_DATA_MAX_COLUMNS}.`
		)

		const tall = ['v', ...Array.from({ length: CUSTOM_DATA_MAX_ROWS + 1 }, () => '1')].join('\n')
		expect(() => parseCustomDataCsv(tall)).toThrow(
			`The CSV has ${CUSTOM_DATA_MAX_ROWS + 1} rows. The limit is ${CUSTOM_DATA_MAX_ROWS}.`
		)

		expect(() => assertCustomDataSizeAllowed(CUSTOM_DATA_MAX_TEXT_LENGTH)).not.toThrow()
		expect(() => assertCustomDataSizeAllowed(CUSTOM_DATA_MAX_TEXT_LENGTH + 1)).toThrow(
			`CSV is too large (${Math.round((CUSTOM_DATA_MAX_TEXT_LENGTH + 1) / 1024)} KB). The limit is 200 KB.`
		)
		expect(() => parseCustomDataCsv('x'.repeat(CUSTOM_DATA_MAX_TEXT_LENGTH + 1))).toThrow(CustomDataParseError)
	})
})
