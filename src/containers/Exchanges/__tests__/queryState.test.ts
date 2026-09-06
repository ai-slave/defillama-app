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
		for (const scope of ['spot', 'linear_perp', 'inverse_perp'] as const) {
			expect(getDirectoryQueryState({ scope }).scope).toBe(scope)
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
				scope: ['inverse_perp', 'spot'],
				venue: 'dex',
				view: 'compliance'
			})
		).toEqual({ scope: 'inverse_perp', kind: 'dex', group: 'compliance' })
		expect(getDirectoryOverviewTab({ chartView: ['linear_perp', 'spot'] })).toBe('linear_perp')
		expect(getDirectoryOverviewTab({ chartView: 'inverse_perp' })).toBe('inverse_perp')
		// The combined-perp chart tab no longer exists.
		expect(getDirectoryOverviewTab({ chartView: 'perp' })).toBe('total')
	})

	test('reads MiCA and profile selections from their route-specific parameters', () => {
		expect(getMicaFilter({ product: 'fiat' })).toBe('fiat')
		expect(getProfileTab({ section: 'information' })).toBe('information')
		expect(getProfileTab({ section: 'reserves' })).toBe('reserves')
		expect(getProfileTab({ section: 'history' })).toBe('history')
		expect(getProfileReservesView({ reservesView: 'stablecoins' })).toBe('stablecoins')
		expect(getProfileSegment({ segment: 'linear_perp' })).toBe('linear_perp')
		expect(parseExchangeCountry({ country: 'de' })).toBe('DE')
		expect(parseExchangeCountry({ country: ['no', 'de'] })).toBe('NO')
		expect(getVenueHistoryMetric({ history: 'oi' })).toBe('oi')
		expect(getResearchRange({ range: '90d' })).toBe('90d')
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
			volumeView: 'linear-perp-exchanges',
			oiView: 'open-interest-inverse-exchanges',
			depthView: 'btc-depth',
			nvolView: 'survival-linear-exchanges'
		}

		expect(getResearchViewQueryKey('volume')).toBe('volumeView')
		expect(getResearchView(query, 'volume')).toBe('linear-perp-exchanges')
		expect(getResearchView(query, 'oi')).toBe('open-interest-inverse-exchanges')
		expect(getResearchView(query, 'depth')).toBe('btc-depth')
		expect(getResearchView(query, 'nvol')).toBe('survival-linear-exchanges')
		expect(getResearchView({ volumeView: 'types' }, 'volume')).toBeNull()
		// Retired combined-perp view ids fall back to the part default.
		expect(getResearchView({ volumeView: 'perp-exchanges' }, 'volume')).toBeNull()
		expect(getResearchView({ volumeView: 'unsupported-view' }, 'volume')).toBeNull()
	})
})
