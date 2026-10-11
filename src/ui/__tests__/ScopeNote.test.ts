import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { FailedDataNote, ignoredFiltersPhrase } from '../ScopeNote'

describe('ignoredFiltersPhrase', () => {
	test('names one, two or more ignored filters as a phrase', () => {
		expect(ignoredFiltersPhrase(['TVL range'])).toBe('the TVL range filter')
		expect(ignoredFiltersPhrase(['TVL range', 'Group Chains'])).toBe('the TVL range and Group Chains filters')
		expect(ignoredFiltersPhrase(['Market scope', 'Venue', 'Country'])).toBe(
			'the Market scope, Venue and Country filters'
		)
	})
})

describe('FailedDataNote', () => {
	// The markup escapes the apostrophe in "Couldn't", so match from the word after it.
	const note = (labels: Array<string>, shows: string) =>
		renderToStaticMarkup(createElement(FailedDataNote, { labels, shows }))

	test('names what failed and what the chart still shows', () => {
		expect(note(['Stablecoins Mcap'], 'The chart shows the other metrics.')).toContain(
			'load Stablecoins Mcap. The chart shows the other metrics.'
		)
		expect(note(['Staking', 'Pool2'], 'The chart shows TVL without them.')).toContain(
			'load Staking and Pool2. The chart shows TVL without them.'
		)
	})
})
