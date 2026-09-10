import { describe, expect, test } from 'vitest'
import type { RWAStatsSegmented } from '../api.types'
import {
	formatRWAOverviewUsd,
	getRWAOverviewAssetCount,
	getRWAOverviewCsvFileName,
	getRWAOverviewInclusion,
	getRWAOverviewTableData,
	hasExcludedRWAOverviewAssets
} from '../overviewTableData'

const row: RWAStatsSegmented = {
	base: {
		onChainMcap: 100,
		activeMcap: 90,
		defiActiveTvl: 80,
		assetCount: 3,
		assetIssuers: ['Issuer A']
	},
	stablecoinsOnly: {
		onChainMcap: 20,
		activeMcap: 15,
		defiActiveTvl: 10,
		assetCount: 1,
		assetIssuers: ['Issuer Stable']
	},
	governanceOnly: {
		onChainMcap: 30,
		activeMcap: 25,
		defiActiveTvl: 5,
		assetCount: 2,
		assetIssuers: ['Issuer Gov']
	},
	stablecoinsAndGovernance: {
		onChainMcap: 40,
		activeMcap: 35,
		defiActiveTvl: 12,
		assetCount: 4,
		assetIssuers: ['Issuer Stable', 'Issuer Both']
	}
}

describe('getRWAOverviewTableData', () => {
	test('excludes stablecoins and governance by default', () => {
		expect(getRWAOverviewTableData(row, getRWAOverviewInclusion(false, false))).toEqual({
			onChainMcap: 100,
			activeMcap: 90,
			defiActiveTvl: 80,
			assetCount: 3,
			assetIssuers: 1
		})
	})

	test('subtracts bridge TVL when excluded', () => {
		const bridgeRow: RWAStatsSegmented = {
			...row,
			base: { ...row.base, bridgeTvl: 20 },
			stablecoinsOnly: { ...row.stablecoinsOnly, bridgeTvl: 3 }
		}

		expect(getRWAOverviewTableData(bridgeRow, getRWAOverviewInclusion(true, false, false)).defiActiveTvl).toBe(67)
	})

	test('includes stablecoins only, holding back the dually-classified bucket', () => {
		expect(getRWAOverviewTableData(row, getRWAOverviewInclusion(true, false))).toEqual({
			onChainMcap: 120,
			activeMcap: 105,
			defiActiveTvl: 90,
			assetCount: 4,
			assetIssuers: 2
		})
	})

	test('includes governance only, holding back the dually-classified bucket', () => {
		expect(getRWAOverviewTableData(row, getRWAOverviewInclusion(false, true))).toEqual({
			onChainMcap: 130,
			activeMcap: 115,
			defiActiveTvl: 85,
			assetCount: 5,
			assetIssuers: 2
		})
	})

	test('includes all buckets when both flags are on', () => {
		expect(getRWAOverviewTableData(row, getRWAOverviewInclusion(true, true))).toEqual({
			onChainMcap: 190,
			activeMcap: 165,
			defiActiveTvl: 107,
			assetCount: 10,
			assetIssuers: 4
		})
	})
})

describe('fixed RWA overview asset counts', () => {
	test('adds a bridge exclusion suffix to CSV names', () => {
		expect(getRWAOverviewCsvFileName('rwa-chains', getRWAOverviewInclusion(false, false))).toBe('rwa-chains')
		expect(getRWAOverviewCsvFileName('rwa-chains', getRWAOverviewInclusion(true, false, false))).toBe(
			'rwa-chains-stablecoins-without-bridge-tvl'
		)
	})

	test('distinguishes a filtered zero from a genuine zero', () => {
		expect(formatRWAOverviewUsd(0, true)).toBe('-')
		expect(formatRWAOverviewUsd(0, false)).toBe('$0')
		expect(formatRWAOverviewUsd(1_000_000, true)).toBe('$1m')
	})

	test('counts every asset classification', () => {
		expect(getRWAOverviewAssetCount(row)).toBe(10)
	})

	test('detects assets excluded by the current toggles', () => {
		expect(hasExcludedRWAOverviewAssets(row, false, false)).toBe(true)
		expect(hasExcludedRWAOverviewAssets(row, true, false)).toBe(true)
		expect(hasExcludedRWAOverviewAssets(row, false, true)).toBe(true)
		expect(hasExcludedRWAOverviewAssets(row, true, true)).toBe(false)
	})

	test('does not mark empty optional classifications as excluded', () => {
		const baseOnlyRow: RWAStatsSegmented = {
			...row,
			stablecoinsOnly: { ...row.stablecoinsOnly, assetCount: 0 },
			governanceOnly: { ...row.governanceOnly, assetCount: 0 },
			stablecoinsAndGovernance: { ...row.stablecoinsAndGovernance, assetCount: 0 }
		}

		expect(hasExcludedRWAOverviewAssets(baseOnlyRow, false, false)).toBe(false)
	})
})
