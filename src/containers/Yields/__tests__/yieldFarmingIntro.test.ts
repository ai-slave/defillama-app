import { describe, expect, test } from 'vitest'
import { yieldFarmingIntro } from '../yieldFarmingIntro'

const GENERATED_AT = Date.UTC(2026, 9, 14)

describe('yieldFarmingIntro', () => {
	test('uses the highest measured stablecoin APY on the rows it is given', () => {
		expect(
			yieldFarmingIntro({
				generatedAtMs: GENERATED_AT,
				rows: [
					{ pool: 'ETH', poolMeta: null, stablecoin: false, verifiedApy: 80 },
					{ pool: 'USDC', poolMeta: 'Aave', stablecoin: true, verifiedApy: null },
					{ pool: 'USDT', poolMeta: 'Morpho', stablecoin: true, verifiedApy: 9.5, verifiedLocked: true },
					{ pool: 'DAI', poolMeta: null, stablecoin: true, verifiedApy: null },
					{ pool: 'FRAX', poolMeta: null, stablecoin: true, verifiedApy: 6.5 }
				]
			})
		).toBe(
			'Yield farming is depositing crypto to earn a high yield. On Oct 14, 2026, the highest verified stablecoin APY in this table is 6.50% on FRAX.'
		)
	})

	test('drops the date while the rows are a placeholder with no fetch time', () => {
		expect(
			yieldFarmingIntro({
				generatedAtMs: null,
				rows: [{ pool: 'FRAX', poolMeta: null, stablecoin: true, verifiedApy: 6.5 }]
			})
		).toBe(
			'Yield farming is depositing crypto to earn a high yield. The highest verified stablecoin APY in this table is 6.50% on FRAX.'
		)
	})

	test('keeps the definition when the rows have no measured stablecoin APY', () => {
		expect(
			yieldFarmingIntro({
				generatedAtMs: GENERATED_AT,
				rows: [{ pool: 'USDC', poolMeta: null, stablecoin: true, verifiedApy: null, verifiedLocked: true }]
			})
		).toBe('Yield farming is depositing crypto to earn a high yield.')
	})
})
