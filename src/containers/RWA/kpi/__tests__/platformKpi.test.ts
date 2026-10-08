import { describe, expect, test } from 'vitest'
import {
	filterRwaOverviewDisplayRows,
	getRwaRowFilterValues,
	readRwaQueryFilters,
	resolveRWAOverviewInclusionFlag,
	RWA_SELECT_FILTER_KEYS,
	type RWASelectFilterOptions
} from '../../filterState'
import { spotAsset } from '../../table/__tests__/fixtures'
import { foldRwaPlatformKpi, getRwaPlatformFold } from '../platformKpi'

const assets = [
	spotAsset({ id: 'a', canonicalMarketId: 'a', issuer: 'BlackRock', accessModel: 'Permissioned', attestations: true }),
	spotAsset({
		id: 'b',
		canonicalMarketId: 'b',
		issuer: 'Apollo',
		accessModel: 'Permissionless',
		attestations: false,
		chain: ['Ethereum'],
		onChainMcap: { total: 500_000, breakdown: [['Ethereum', 500_000]] },
		activeMcap: { total: 200_000, breakdown: [['Ethereum', 200_000]] },
		defiActiveTvl: { total: 50_000, breakdown: [['Morpho', 50_000]] },
		defiActiveTvlByChain: { total: 50_000, breakdown: [['Ethereum', 50_000]] },
		priors: {
			'1d': { activeMcap: 210_000, onChainMcap: 500_000, defiActiveTvl: 50_000, bridgeTvl: 0 },
			'7d': { activeMcap: 200_000, onChainMcap: 500_000, defiActiveTvl: 50_000, bridgeTvl: 0 },
			'1m': { activeMcap: 200_000, onChainMcap: 500_000, defiActiveTvl: 50_000, bridgeTvl: 0 }
		}
	}),
	spotAsset({ id: 'c', canonicalMarketId: 'c', issuer: null, accessModel: 'Unknown', attestations: null })
]

describe('foldRwaPlatformKpi', () => {
	test('sums the money, the 24h priors and the counts over the rows, the same fold a group row uses', () => {
		const kpi = foldRwaPlatformKpi(assets, { includeBridgeTvl: true })
		expect(kpi.metrics.activeMcap).toBe(1_800_000)
		expect(kpi.metrics.onChainMcap).toBe(2_500_000)
		expect(kpi.metrics.defiActiveTvl).toBe(250_000)
		expect(kpi.metrics.change['1d'].activeMcap).toEqual({ current: 1_800_000, prior: 1_790_000 })
		expect(kpi.metrics.assetCount).toBe(3)
		expect(kpi.metrics.chainCount).toBe(3)
		expect(kpi.metrics.issuerCount).toBe(2)
	})

	test('tallies the flags over the rows with an answer and counts the permissionless rows', () => {
		const kpi = foldRwaPlatformKpi(assets, { includeBridgeTvl: true })
		expect(kpi.flags.attestations).toEqual({ yes: 1, known: 2 })
		expect(kpi.permissionlessCount).toBe(1)
		expect(kpi.distinct.issuer).toEqual(['BlackRock', 'Apollo'])
		expect(kpi.issuersByMcap).toEqual([
			{ name: 'BlackRock', value: 800_000 },
			{ name: 'Apollo', value: 200_000 }
		])
	})

	test('names the largest DeFi protocol over every row', () => {
		expect(foldRwaPlatformKpi(assets, { includeBridgeTvl: true }).largestProtocol).toEqual({
			name: 'Aave',
			value: 200_000
		})
	})

	test('reads null, never zero, when no row is priced', () => {
		const kpi = foldRwaPlatformKpi(
			[
				spotAsset({
					onChainMcap: null,
					activeMcap: null,
					defiActiveTvl: { total: 0, breakdown: [] },
					defiActiveTvlByChain: { total: 0, breakdown: [] },
					priors: undefined
				})
			],
			{ includeBridgeTvl: true }
		)
		expect(kpi.metrics.activeMcap).toBeNull()
		expect(kpi.metrics.onChainMcap).toBeNull()
		expect(kpi.metrics.change['1d'].activeMcap.prior).toBeNull()
		expect(kpi.largestProtocol).toBeNull()
	})

	test('sums the net flows from the flow summary the table reads, and reads null without it', () => {
		const flow = (value: number) => ({ flow: value, status: 'measured', byChain: {} }) as never
		const flowSummary = {
			generatedAt: 1,
			windows: {
				'7d': { asset: { a: flow(10), b: flow(-4) }, assetGroup: {}, platform: {}, category: {}, chain: {} },
				'30d': { asset: { a: flow(100) }, assetGroup: {}, platform: {}, category: {}, chain: {} }
			}
		} as never
		expect(foldRwaPlatformKpi(assets, { includeBridgeTvl: true, flowSummary }).metrics.netFlow7d).toBe(6)
		expect(foldRwaPlatformKpi(assets, { includeBridgeTvl: true, flowSummary }).metrics.netFlow30d).toBe(100)
		expect(foldRwaPlatformKpi(assets, { includeBridgeTvl: true }).metrics.netFlow30d).toBeNull()
	})
})

