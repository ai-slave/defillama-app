import { describe, expect, test } from 'vitest'
import { matchModeQuery, matchOnQuery, toggleTokenQuery } from '../Filters/includeTokensQuery'

describe('token search URL updates', () => {
	test('match settings chosen before any token stay local, then ride along with the first token', () => {
		expect(matchModeQuery('contains', false)).toBeNull()
		expect(matchOnQuery('pool', false)).toBeNull()
		expect(toggleTokenQuery([], 'ETH', false, { mode: 'contains', on: 'pool' })).toEqual({
			token: ['ETH'],
			tokenMatch: 'contains',
			tokenOn: 'pool'
		})
	})

	test('with a token selected, a match change applies at once and a default leaves the URL', () => {
		expect(matchModeQuery('set', true)).toEqual({ tokenMatch: 'set' })
		expect(matchModeQuery('exact', true)).toEqual({ tokenMatch: undefined })
		expect(matchOnQuery('both', true)).toEqual({ tokenOn: 'both' })
		expect(matchOnQuery('reference', true)).toEqual({ tokenOn: undefined })
	})

	test('removing the last token clears the match settings from the URL', () => {
		expect(toggleTokenQuery(['ETH'], 'ETH', true, { mode: 'set', on: 'both' })).toEqual({
			token: [],
			tokenMatch: undefined,
			tokenOn: undefined
		})
		expect(toggleTokenQuery(['ETH', 'USDC'], 'ETH', true, { mode: 'set', on: 'both' })).toEqual({
			token: ['USDC'],
			tokenMatch: 'set',
			tokenOn: 'both'
		})
	})

	test('a page without match settings only writes the token list', () => {
		expect(toggleTokenQuery(['ETH'], 'USDC', false, null)).toEqual({ token: ['ETH', 'USDC'] })
	})
})
