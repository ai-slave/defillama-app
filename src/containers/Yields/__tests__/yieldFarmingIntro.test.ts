import { describe, expect, test } from 'vitest'
import { yieldFarmingIntro } from '../yieldFarmingIntro'

const GENERATED_AT = Date.UTC(2026, 9, 14)

describe('yieldFarmingIntro', () => {
	test('uses the highest verified stablecoin APY already loaded', () => {
		expect(
			yieldFarmingIntro({
				generatedAtMs: GENERATED_AT,
				rows: [
					{ pool: 'ETH', poolMeta: null, stablecoin: false, apy: 80, verifiedLocked: true },
					{ pool: 'USDC', poolMeta: 'Aave', stablecoin: true, apy: 4.25, verified: null },
					{ pool: 'USDT', poolMeta: 'Morpho', stablecoin: true, apy: 9.5, verifiedLocked: true },
					{ pool: 'DAI', poolMeta: null, stablecoin: true, apy: 12, verified: { measured: true } }
				]
			})
		).toBe(
			'Yield farming is depositing crypto to earn rewards. On Oct 14, 2026, the highest verified stablecoin APY in this table is 12.00% on DAI.'
		)
	})

	test('keeps the definition when the loaded rows have no verified stablecoin', () => {
		expect(
			yieldFarmingIntro({
				generatedAtMs: GENERATED_AT,
				rows: [{ pool: 'USDC', poolMeta: null, stablecoin: true, apy: 4, verified: null }]
			})
		).toBe('Yield farming is depositing crypto to earn rewards.')
	})
})
