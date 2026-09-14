import { describe, expect, test } from 'vitest'
import { perpsAsset, spotAsset } from '../table/__tests__/fixtures'
import { getRwaChangeCoverage } from './format'
import { sumRwaKpiTotals } from './kpiTotals'

describe('sumRwaKpiTotals', () => {
	test('sums the aggregate rows with their priors and counts issuers', () => {
		const totals = sumRwaKpiTotals(
			[
				spotAsset(),
				spotAsset({
					id: 'b',
					issuer: 'Other',
					priors: {
						'1d': { activeMcap: 100_000, onChainMcap: 100_000, defiActiveTvl: 0, bridgeTvl: 0 },
						'7d': { activeMcap: 100_000, onChainMcap: 100_000, defiActiveTvl: 0, bridgeTvl: 0 },
						'1m': { activeMcap: 100_000, onChainMcap: 100_000, defiActiveTvl: 0, bridgeTvl: 0 }
					}
				}),
				perpsAsset()
			],
			true
		)
		expect(totals.activeMcap).toBe(1_600_000)
		expect(totals.change['7d'].activeMcap).toEqual({ current: 1_600_000, prior: 800_000 })
		expect(totals.defiActiveTvl).toBe(200_000)
		expect(totals.openInterest).toBe(5000)
		expect(totals.issuerCount).toBe(2)
	})

	test('subtracts bridge tvl from the tvl total and its prior when excluded', () => {
		const totals = sumRwaKpiTotals(
			[
				spotAsset({
					bridgeTvl: 40_000,
					priors: {
						'1d': { activeMcap: 1, onChainMcap: 1, defiActiveTvl: 80_000, bridgeTvl: 30_000 },
						'7d': { activeMcap: 1, onChainMcap: 1, defiActiveTvl: 80_000, bridgeTvl: 30_000 },
						'1m': { activeMcap: 1, onChainMcap: 1, defiActiveTvl: 80_000, bridgeTvl: 30_000 }
					}
				})
			],
			false
		)
		expect(totals.defiActiveTvl).toBe(60_000)
		expect(totals.change['7d'].defiActiveTvl).toEqual({ current: 60_000, prior: 50_000 })
	})

	test('reports the covered share when a row has no prior', () => {
		const totals = sumRwaKpiTotals([spotAsset(), spotAsset({ id: 'b', priors: undefined })], true)
		expect(totals.activeMcap).toBe(1_600_000)
		expect(totals.change['7d'].activeMcap).toEqual({ current: 800_000, prior: 700_000 })
		expect(getRwaChangeCoverage(totals.activeMcap, totals.change['7d'].activeMcap)).toBe(0.5)
	})
})
