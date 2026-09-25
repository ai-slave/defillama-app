import { describe, expect, test } from 'vitest'
import { centerLeafLabel, pickLeafLabel } from '../leafLabel'

describe('market treemap leaf labels', () => {
	test('shows the largest logo, ticker, and change rows that fit the cell', () => {
		expect(pickLeafLabel(200, 200, 'TEST', '+1.50%', true)).toBe('{icon48|}\n{ticker18|TEST}\n{chg15|+1.50%}')
		expect(pickLeafLabel(40, 60, 'TEST', '+1.50%', true)).toBe('{icon20|}\n{ticker10|TEST}\n{chg9|+1.50%}')
		expect(pickLeafLabel(57, 200, 'TEST', '+1.50%', true)).toBe('{icon36|}\n{ticker15|TEST}\n{chg12|+1.50%}')
	})

	test('falls back to a bare logo, then to nothing, as the cell shrinks', () => {
		expect(pickLeafLabel(12, 14, 'TEST', '+1.50%', true)).toBe('{icon12|}')
		expect(pickLeafLabel(6, 6, 'TEST', '+1.50%', true)).toBe('')
	})

	test('uses text rows when the logo failed to load', () => {
		expect(pickLeafLabel(200, 200, 'TEST', '+1.50%', false)).toBe('{ticker18|TEST}\n{chg15|+1.50%}')
		expect(pickLeafLabel(20, 200, 'TEST', '+1.50%', false)).toBe('')
	})

	test('centers leaf rows vertically and leaves group names where ECharts puts them', () => {
		expect(centerLeafLabel('{icon20|}\n{ticker10|TEST}\n{chg9|+1.50%}', 60)).toEqual({ dy: 4.5 })
		expect(centerLeafLabel('Technology', 60)).toEqual({})
	})
})
