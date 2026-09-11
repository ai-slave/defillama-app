import { describe, expect, test } from 'vitest'
import {
	getDirectoryOverviewTab,
	getDirectoryQueryState,
	getMicaFilter,
	parseExchangeCountry,
	getProfileReservesView,
	getProfileSegment,
	getProfileTab,
	getResearchRange,
	getResearchView,
	getResearchViewQueryKey,
	segmentQueryValue,
	getVenueHistoryMetric,
	withCountryParam
} from '../queryState'

describe('Exchanges URL query state', () => {
	test('uses canonical defaults when parameters are absent or invalid', () => {
		expect(getDirectoryQueryState({})).toEqual({
			scope: 'all',
			kind: 'all',
			group: 'activity'
		})
		expect(getDirectoryQueryState({ scope: 'perp', venue: 'hybrid', view: 'summary' })).toEqual({
			scope: 'all',
			kind: 'all',
			group: 'activity'
		})
		// Every exact segment still round-trips, including COIN perps, which the merged
		// view leaves out — the segment tables are unchanged.
		for (const [value, scope] of [
			['spot', 'spot'],
			['usd_perp', 'linear_perp'],
			['coin_perp', 'inverse_perp']
		] as const) {
			expect(getDirectoryQueryState({ scope: value }).scope).toBe(scope)
		}
		expect(getDirectoryOverviewTab({ chartView: 'depth' })).toBe('total')
		expect(getMicaFilter({ product: 'options' })).toBe('all')
		expect(getProfileTab({ section: 'news' })).toBe('markets')
		expect(getProfileReservesView({ reservesView: 'inflows' })).toBe('assets')
		expect(getProfileSegment({ segment: 'options' })).toBeNull()
		expect(parseExchangeCountry({ country: 'europe' })).toBeNull()
		expect(getVenueHistoryMetric({ history: 'funding' })).toBeNull()
		// Full history is the default: a window that hides when a metric started
		// collecting is how a coverage step gets read as a market move.
		expect(getResearchRange({ range: '7d' })).toBe('all')
		expect(getResearchRange({})).toBe('all')
		expect(getResearchRange({ range: '90d' })).toBe('90d')
	})

	test('reads directory and overview selections directly from the first query value', () => {
		expect(
			getDirectoryQueryState({
				scope: ['coin_perp', 'spot'],
				venue: 'dex',
				view: 'compliance'
			})
		).toEqual({ scope: 'inverse_perp', kind: 'dex', group: 'compliance' })
		expect(getDirectoryOverviewTab({ chartView: ['usd_perp', 'spot'] })).toBe('linear_perp')
		expect(getDirectoryOverviewTab({ chartView: 'coin_perp' })).toBe('inverse_perp')
		// The combined-perp chart tab no longer exists.
		expect(getDirectoryOverviewTab({ chartView: 'perp' })).toBe('total')
	})

	test('reads MiCA and profile selections from their route-specific parameters', () => {
		expect(getMicaFilter({ product: 'fiat' })).toBe('fiat')
		expect(getProfileTab({ section: 'information' })).toBe('information')
		expect(getProfileTab({ section: 'reserves' })).toBe('reserves')
		expect(getProfileTab({ section: 'history' })).toBe('history')
		expect(getProfileReservesView({ reservesView: 'stablecoins' })).toBe('stablecoins')
		expect(getProfileSegment({ segment: 'usd_perp' })).toBe('linear_perp')
		expect(parseExchangeCountry({ country: 'de' })).toBe('DE')
		expect(parseExchangeCountry({ country: ['no', 'de'] })).toBe('NO')
		expect(getVenueHistoryMetric({ history: 'oi' })).toBe('oi')
		expect(getResearchRange({ range: '90d' })).toBe('90d')
	})

	// Nothing a reader sees says linear or inverse, the address bar included. The payload
	// keys keep their own spelling, so the URL value and the segment are not the same string.
	test('reads and writes USD/COIN perp segment values', () => {
		expect(segmentQueryValue('linear_perp')).toBe('usd_perp')
		expect(segmentQueryValue('inverse_perp')).toBe('coin_perp')
		expect(segmentQueryValue('spot')).toBe('spot')

		expect(getDirectoryQueryState({ scope: 'usd_perp' }).scope).toBe('linear_perp')
		expect(getDirectoryOverviewTab({ chartView: 'coin_perp' })).toBe('inverse_perp')
		expect(getProfileSegment({ segment: 'usd_perp' })).toBe('linear_perp')
		expect(getProfileSegment({ segment: 'all' })).toBe('all')
		expect(getProfileSegment({ segment: 'options' })).toBeNull()

		// The payload spellings are not URL values and must not resolve.
		expect(getDirectoryQueryState({ scope: 'linear_perp' }).scope).toBe('all')
		expect(getDirectoryOverviewTab({ chartView: 'inverse_perp' })).toBe('total')
		expect(getResearchView({ volumeView: 'usd-perp-exchanges' }, 'volume')).toBe('usd-perp-exchanges')
		expect(getResearchView({ volumeView: 'linear-perp-exchanges' }, 'volume')).toBeNull()
		expect(getResearchView({ volumeView: 'made-up-view' }, 'volume')).toBeNull()
	})

	// These parse a raw query value, so an object lookup would answer `?scope=constructor`
	// with a function off the prototype and hand it on as a segment.
	test('rejects prototype keys instead of resolving them', () => {
		for (const value of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
			expect(getDirectoryQueryState({ scope: value }).scope).toBe('all')
			expect(getDirectoryOverviewTab({ chartView: value })).toBe('total')
			expect(getProfileSegment({ segment: value })).toBeNull()
			expect(getResearchView({ volumeView: value }, 'volume')).toBeNull()
		}
	})

	test('carries the country selection onto links between country-aware pages', () => {
		expect(withCountryParam('/exchanges', 'DE')).toBe('/exchanges?country=de')
		expect(withCountryParam('/exchange/binance?section=information', 'DE')).toBe(
			'/exchange/binance?section=information&country=de'
		)
		expect(withCountryParam('/mica', null)).toBe('/mica')
	})

	test('keeps each research chart selection independent', () => {
		const query = {
			volumeView: 'usd-perp-exchanges',
			oiView: 'open-interest-coin-exchanges',
			depthView: 'btc-depth',
			nvolView: 'survival-usd-exchanges'
		}

		expect(getResearchViewQueryKey('volume')).toBe('volumeView')
		expect(getResearchView(query, 'volume')).toBe('usd-perp-exchanges')
		expect(getResearchView(query, 'oi')).toBe('open-interest-coin-exchanges')
		expect(getResearchView(query, 'depth')).toBe('btc-depth')
		expect(getResearchView(query, 'nvol')).toBe('survival-usd-exchanges')
		expect(getResearchView({ volumeView: 'types' }, 'volume')).toBeNull()
		// Retired combined-perp view ids fall back to the part default.
		expect(getResearchView({ volumeView: 'perp-exchanges' }, 'volume')).toBeNull()
		expect(getResearchView({ volumeView: 'unsupported-view' }, 'volume')).toBeNull()
	})
})
