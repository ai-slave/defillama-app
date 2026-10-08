import { describe, expect, test } from 'vitest'
import { parseRwaTableColumnSet } from '../../table/columnSetQuery'
import { getRwaEntityViewOptions, getRwaEntityViewQueryPatch, parseRwaEntityView } from '../view'

describe('parseRwaEntityView', () => {
	test('reads Information, and opens the list for anything else', () => {
		expect(parseRwaEntityView(undefined)).toBe('list')
		expect(parseRwaEntityView('information')).toBe('information')
		expect(parseRwaEntityView(['information', 'assets'])).toBe('information')
		expect(parseRwaEntityView('peers')).toBe('list')
		expect(parseRwaEntityView('markets')).toBe('list')
	})

	test('an old Compliance link opens the list with the Compliance column set', () => {
		const query = { view: 'compliance' }
		expect(parseRwaEntityView(query.view)).toBe('list')
		expect(parseRwaTableColumnSet(query, 'assets')).toBe('compliance')
	})
})

describe('getRwaEntityViewOptions', () => {
	test('Information first, then the list a platform calls Assets and a venue Markets', () => {
		expect(getRwaEntityViewOptions('platform').map((option) => option.label)).toEqual(['Information', 'Assets'])
		expect(getRwaEntityViewOptions('venue').map((option) => option.label)).toEqual(['Information', 'Markets'])
	})
})

describe('getRwaEntityViewQueryPatch', () => {
	test('keeps the list out of the URL and names Information', () => {
		expect(getRwaEntityViewQueryPatch('list', {})).toEqual({ view: undefined })
		expect(getRwaEntityViewQueryPatch('information', { view: 'information' })).toEqual({ view: 'information' })
		expect(getRwaEntityViewQueryPatch('list', { view: 'information', table: 'compliance' })).toEqual({
			view: undefined
		})
	})

	test('moves an old Compliance link onto the table switch, so the set survives a trip through Information', () => {
		const query = { view: 'compliance' }
		const patch = getRwaEntityViewQueryPatch('information', query)
		expect(patch).toEqual({ view: 'information', table: 'compliance' })
		const next = { ...query, ...patch }
		expect(parseRwaEntityView(next.view)).toBe('information')
		expect(parseRwaTableColumnSet({ ...next, ...getRwaEntityViewQueryPatch('list', next) }, 'assets')).toBe(
			'compliance'
		)
	})
})
