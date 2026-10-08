import { describe, expect, test } from 'vitest'
import { getRwaTableColumnSetQuery, parseRwaTableColumnSet } from '../columnSetQuery'

describe('parseRwaTableColumnSet', () => {
	test('opens Metrics by default and reads the table key per row kind', () => {
		expect(parseRwaTableColumnSet({}, 'assets')).toBe('metrics')
		expect(parseRwaTableColumnSet({ table: 'compliance' }, 'assets')).toBe('compliance')
	})

	test('falls back to Metrics for a set the row kind does not have', () => {
		expect(parseRwaTableColumnSet({ table: 'compliance' }, 'perps')).toBe('metrics')
	})

	test('still opens Compliance from a shared view=compliance link, with the table key winning', () => {
		expect(parseRwaTableColumnSet({ view: 'compliance' }, 'assets')).toBe('compliance')
		expect(parseRwaTableColumnSet({ view: 'information' }, 'assets')).toBe('metrics')
		expect(parseRwaTableColumnSet({ view: 'compliance', table: 'metrics' }, 'assets')).toBe('metrics')
	})
})

describe('getRwaTableColumnSetQuery', () => {
	test('leaves the URL clean for Metrics and clears an old view=compliance', () => {
		expect(getRwaTableColumnSetQuery('metrics', { view: 'compliance' })).toEqual({ table: undefined, view: undefined })
		expect(getRwaTableColumnSetQuery('compliance', {})).toEqual({ table: 'compliance' })
		expect(getRwaTableColumnSetQuery('compliance', { view: 'information' })).toEqual({ table: 'compliance' })
	})
})
