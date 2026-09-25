import { describe, expect, test } from 'vitest'
import type { RWAAssetOverviewRow, RWAPerpsContractOverlayRow } from '../api.types'
import {
	filterRwaAssetOverviewRows,
	filterRwaOverviewDisplayRows,
	hasPerpsOverlayBlockingFiltersFromQuery,
	parseAttributeFilterStatesParam,
	getRwaDisplayedDefiActiveTvl,
	getRwaDisplayedDefiActiveTvlByChain,
	getRwaDisplayedDefiActiveTvlByProtocol,
	type RWAFilterState
} from '../filterState'

const baseAsset: RWAAssetOverviewRow = {
	id: 'asset-1',
	kind: 'spot',
	detailHref: '/rwa/asset/asset-1',
	canonicalMarketId: 'asset-1',
	assetName: 'Asset One',
	logo: null,
	ticker: 'ONE',
	primaryChain: null,
	chain: null,
	price: null,
	openInterest: null,
	volume24h: null,
	volume30d: null,
	assetGroup: 'Treasuries',
	parentPlatform: null,
	category: ['Treasuries'],
	assetClass: null,
	accessModel: 'Unknown',
	type: 'Asset',
	rwaClassification: null,
	issuer: 'Issuer One',
	redeemable: null,
	attestations: null,
	cexListed: null,
	kycForMintRedeem: null,
	kycAllowlistedWhitelistedToTransferHold: null,
	transferable: null,
	selfCustody: null,
	stablecoin: false,
	governance: false,
	trueRWA: true,
	suspicious: false,
	suspiciousReason: null,
	onChainMcap: { total: 100, breakdown: [['Ethereum', 100]] },
	activeMcap: { total: 50, breakdown: [['Ethereum', 50]] },
	defiActiveTvl: { total: 25, breakdown: [['Aave', 25]] },
	defiActiveTvlByChain: { total: 25, breakdown: [['Ethereum', 25]] }
}

const baseFilterState: RWAFilterState = {
	isPlatformMode: false,
	selectedAssetNames: [],
	selectedTypes: ['Asset'],
	selectedCategories: ['Treasuries'],
	selectedPlatforms: [],
	selectedAssetGroups: ['Treasuries'],
	selectedAssetClasses: [],
	selectedRwaClassifications: [],
	selectedAccessModels: ['Unknown'],
	selectedIssuers: ['Issuer One'],
	selectedRedeemableStates: ['yes', 'no', 'unknown'],
	selectedAttestationsStates: ['yes', 'no', 'unknown'],
	selectedCexListedStates: ['yes', 'no', 'unknown'],
	selectedKycForMintRedeemStates: ['yes', 'no', 'unknown'],
	selectedKycAllowlistedWhitelistedToTransferHoldStates: ['yes', 'no', 'unknown'],
	selectedTransferableStates: ['yes', 'no', 'unknown'],
	selectedSelfCustodyStates: ['yes', 'no', 'unknown'],
	includeStablecoins: true,
	includeGovernance: true,
	includeRwaPerps: true,
	includeCex: false,
	includeBridgeTvl: true,
	includeWrappers: true,
	hasPerpsOverlayBlockingFilters: false,
	minDefiActiveTvlToOnChainMcapPct: null,
	maxDefiActiveTvlToOnChainMcapPct: null,
	minActiveMcapToOnChainMcapPct: null,
	maxActiveMcapToOnChainMcapPct: null,
	minDefiActiveTvlToActiveMcapPct: null,
	maxDefiActiveTvlToActiveMcapPct: null
}

const dexPerp: RWAPerpsContractOverlayRow = {
	...baseAsset,
	id: 'xyz:usdy',
	kind: 'perps',
	priceChange24h: null,
	contract: 'xyz:USDY',
	venueType: 'DEX',
	type: 'Perp',
	openInterest: 100,
	onChainMcap: null,
	activeMcap: null,
	defiActiveTvl: null,
	defiActiveTvlByChain: null
}
const cexPerp: RWAPerpsContractOverlayRow = {
	...dexPerp,
	id: 'binance:usdy',
	contract: 'binance:USDY',
	venueType: 'CEX',
	openInterest: 200
}

