import { describe, expect, test } from 'vitest'
import { buildAllocation, positionUsd } from '../allocation'
import { buildVaultRiskVM } from '../derive'
import type { CollateralVM } from '../types'
import { makeCollateral, makeVaultRiskData } from './factories'

// Built end-to-end through buildVaultRiskVM: supply 1M, allocations 500k/300k/150k, 50k
// unallocated (idle 40k). Exposures are tiny/min-capped to prove the split ignores Σ exposure.
function morphoVm() {
	const data = makeVaultRiskData({
		pool_total_supply_usd: 1_000_000,
		allocated_usd: 950_000,
		idle_usd: 40_000,
		collateral_risks: [
			makeCollateral({
				token: { chain: 'ethereum', symbol: 'cbBTC', address: '0x0000000000000000000000000000000000000001' },
				vault_allocation_usd: 500_000,
				exposure_usd: 100_000
			}),
			makeCollateral({
				token: { chain: 'ethereum', symbol: 'wstETH', address: '0x0000000000000000000000000000000000000002' },
				vault_allocation_usd: 300_000,
				exposure_usd: 50_000
			}),
			makeCollateral({
				token: { chain: 'ethereum', symbol: 'WETH', address: '0x0000000000000000000000000000000000000003' },
				vault_allocation_usd: 150_000,
				exposure_usd: 20_000
			})
		]
	})
	return buildVaultRiskVM(data)
}

function coll(partial: Partial<CollateralVM>): CollateralVM {
	return {
		symbol: 'TOK',
		address: '0x0',
		chain: 'ethereum',
		logoUrl: null,
		oracleType: 'market',
		exposureUsd: partial.exposureUsd ?? partial.allocationUsd ?? 0,
		allocationUsd: partial.allocationUsd ?? null,
		marketLossCeilingUsd: partial.marketLossCeilingUsd ?? 0,
		supplyCapUsd: null,
		liquidationThreshold: null,
		borrowedDebtUsd: null,
		badDebtAtZeroUsd: null,
		badDebtBasis: null,
		badDebtMarkets: [],
		drainableUsd: null,
		aggregateTrustUsd: 0,
		vaultCount: 1,
		exposurePct: 0,
		vaultMarketShare: null,
		oracleProviders: [],
		oracleAddresses: [],
		feedKinds: [],
		oracleMechanism: null,
		oracleBaseLeg: null,
		oracleQuoteLeg: null,
		oracleLegs: null,
		ptPricing: null,
		magnitudePct: 0,
		...partial
	}
}

describe('buildAllocation', () => {
	// Unallocated is 1M supply less the 950k reported allocation.
	test('sizes the morpho vault histogram from supply and the server split', () => {
		const vm = morphoVm()
		const alloc = buildAllocation(vm.collateral, vm.supplyUsd!, vm.allocatedUsd, vm.idleUsd)!
		expect([alloc.totalUsd, alloc.unallocatedUsd]).toEqual([1_000_000, 50_000])
	})

	test('derives unallocated from the server split — NEVER from Σ exposure (min-capped by design)', () => {
		// exposures are tiny because they're min-capped; allocations fill the vault.
		const cols = [
			coll({ symbol: 'A', allocationUsd: 60, exposureUsd: 10 }),
			coll({ symbol: 'B', address: '0x1', allocationUsd: 40, exposureUsd: 5 })
		]
		const alloc = buildAllocation(cols, 100, 100, 0)!
		expect(alloc.unallocatedPct).toBe(0)
		expect(alloc.totalUsd).toBe(100)
	})

	test('shows a real unallocated remainder from the split, carrying known idle', () => {
		const alloc = buildAllocation([coll({ symbol: 'A', allocationUsd: 60 })], 100, 60, 25)!
		expect(Math.round(alloc.unallocatedPct)).toBe(40)
		expect(alloc.unallocatedUsd).toBe(40)
		expect(alloc.idleUsd).toBe(25)
	})

	test('falls back to summed positions when the feed has no split, with no fake unallocated', () => {
		const cols = [coll({ symbol: 'A', allocationUsd: 60 }), coll({ symbol: 'B', address: '0x1', allocationUsd: 40 })]
		const alloc = buildAllocation(cols, 0, null, null)!
		expect(alloc.totalUsd).toBe(100)
		expect(alloc.unallocatedPct).toBe(0)
	})

	test('positions prefer the real allocation and fall back to exposure', () => {
		expect(positionUsd(coll({ allocationUsd: 60, exposureUsd: 10 }))).toBe(60)
		expect(positionUsd(coll({ allocationUsd: null, exposureUsd: 10 }))).toBe(10)
	})

	test('returns null when nothing is deployed', () => {
		expect(buildAllocation([], 100, null, null)).toBeNull()
		expect(buildAllocation([coll({ allocationUsd: 0, exposureUsd: 0 })], 100, 0, 0)).toBeNull()
	})

	test('does not invent an allocation denominator when supply is unknown', () => {
		expect(buildAllocation([coll({ allocationUsd: 60 })], null, 60, 0)).toBeNull()
	})
})
