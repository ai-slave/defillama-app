import { describe, expect, test } from 'vitest'
import { ignoredFiltersPhrase } from '../ChartScopeNote'

describe('ignoredFiltersPhrase', () => {
	test('names one, two or more ignored filters as a phrase', () => {
		expect(ignoredFiltersPhrase(['TVL range'])).toBe('the TVL range filter')
		expect(ignoredFiltersPhrase(['TVL range', 'Group Chains'])).toBe('the TVL range and Group Chains filters')
		expect(ignoredFiltersPhrase(['Market scope', 'Venue', 'Country'])).toBe(
			'the Market scope, Venue and Country filters'
		)
	})
})
