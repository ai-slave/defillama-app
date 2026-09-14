import { describe, expect, test } from 'vitest'
import { getRwaTableViewQuery, parseRwaTableView } from '../view'

describe('parseRwaTableView', () => {
	test('reads the perps key and falls back to the default', () => {
		expect(parseRwaTableView({ perps: 'true' }, false)).toBe('perps')
		expect(parseRwaTableView({ perps: 'false' }, true)).toBe('assets')
		expect(parseRwaTableView({}, false)).toBe('assets')
		expect(parseRwaTableView({}, true)).toBe('perps')
	})

	test('still understands the old includeRwaPerps key, with the new key winning', () => {
		expect(parseRwaTableView({ includeRwaPerps: 'true' }, false)).toBe('perps')
		expect(parseRwaTableView({ perps: 'false', includeRwaPerps: 'true' }, false)).toBe('assets')
		expect(parseRwaTableView({ perps: ['true', 'false'] }, false)).toBe('perps')
	})
})

describe('getRwaTableViewQuery', () => {
	test('writes the perps key only when it differs from the default and always clears the old key', () => {
		expect(getRwaTableViewQuery('perps', false)).toEqual({ perps: 'true', includeRwaPerps: undefined })
		expect(getRwaTableViewQuery('assets', false)).toEqual({ perps: undefined, includeRwaPerps: undefined })
		expect(getRwaTableViewQuery('assets', true)).toEqual({ perps: 'false', includeRwaPerps: undefined })
	})
})
