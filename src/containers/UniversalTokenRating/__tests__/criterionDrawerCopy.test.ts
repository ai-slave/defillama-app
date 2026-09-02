import { describe, expect, it } from 'vitest'
import { getCriterionDrawerCopy, MARKET_MAKER_MATURITY_EXCEPTION } from '../criterionDrawerCopy'

describe('criterion drawer copy', () => {
	it('uses the final non-blacklisted exchange copy for affected performance criteria', () => {
		expect(getCriterionDrawerCopy('performance', 'volume_mcap', 'Volume', null)).toMatchObject({
			navigationLabel: 'Trade Volume',
			heading: 'Total Volume (as % of Market Cap)'
		})
		expect(getCriterionDrawerCopy('performance', 'volume_mcap', 'Volume', null).definition).toContain(
			'non-blacklisted exchanges'
		)
		expect(getCriterionDrawerCopy('performance', 'cex_vs_dex_volume', 'CEX vs DEX', null).definition).toContain(
			'not blacklisted'
		)
	})

	it('shows the mature-project AAA exception for disclosure and performance market maker criteria', () => {
		for (const [axis, key] of [
			['disclosure', 'mm_contract_transparency'],
			['performance', 'mm_volume_pct'],
			['performance', 'mm_depth_pct'],
			['performance', 'mm_uptime_sla']
		] as const) {
			expect(getCriterionDrawerCopy(axis, key, key, null).showMarketMakerMaturityException).toBe(true)
		}

		expect(MARKET_MAKER_MATURITY_EXCEPTION.criteria).toEqual([
			'Spot + perpetual market depth / market capitalization ≥ 1%',
			'Listed on ≥ 3 Tier 1 centralized exchanges',
			'Fully diluted valuation (FDV) ≥ $2.5 billion'
		])
	})

	it('falls back to API copy for criteria absent from the design copy table', () => {
		expect(getCriterionDrawerCopy('performance', 'future_metric', 'Future metric', 'API definition')).toEqual({
			navigationLabel: 'Future metric',
			heading: 'Future metric',
			definition: 'API definition',
			showMarketMakerMaturityException: false
		})
	})
})
