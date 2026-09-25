import { describe, expect, test } from 'vitest'
import { normalizeSqlResultRows } from '../../resultNormalization'
import { readSqlNumber, readSqlTimestampMs } from '../rowValues'

describe('SQL chart row values', () => {
	test('normalizes numbers and dates once before chart readers enter hot loops', () => {
		const result = normalizeSqlResultRows({
			columns: [
				{ name: 'integer', type: 'BIGINT' },
				{ name: 'decimal', type: 'DECIMAL(18, 2)' },
				{ name: 'date', type: 'VARCHAR' }
			],
			rows: [['3', '2.5', '2024-01-01']]
		})

		expect(result.rows).toEqual([[3, 2.5, 1_704_067_200_000]])
		expect(readSqlNumber(result.rows[0][0])).toBe(3)
		expect(readSqlNumber(result.rows[0][1])).toBe(2.5)
		expect(readSqlTimestampMs(result.rows[0][2])).toBe(1_704_067_200_000)
	})

	test('preserves unsafe integers exactly instead of feeding rounded values to charts', () => {
		const unsafe = '9007199254740993'
		const result = normalizeSqlResultRows({
			columns: [{ name: 'value', type: 'BIGINT' }],
			rows: [[unsafe]]
		})

		expect(result.rows[0][0]).toBe(unsafe)
		expect(readSqlNumber(result.rows[0][0])).toBeNull()
		expect(readSqlNumber(true, true)).toBe(1)
	})
})