const sumOpenInterest = (rows: Array<{ openInterest: number | null }>) =>
	rows.reduce((total, row) => total + (row.openInterest ?? 0), 0)

describe('RWA filter state', () => {
	test('includes CEX perps only when both inclusion flags are enabled without changing spot totals', () => {
		const rows = [baseAsset, dexPerp, cexPerp]
		for (const [includeRwaPerps, includeCex, expectedIds, expectedOi] of [
			[false, false, ['asset-1'], 0],
			[true, false, ['asset-1', 'xyz:usdy'], 100],
			[true, true, ['asset-1', 'xyz:usdy', 'binance:usdy'], 300],
			[false, true, ['asset-1'], 0],
			[true, false, ['asset-1', 'xyz:usdy'], 100]
		] as const) {
			const result = filterRwaOverviewDisplayRows(rows, { ...baseFilterState, includeRwaPerps, includeCex })
			expect(result.filteredAssets.map((asset) => asset.id)).toEqual(expectedIds)
			expect(sumOpenInterest(result.aggregateAssets)).toBe(expectedOi)
			expect(result.aggregateAssets.map((asset) => asset.id)).toEqual(expectedIds)
		}
	})

	test('adds stablecoins and governance tokens without removing selected perps', () => {
		const rows = [
			baseAsset,
			{ ...baseAsset, id: 'stablecoin', stablecoin: true },
			{ ...baseAsset, id: 'governance', governance: true },
			dexPerp,
			cexPerp
		]
		for (const includeStablecoins of [false, true]) {
			for (const includeGovernance of [false, true]) {
				const result = filterRwaOverviewDisplayRows(rows, {
					...baseFilterState,
					includeStablecoins,
					includeGovernance,
					includeCex: true,
					hasPerpsOverlayBlockingFilters: hasPerpsOverlayBlockingFiltersFromQuery({
						includeStablecoins: String(includeStablecoins),
						includeGovernance: String(includeGovernance)
					})
				})
				expect(sumOpenInterest(result.aggregateAssets)).toBe(300)
				expect(result.filteredAssets.map((asset) => asset.id)).toEqual([
					'asset-1',
					...(includeStablecoins ? ['stablecoin'] : []),
					...(includeGovernance ? ['governance'] : []),
					'xyz:usdy',
					'binance:usdy'
				])
			}
		}
	})

	test('applies shared category filters to perps overlay rows', () => {
		const commoditiesPerp = { ...dexPerp, id: 'xyz:gold', contract: 'xyz:GOLD', category: ['Commodities'] }

		const result = filterRwaOverviewDisplayRows([baseAsset, dexPerp, commoditiesPerp], baseFilterState)

		expect(result.filteredAssets.map((asset) => asset.id)).toEqual(['asset-1', 'xyz:usdy'])
	})

	test('excludes both kinds of perps when filtering for attested assets', () => {
		const result = filterRwaOverviewDisplayRows([{ ...baseAsset, attestations: true }, dexPerp, cexPerp], {
			...baseFilterState,
			includeCex: true,
			selectedAttestationsStates: ['yes'],
			hasPerpsOverlayBlockingFilters: hasPerpsOverlayBlockingFiltersFromQuery({ attestationsStates: 'yes' })
		})
		expect(result.filteredAssets.map((asset) => asset.id)).toEqual(['asset-1'])
		expect(sumOpenInterest(result.aggregateAssets)).toBe(0)
	})

	test('parses attribute filter state params', () => {
		expect(parseAttributeFilterStatesParam(undefined)).toEqual(['yes', 'no', 'unknown'])
		expect(parseAttributeFilterStatesParam('yes')).toEqual(['yes'])
		expect(parseAttributeFilterStatesParam(['yes', 'unknown'])).toEqual(['yes', 'unknown'])
		expect(parseAttributeFilterStatesParam('none')).toEqual([])
		expect(parseAttributeFilterStatesParam('invalid')).toEqual(['yes', 'no', 'unknown'])
	})

	test('treats asset-only query filters as perps overlay blockers', () => {
		// The Types filter is a spot classification; the view switch owns perps, so it never hides them.
		expect(hasPerpsOverlayBlockingFiltersFromQuery({ types: 'Asset' })).toBe(false)
		expect(hasPerpsOverlayBlockingFiltersFromQuery({ minActiveMcapToOnChainMcapPct: '10' })).toBe(true)
		expect(hasPerpsOverlayBlockingFiltersFromQuery({ kycForMintRedeemStates: 'yes' })).toBe(true)
	})

	test('does not treat shared filters or includeRwaPerps as perps overlay blockers', () => {
		expect(hasPerpsOverlayBlockingFiltersFromQuery({ categories: 'Treasuries' })).toBe(false)
		expect(hasPerpsOverlayBlockingFiltersFromQuery({ platforms: 'Ondo' })).toBe(false)
		expect(hasPerpsOverlayBlockingFiltersFromQuery({ includeRwaPerps: 'false' })).toBe(false)
	})

	test('does not include ratio-filtered rows with a zero denominator', () => {
		const filterState: RWAFilterState = {
			...baseFilterState,
			minActiveMcapToOnChainMcapPct: 1
		}

		expect(filterRwaAssetOverviewRows([baseAsset], filterState).map((asset) => asset.id)).toEqual(['asset-1'])
		expect(
			filterRwaAssetOverviewRows(
				[
					{
						...baseAsset,
						id: 'zero-denominator',
						onChainMcap: { total: 0, breakdown: [['Ethereum', 0]] }
					}
				],
				filterState
			)
		).toEqual([])
	})

	test('subtracts bridge TVL from display values and ratio filters only when excluded', () => {
		const asset: RWAAssetOverviewRow = {
			...baseAsset,
			bridgeTvl: 10,
			bridgeTvlByChain: { total: 10, breakdown: [['Ethereum', 10]] },
			bridgeTvlByProtocol: { total: 10, breakdown: [['Portal', 10]] },
			defiActiveTvl: {
				total: 25,
				breakdown: [
					['Aave', 15],
					['Portal', 10]
				]
			}
		}
		expect(getRwaDisplayedDefiActiveTvl(asset, true)).toBe(25)
		expect(getRwaDisplayedDefiActiveTvl(asset, false)).toBe(15)
		expect(getRwaDisplayedDefiActiveTvlByChain(asset, false)).toEqual([['Ethereum', 15]])
		expect(getRwaDisplayedDefiActiveTvlByProtocol(asset, false)).toEqual([['Aave', 15]])
		expect(getRwaDisplayedDefiActiveTvlByProtocol({ ...asset, bridgeTvlByProtocol: null }, false)).toBeNull()

		const filteredWithBridge = filterRwaAssetOverviewRows([asset], {
			...baseFilterState,
			minDefiActiveTvlToOnChainMcapPct: 20,
			includeBridgeTvl: true
		})
		const filteredWithoutBridge = filterRwaAssetOverviewRows([asset], {
			...baseFilterState,
			minDefiActiveTvlToOnChainMcapPct: 20,
			includeBridgeTvl: false
		})
		expect(filteredWithBridge).toHaveLength(1)
		expect(filteredWithoutBridge).toHaveLength(0)
	})

	test('keeps suspicious assets visible but excludes them from non-platform totals', () => {
		const suspiciousAsset = { ...baseAsset, id: 'suspicious', suspicious: true }
		const result = filterRwaOverviewDisplayRows([baseAsset, suspiciousAsset], baseFilterState)

		expect(result.filteredAssets).toHaveLength(2)
		expect(result.aggregateAssets.map((asset) => asset.id)).toEqual(['asset-1'])
	})

	test('includes suspicious assets in their own platform totals', () => {
		const suspiciousAsset = { ...baseAsset, id: 'suspicious', suspicious: true, issuer: 'Issuer Two' }
		const result = filterRwaOverviewDisplayRows([baseAsset, suspiciousAsset], {
			...baseFilterState,
			isPlatformMode: true,
			selectedAssetNames: ['Asset One'],
			selectedIssuers: ['Issuer One', 'Issuer Two']
		})

		expect(result.aggregateAssets).toBe(result.filteredAssets)
		expect(result.aggregateAssets.map((asset) => asset.id)).toEqual(['asset-1', 'suspicious'])
	})
})
