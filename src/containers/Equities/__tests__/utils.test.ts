import { describe, expect, it } from 'vitest'
import {
	buildEquityTickerCountrySlug,
	parseEquityTickerCountryParam,
	parseEquityTickerCountrySlug
} from '../tickerCountry'

describe('equities slug helpers', () => {
	it('builds ticker-country slugs from provided values', () => {
		expect(buildEquityTickerCountrySlug('NVDA', 'US')).toBe('NVDA:US')
		expect(buildEquityTickerCountrySlug('nvda', 'us')).toBe('nvda:us')
	})

	it('parses ticker-country slugs without normalizing values', () => {
		expect(parseEquityTickerCountrySlug('NVDA:US')).toEqual({ ticker: 'NVDA', country: 'US' })
		expect(parseEquityTickerCountrySlug('nvda:us')).toEqual({ ticker: 'nvda', country: 'us' })
		expect(parseEquityTickerCountrySlug('nvda')).toBeNull()
		expect(parseEquityTickerCountrySlug('nvda:us:x')).toBeNull()
	})

	it('keeps old ticker-only dashboard params on US equities', () => {
		expect(parseEquityTickerCountryParam('aapl')).toEqual({ ticker: 'aapl', country: 'US' })
		expect(parseEquityTickerCountryParam('aapl:us')).toEqual({ ticker: 'aapl', country: 'us' })
	})
})
