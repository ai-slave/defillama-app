import { describe, expect, test } from 'vitest'
import { getRwaPlatformViewQuery, parseRwaPlatformView, RWA_PLATFORM_VIEW_OPTIONS } from '../view'

describe('parseRwaPlatformView', () => {
	test('assets is the default, and the three views read by name', () => {
		expect(parseRwaPlatformView(undefined)).toBe('assets')
		expect(parseRwaPlatformView('information')).toBe('information')
		expect(parseRwaPlatformView('compliance')).toBe('compliance')
		expect(parseRwaPlatformView(['compliance', 'information'])).toBe('compliance')
	})

	test('the retired views and anything else read as assets', () => {
		expect(parseRwaPlatformView('peers')).toBe('assets')
		expect(parseRwaPlatformView('mix')).toBe('assets')
		expect(parseRwaPlatformView('Compliance')).toBe('assets')
	})
})

describe('getRwaPlatformViewQuery', () => {
	test('the default stays out of the URL, the other views are written by name', () => {
		expect(getRwaPlatformViewQuery('assets')).toBeUndefined()
		expect(getRwaPlatformViewQuery('information')).toBe('information')
		expect(getRwaPlatformViewQuery('compliance')).toBe('compliance')
	})
})

describe('RWA_PLATFORM_VIEW_OPTIONS', () => {
	test('reads Information, Assets, Compliance in the strip order', () => {
		expect(RWA_PLATFORM_VIEW_OPTIONS.map((option) => option.label)).toEqual(['Information', 'Assets', 'Compliance'])
	})
})
