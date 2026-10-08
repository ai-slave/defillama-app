import { describe, expect, test } from 'vitest'
import type { RWAAssetOverviewRow, RWAPerpsContractOverlayRow } from '../api.types'
import {
	filterRwaOverviewDisplayRows,
	getRwaFilterResetPatch,
	RWA_FILTER_QUERY_KEYS,
	readRwaQueryFilters,
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
	selectedPlatforms: ['Unknown'],
	selectedAssetGroups: ['Treasuries'],
	selectedAssetClasses: ['Unknown'],
	selectedRwaClassifications: ['Unknown'],
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
	includeBridgeTvl: true,
	includeWrappers: true,
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
const OPTIONS = {
	types: ['Asset', 'Wrapper'],
	assetNames: ['USDY', 'USTB'],
	assetGroups: ['Bonds', 'Private Credit'],
	categories: ['Treasuries', 'Private Credit'],
	platforms: ['Ondo', 'Maple'],
	assetClasses: ['Debt', 'Fund'],
	rwaClassifications: ['RWA', 'Unknown'],
	accessModels: ['Permissioned', 'Permissionless'],
	issuers: ['Issuer One', 'Issuer Two']
}

describe('readRwaQueryFilters', () => {
	test('reads an old Select All link as every option', () => {
		expect(readRwaQueryFilters({ types: 'All' }, OPTIONS, 'chain').selectedTypes).toEqual(['Asset', 'Wrapper'])
	})

	test('ignores keys for pickers the page does not show', () => {
		const query = { assetNames: 'USDY', categories: 'Treasuries', platforms: 'Ondo', types: 'Wrapper' }

		const chainPage = readRwaQueryFilters(query, OPTIONS, 'chain')
		expect(chainPage.selectedAssetNames).toEqual(['USDY', 'USTB'])
		expect(chainPage.selectedCategories).toEqual(['Treasuries'])
		expect(chainPage.selectedPlatforms).toEqual(['Ondo'])

		const categoryPage = readRwaQueryFilters(query, OPTIONS, 'category')
		expect(categoryPage.selectedCategories).toEqual(['Treasuries', 'Private Credit'])

		const oneType = readRwaQueryFilters(query, { ...OPTIONS, types: ['Asset'] }, 'chain')
		expect(oneType.selectedTypes).toEqual(['Asset'])
	})

	test('an asset group page reads its Category filter and ignores its own Asset Group', () => {
		const query = { categories: 'Treasuries', assetGroups: 'Bonds' }
		const assetGroupPage = readRwaQueryFilters(query, OPTIONS, 'assetGroup')
		expect(assetGroupPage.selectedCategories).toEqual(['Treasuries'])
		expect(assetGroupPage.selectedAssetGroups).toEqual(['Bonds', 'Private Credit'])
	})

	test('counts a filter as active only when it narrows the rows', () => {
		const active = (query: Record<string, string>) => readRwaQueryFilters(query, OPTIONS, 'chain').hasDialogFilters

		expect(active({})).toBe(false)
		expect(active({ types: '' })).toBe(false)
		expect(active({ types: 'All' })).toBe(false)
		expect(active({ assetNames: 'USDY' })).toBe(false)
		expect(active({ chartType: 'flows', includeStablecoins: 'true', perps: 'true' })).toBe(false)
		expect(active({ excludeTypes: 'Asset' })).toBe(true)
		expect(active({ redeemableStates: 'yes' })).toBe(true)
		expect(active({ minActiveMcapToOnChainMcapPct: '10' })).toBe(true)
	})

	test('an empty key narrows nothing', () => {
		expect(readRwaQueryFilters({ assetClasses: '' }, OPTIONS, 'chain').hasDialogFilters).toBe(false)
	})
})

describe('getRwaFilterResetPatch', () => {
	test('Reset all clears every Assets filter and toggle and keeps the view, grouping, period and Perps keys', () => {
		expect(
			getRwaFilterResetPatch(
				{
					categories: 'Treasuries',
					excludeAssetGroups: 'Bonds',
					redeemableStates: 'yes',
					minActiveMcapToOnChainMcapPct: '10',
					includeStablecoins: 'true',
					includeCex: 'false',
					venues: 'Binance',
					groupBy: 'chain',
					view: 'information',
					period: '7d'
				},
				RWA_FILTER_QUERY_KEYS
			)
		).toStrictEqual({
			categories: undefined,
			excludeAssetGroups: undefined,
			redeemableStates: undefined,
			minActiveMcapToOnChainMcapPct: undefined,
			includeStablecoins: undefined
		})
	})
})

describe('RWA filter state', () => {
	test('an Assets page keeps its spot rows and never a market, under every inclusion toggle', () => {
		const rows = [
			baseAsset,
			{ ...baseAsset, id: 'stablecoin', stablecoin: true },
			{ ...baseAsset, id: 'governance', governance: true },
			dexPerp
		]
		for (const includeStablecoins of [false, true]) {
			for (const includeGovernance of [false, true]) {
				const result = filterRwaOverviewDisplayRows(rows, { ...baseFilterState, includeStablecoins, includeGovernance })
				expect(result.filteredAssets.map((asset) => asset.id)).toEqual([
					'asset-1',
					...(includeStablecoins ? ['stablecoin'] : []),
					...(includeGovernance ? ['governance'] : [])
				])
			}
		}
	})

	test('rows missing a field match only the Unknown option', () => {
		const bare = { ...baseAsset, id: 'bare', type: null, category: null, parentPlatform: null, rwaClassification: null }
		const shown = (overrides: Partial<RWAFilterState>) =>
			filterRwaOverviewDisplayRows([bare], { ...baseFilterState, ...overrides }).filteredAssets.map((row) => row.id)

		expect(shown({ selectedTypes: ['Unknown'], selectedCategories: ['Unknown'] })).toEqual(['bare'])
		expect(shown({ selectedTypes: [] })).toEqual([])
		expect(shown({ selectedTypes: ['Unknown'], selectedCategories: [] })).toEqual([])
		expect(shown({ selectedTypes: ['Unknown'], selectedCategories: ['Unknown'], selectedPlatforms: ['Ondo'] })).toEqual(
			[]
		)
		expect(
			shown({ selectedTypes: ['Unknown'], selectedCategories: ['Unknown'], selectedRwaClassifications: ['RWA'] })
		).toEqual([])
	})

	test('does not include ratio-filtered rows with a zero denominator', () => {
		const filterState: RWAFilterState = {
			...baseFilterState,
			minActiveMcapToOnChainMcapPct: 1
		}

		expect(filterRwaOverviewDisplayRows([baseAsset], filterState).filteredAssets.map((asset) => asset.id)).toEqual([
			'asset-1'
		])
		expect(
			filterRwaOverviewDisplayRows(
				[
					{
						...baseAsset,
						id: 'zero-denominator',
						onChainMcap: { total: 0, breakdown: [['Ethereum', 0]] }
					}
				],
				filterState
			).filteredAssets
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

		const filteredWithBridge = filterRwaOverviewDisplayRows([asset], {
			...baseFilterState,
			minDefiActiveTvlToOnChainMcapPct: 20,
			includeBridgeTvl: true
		})
		const filteredWithoutBridge = filterRwaOverviewDisplayRows([asset], {
			...baseFilterState,
			minDefiActiveTvlToOnChainMcapPct: 20,
			includeBridgeTvl: false
		})
		expect(filteredWithBridge.filteredAssets.map((row) => row.id)).toEqual(['asset-1'])
		expect(filteredWithoutBridge.filteredAssets).toEqual([])
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
