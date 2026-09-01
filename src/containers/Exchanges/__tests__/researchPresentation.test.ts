import { describe, expect, it } from 'vitest'
import { getResearchPresentation, RESEARCH_VIEWS, resolveResearchView } from '../researchPresentation'

describe('research chart presentation', () => {
	it('keeps view metadata aligned with metric semantics', () => {
		expect(getResearchPresentation('volume', 'spot-exchanges')).toMatchObject({
			id: 'spot-exchanges',
			metric: 'volume',
			segment: 'spot',
			grouping: 'exchange',
			valueSymbol: '$'
		})
		expect(RESEARCH_VIEWS.volume.map((view) => view.id)).toEqual([
			'spot-exchanges',
			'linear-perp-exchanges',
			'inverse-perp-exchanges',
			'volume-types'
		])
		expect(RESEARCH_VIEWS.oi.map((view) => view.id)).toEqual([
			'open-interest-btc-vs-alt',
			'open-interest-linear-exchanges',
			'open-interest-inverse-exchanges',
			'open-interest-types'
		])
		expect(RESEARCH_VIEWS.depth.map((view) => view.id)).toEqual([
			'depth-spot-exchanges',
			'depth-linear-exchanges',
			'depth-inverse-exchanges',
			'depth-types',
			'btc-depth'
		])
		expect(RESEARCH_VIEWS.nvol.map((view) => view.id)).toEqual([
			'normalized-spot-exchanges',
			'normalized-linear-exchanges',
			'normalized-inverse-exchanges',
			'normalized-types',
			'normalized-segments',
			'survival-spot-exchanges',
			'survival-linear-exchanges',
			'survival-inverse-exchanges'
		])
		expect(getResearchPresentation('nvol', 'survival-linear-exchanges')).toMatchObject({
			metric: 'survival-ratio',
			segment: 'linear_perp',
			grouping: 'exchange',
			valueSymbol: '%'
		})
	})

	it('labels segment views with the exact vocabulary: Spot | USD Perps | COIN Perps', () => {
		for (const part of ['volume', 'depth', 'nvol'] as const) {
			const labels = RESEARCH_VIEWS[part].map((view) => view.label)
			expect(labels).toContain('Spot')
			expect(labels).toContain('USD Perps')
			expect(labels).toContain('COIN Perps')
		}
		expect(RESEARCH_VIEWS.oi.map((view) => view.label)).toEqual(['BTC vs Alt', 'USD Perps', 'COIN Perps', 'CEX vs DEX'])
		// No view presents a combined "perp" segment.
		for (const views of Object.values(RESEARCH_VIEWS)) {
			for (const view of views) {
				expect(view.segment).not.toBe('perp')
				expect(view.segment).not.toBe('combined')
			}
		}
	})

	it('keeps URL-selected views within the metric that supports them', () => {
		expect(resolveResearchView('depth', 'btc-depth')).toBe('btc-depth')
		expect(resolveResearchView('nvol', 'survival-inverse-exchanges')).toBe('survival-inverse-exchanges')
		expect(resolveResearchView('volume', 'btc-depth')).toBe('spot-exchanges')
		expect(resolveResearchView('oi', 'survival-spot-exchanges')).toBe('open-interest-btc-vs-alt')
	})
})