describe('getRwaPlatformFold', () => {
	const stablecoin = spotAsset({ id: 's', canonicalMarketId: 's', issuer: 'Circle', stablecoin: true })
	const rows = [...assets, stablecoin]
	const defaultInclusion = {
		includeStablecoins: false,
		includeGovernance: false,
		includeBridgeTvl: true,
		includeWrappers: true
	}
	// Every value the rows carry, as the page's loader lists them.
	const options = {} as RWASelectFilterOptions
	for (const key of RWA_SELECT_FILTER_KEYS) {
		options[key] = [...new Set(rows.flatMap((row) => getRwaRowFilterValues(row, key)))]
	}
	/** The Assets view's fold under an address, read as the platform page reads it. */
	const assetsViewFold = (query: Record<string, string>) => {
		const includeStablecoins = resolveRWAOverviewInclusionFlag(query.includeStablecoins, false)
		const includeBridgeTvl = resolveRWAOverviewInclusionFlag(query.includeBridgeTvl, true)
		const { aggregateAssets } = filterRwaOverviewDisplayRows(rows, {
			...readRwaQueryFilters(query, options, 'platform'),
			isPlatformMode: true,
			includeStablecoins,
			includeGovernance: false,
			includeBridgeTvl,
			includeWrappers: true
		})
		return { aggregateAssets, includeStablecoins, includeGovernance: false, includeBridgeTvl, activeFilters: true }
	}
	const query = { issuers: 'Apollo', includeStablecoins: 'true', includeBridgeTvl: 'false' }

	test('under Information the card folds every asset the platform counts by default, whatever the address filters', () => {
		const fold = getRwaPlatformFold('information', rows, defaultInclusion, assetsViewFold(query))
		const kpi = foldRwaPlatformKpi(fold.aggregateAssets, { includeBridgeTvl: fold.includeBridgeTvl })
		expect(kpi.metrics.assetCount).toBe(3)
		expect(kpi.metrics.activeMcap).toBe(1_800_000)
		expect(kpi.distinct.issuer).toEqual(['BlackRock', 'Apollo'])
		// The chart draws the build-time dataset, folded over the same rows.
		expect(fold.activeFilters).toBe(false)
	})

	test('under Assets the card folds the rows the table shows', () => {
		const fold = getRwaPlatformFold('list', rows, defaultInclusion, assetsViewFold(query))
		const kpi = foldRwaPlatformKpi(fold.aggregateAssets, { includeBridgeTvl: fold.includeBridgeTvl })
		expect(kpi.metrics.assetCount).toBe(1)
		expect(kpi.distinct.issuer).toEqual(['Apollo'])
	})
})
