import { describe, expect, test } from 'vitest'
import { getRwaTableColumnSetQuery, parseRwaTableColumnSet, type RWATableColumnSet } from '../columnSetQuery'

type Query = Record<string, string | undefined>

/** The address after a pick: the writer's patch over the current query, as the table pushes it. */
const pick = (columnSet: RWATableColumnSet, query: Query): Query => ({
	...query,
	...getRwaTableColumnSetQuery(columnSet, query)
})

describe('the table column set in the URL', () => {
	test('opens Metrics on a bare address and reopens the set the reader picked', () => {
		expect(parseRwaTableColumnSet({}, 'assets')).toBe('metrics')
		const compliance = pick('compliance', {})
		expect(parseRwaTableColumnSet(compliance, 'assets')).toBe('compliance')
		const metrics = pick('metrics', compliance)
		expect(parseRwaTableColumnSet(metrics, 'assets')).toBe('metrics')
		// Metrics is the default, so picking it back leaves no table value in the address.
		expect(metrics).toEqual({ table: undefined })
	})

	test('leaves the platform page view in the address when the reader picks a set', () => {
		expect(pick('compliance', { view: 'information' })).toEqual({ view: 'information', table: 'compliance' })
	})

	test('opens Metrics on perps rows, which have no Compliance set', () => {
		expect(parseRwaTableColumnSet(pick('compliance', {}), 'perps')).toBe('metrics')
	})

	test('still opens Compliance from a shared view=compliance link, and a later Metrics pick clears it', () => {
		const legacy = { view: 'compliance' }
		expect(parseRwaTableColumnSet(legacy, 'assets')).toBe('compliance')
		expect(parseRwaTableColumnSet({ view: 'information' }, 'assets')).toBe('metrics')
		expect(parseRwaTableColumnSet(pick('metrics', legacy), 'assets')).toBe('metrics')
	})
})
