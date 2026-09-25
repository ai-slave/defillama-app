import { describe, expect, test } from 'vitest'
import { getRwaPlatformViewQuery, parseRwaPlatformView } from '../view'

describe('parseRwaPlatformView', () => {
	test('assets is the default, and the three views read by name', () => {
		expect(parseRwaPlatformView(undefined)).toBe('assets')
		expect(parseRwaPlatformView('information')).toBe('information')
		expect(parseRwaPlatformView('compliance')).toBe('compliance')
		expect(parseRwaPlatformView(['compliance', 'information'])).toBe('compliance')
		expect(parseRwaPlatformView('peers')).toBe('assets')
	})
})

describe('getRwaPlatformViewQuery', () => {
	test('the default stays out of the URL, the other views are written by name', () => {
		expect(getRwaPlatformViewQuery('assets')).toBeUndefined()
		expect(getRwaPlatformViewQuery('information')).toBe('information')
		expect(getRwaPlatformViewQuery('compliance')).toBe('compliance')
	})
})
