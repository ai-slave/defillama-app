import { describe, expect, it } from 'vitest'
import {
	getDirectoryOverviewTab,
	getDirectoryQueryState,
	getMicaFilter,
	getProfileReservesView,
	getProfileSegment,
	getProfileTab,
	getResearchView,
	getResearchViewQueryKey,
	getVenueHistoryMetric
} from '../queryState'

describe('Exchanges URL query state', () => {
	it('uses canonical defaults when parameters are absent or invalid', () => {
		expect(getDirectoryQueryState({})).toEqual({
			scope: 'spot',
			kind: 'all',
			group: 'activity'
		})
		expect(getDirectoryQueryState({ scope: 'perp', venue: 'hybrid', view: 'summary' })).toEqual({
			scope: 'spot',
			kind: 'all',
			group: 'activity'
		})
		expect(getDirectoryOverviewTab({ chartView: 'depth' })).toBe('total')
		expect(getMicaFilter({ product: 'options' })).toBe('all')
		expect(getProfileTab({ section: 'news' })).toBe('markets')
		expect(getProfileReservesView({ reservesView: 'inflows' })).toBe('assets')
		expect(getProfileSegment({ segment: 'options' })).toBeNull()
		expect(getVenueHistoryMetric({ history: 'funding' })).toBeNull()
	})

	it('reads directory and overview selections directly from the first query value', () => {
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

	it('reads MiCA and profile selections from their route-specific parameters', () => {
		expect(getMicaFilter({ product: 'fiat' })).toBe('fiat')
		expect(getProfileTab({ section: 'information' })).toBe('information')
		expect(getProfileTab({ section: 'reserves' })).toBe('reserves')
		expect(getProfileReservesView({ reservesView: 'stablecoins' })).toBe('stablecoins')
		expect(getProfileSegment({ segment: 'linear_perp' })).toBe('linear_perp')
		expect(getVenueHistoryMetric({ history: 'oi' })).toBe('oi')
	})

	it('keeps each research chart selection independent', () => {
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
