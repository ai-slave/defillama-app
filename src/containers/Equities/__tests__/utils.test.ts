import { describe, expect, test } from 'vitest'
import { parseEquityTickerCountryParam, parseEquityTickerCountrySlug } from '../tickerCountry'

describe('equities slug helpers', () => {
	test('parses ticker-country slugs without normalizing values', () => {
		expect(parseEquityTickerCountrySlug('NVDA:US')).toEqual({ ticker: 'NVDA', country: 'US' })
		expect(parseEquityTickerCountrySlug('nvda:us')).toEqual({ ticker: 'nvda', country: 'us' })
		expect(parseEquityTickerCountrySlug('nvda')).toBeNull()
		expect(parseEquityTickerCountrySlug('nvda:us:x')).toBeNull()
	})

	test('keeps old ticker-only dashboard params on US equities', () => {
		expect(parseEquityTickerCountryParam('aapl')).toEqual({ ticker: 'aapl', country: 'US' })
		expect(parseEquityTickerCountryParam('aapl:us')).toEqual({ ticker: 'aapl', country: 'us' })
	})
})
