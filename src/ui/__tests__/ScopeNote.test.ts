import { describe, expect, test } from 'vitest'
import { failedDataNote, ignoredFiltersPhrase, listPhrase } from '../ScopeNote'

describe('listPhrase', () => {
	test('joins one, two or more names into a sentence fragment', () => {
		expect(listPhrase(['Ethereum'])).toBe('Ethereum')
		expect(listPhrase(['Ethereum', 'Solana'])).toBe('Ethereum and Solana')
		expect(listPhrase(['Ethereum', 'Solana', 'Base'])).toBe('Ethereum, Solana and Base')
	})
})

describe('ignoredFiltersPhrase', () => {
	test('names one, two or more ignored filters as a phrase', () => {
		expect(ignoredFiltersPhrase(['TVL range'])).toBe('the TVL range filter')
		expect(ignoredFiltersPhrase(['TVL range', 'Group Chains'])).toBe('the TVL range and Group Chains filters')
		expect(ignoredFiltersPhrase(['Market scope', 'Venue', 'Country'])).toBe(
			'the Market scope, Venue and Country filters'
		)
	})
})

describe('failedDataNote', () => {
	test('names what failed and what the chart still shows', () => {
		expect(failedDataNote(['Stablecoins Mcap'], 'The chart shows the other metrics.')).toBe(
			"Couldn't load Stablecoins Mcap. The chart shows the other metrics."
		)
		expect(failedDataNote(['Staking', 'Pool2'], 'The chart shows TVL without them.')).toBe(
			"Couldn't load Staking and Pool2. The chart shows TVL without them."
		)
	})
})
