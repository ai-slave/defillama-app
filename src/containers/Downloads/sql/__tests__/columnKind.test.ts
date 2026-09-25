import { describe, expect, test } from 'vitest'
import { defaultChartConfig } from '../chartConfig'
import {
	classifyColumn,
	classifyColumns,
	inferFineKindFromArrowType,
	looksLikeISODate,
	looksLikeNumericArray
} from '../columnKind'
import type { QueryResult } from '../exportResults'

describe('inferFineKindFromArrowType', () => {
	test('classifies common Arrow types', () => {
		expect(inferFineKindFromArrowType('Int64')).toBe('int')
		expect(inferFineKindFromArrowType('Int32')).toBe('int')
		expect(inferFineKindFromArrowType('Float64')).toBe('float')
		expect(inferFineKindFromArrowType('Double')).toBe('float')
		expect(inferFineKindFromArrowType('Decimal(18,6)')).toBe('float')
		expect(inferFineKindFromArrowType('Utf8')).toBe('text')
		expect(inferFineKindFromArrowType('LargeUtf8')).toBe('text')
		expect(inferFineKindFromArrowType('VARCHAR')).toBe('text')
		expect(inferFineKindFromArrowType('Boolean')).toBe('bool')
		expect(inferFineKindFromArrowType('Date32<DAY>')).toBe('date')
		expect(inferFineKindFromArrowType('Timestamp<MILLISECOND, null>')).toBe('date')
		expect(inferFineKindFromArrowType('List<Double>')).toBe('list')
		expect(inferFineKindFromArrowType('LIST<DOUBLE>')).toBe('list')
		expect(inferFineKindFromArrowType('LargeList<Int64>')).toBe('list')
		expect(inferFineKindFromArrowType('Struct<x:Int32>')).toBe('other')
		expect(inferFineKindFromArrowType(undefined)).toBe('other')
	})
})

describe('looksLikeISODate', () => {
	test('matches YYYY-MM-DD and timestamps', () => {
		expect(looksLikeISODate('2024-01-17')).toBe(true)
		expect(looksLikeISODate('2024-01-17T12:34:56')).toBe(true)
		expect(looksLikeISODate('2024-01-17T12:34:56.123Z')).toBe(true)
		expect(looksLikeISODate('2024-01-17T12:34:56+00:00')).toBe(true)
	})
	test('rejects non-dates', () => {
		expect(looksLikeISODate('hello')).toBe(false)
		expect(looksLikeISODate('2024/01/17')).toBe(false)
		expect(looksLikeISODate(17)).toBe(false)
		expect(looksLikeISODate(null)).toBe(false)
	})
})

describe('looksLikeNumericArray', () => {
	test('true for numeric arrays', () => {
		expect(looksLikeNumericArray([1, 2, 3])).toBe(true)
		expect(looksLikeNumericArray([1, null, 3])).toBe(true)
		expect(looksLikeNumericArray([])).toBe(true)
	})
	test('false for non-numeric', () => {
		expect(looksLikeNumericArray([1, 'x', 3])).toBe(false)
		expect(looksLikeNumericArray('abc')).toBe(false)
		expect(looksLikeNumericArray({ a: 1 })).toBe(false)
	})
})

describe('classifyColumn', () => {
	test('promotes text column of ISO dates to date', () => {
		const rows = [['2024-01-17'], ['2024-01-18'], ['2024-01-19']]
		const result = classifyColumn('Utf8', 'x', rows)
		expect(result.fine).toBe('date')
		expect(result.coarse).toBe('date')
	})
	test('keeps text column as category when any sample is not ISO', () => {
		const rows = [['2024-01-17'], ['not-a-date']]
		const result = classifyColumn('Utf8', 'x', rows)
		expect(result.fine).toBe('text')
		expect(result.coarse).toBe('category')
	})
	test('detects numeric-array columns as list', () => {
		const rows = [[[1, 2, 3]], [null]]
		const result = classifyColumn('Map<String, Double>', 'x', rows)
		expect(result.fine).toBe('list')
		expect(result.coarse).toBe('other')
	})
	test('skips empty text samples', () => {
		const rows = [[''], [null]]
		const result = classifyColumn('Utf8', 'x', rows)
		expect(result.fine).toBe('text')
	})
})

describe('classifyColumns', () => {
	test('classifies all columns of a result into chartable kinds', () => {
		const result: QueryResult = {
			columns: [
				{ name: 'date', type: 'Utf8' },
				{ name: 'tvl', type: 'Float64' },
				{ name: 'chain', type: 'Utf8' },
				{ name: 'protocols', type: 'Int64' },
				{ name: 'audited', type: 'Boolean' },
				{ name: 'listed_at', type: 'Timestamp<MILLISECOND, null>' },
				{ name: 'history', type: 'List<Double>' }
			],
			rows: [
				['2024-01-01', 1.0, 'ethereum', 3, true, 1, [1]],
				['2024-01-02', 2.0, 'arbitrum', 4, false, 2, [2]]
			]
		}
		expect(classifyColumns(result).map((column) => [column.fine, column.coarse])).toEqual([
			['date', 'date'],
			['float', 'number'],
			['text', 'category'],
			['int', 'number'],
			['bool', 'category'],
			['date', 'date'],
			['list', 'other']
		])
	})

	test('preserves categorical chart defaults for server DuckDB results', () => {
		const result: QueryResult = {
			columns: [
				{ name: 'name', type: 'VARCHAR' },
				{ name: 'tvl', type: 'DOUBLE' },
				{ name: 'change_7d', type: 'DOUBLE' }
			],
			rows: [['Aave', 19.46, 1.2]]
		}
		const classified = classifyColumns(result)
		expect(classified.map((column) => column.coarse)).toEqual(['category', 'number', 'number'])
		expect(defaultChartConfig(classified)).toMatchObject({ chartType: 'bar', xCol: 'name' })
	})
})
