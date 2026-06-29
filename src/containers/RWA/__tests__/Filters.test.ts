import { describe, expect, it } from 'vitest'
import { RWA_FILTERS_TEST_UTILS } from '../Filters'

const actions = {
	setDefiActiveTvlToOnChainMcapPctRange: () => {},
	setActiveMcapToOnChainMcapPctRange: () => {},
	setDefiActiveTvlToActiveMcapPctRange: () => {},
	setIncludeStablecoins: () => {},
	setIncludeGovernance: () => {},
	setIncludeRwaPerps: () => {},
	setRedeemableStates: () => {},
	setAttestationsStates: () => {},
	setCexListedStates: () => {},
	setKycForMintRedeemStates: () => {},
	setKycAllowlistedWhitelistedToTransferHoldStates: () => {},
	setTransferableStates: () => {},
	setSelfCustodyStates: () => {}
}

const baseProps = {
	enabled: true,
	modes: {
		mode: 'chain',
		isChainMode: true,
		isCategoryMode: false,
		isPlatformMode: false,
		isAssetGroupMode: false
	},
	options: {
		assetNames: ['USDY', 'USTB'],
		typeOptions: [
			{ key: 'Asset', name: 'Asset' },
			{ key: 'Platform', name: 'Platform' },
			{ key: 'Wrapper', name: 'Wrapper' }
		],
		categoriesOptions: [
			{ key: 'Treasuries', name: 'Treasuries' },
			{ key: 'Private Credit', name: 'Private Credit' }
		],
		platforms: ['Ondo', 'Maple', 'Centrifuge'],
		assetGroups: ['Bonds', 'Private Credit'],
		assetClassOptions: [
			{ key: 'Debt', name: 'Debt' },
			{ key: 'Fund', name: 'Fund' }
		],
		rwaClassificationOptions: [
			{ key: 'Tokenized Asset', name: 'Tokenized Asset' },
			{ key: 'Synthetic', name: 'Synthetic' }
		],
		accessModelOptions: [
			{ key: 'Permissioned', name: 'Permissioned' },
			{ key: 'Permissionless', name: 'Permissionless' }
		],
		issuers: ['Issuer One', 'Issuer Two'],
		chainSlug: null,
		categorySlug: null,
		platformSlug: null,
		assetGroupSlug: null
	},
	selections: {
		selectedAssetNames: ['USDY', 'USTB'],
		selectedTypes: ['Asset', 'Platform'],
		selectedCategories: ['Treasuries', 'Private Credit'],
		selectedPlatforms: ['Ondo', 'Maple', 'Centrifuge'],
		selectedAssetGroups: ['Bonds', 'Private Credit'],
		selectedAssetClasses: ['Debt', 'Fund'],
		selectedRwaClassifications: ['Tokenized Asset', 'Synthetic'],
		selectedAccessModels: ['Permissioned', 'Permissionless'],
		selectedIssuers: ['Issuer One', 'Issuer Two'],
		selectedRedeemableStates: ['yes', 'no', 'unknown'],
		selectedAttestationsStates: ['yes', 'no', 'unknown'],
		selectedCexListedStates: ['yes', 'no', 'unknown'],
		selectedKycForMintRedeemStates: ['yes', 'no', 'unknown'],
		selectedKycAllowlistedWhitelistedToTransferHoldStates: ['yes', 'no', 'unknown'],
		selectedTransferableStates: ['yes', 'no', 'unknown'],
		selectedSelfCustodyStates: ['yes', 'no', 'unknown'],
		minDefiActiveTvlToOnChainMcapPct: null,
		maxDefiActiveTvlToOnChainMcapPct: null,
		minActiveMcapToOnChainMcapPct: null,
		maxActiveMcapToOnChainMcapPct: null,
		minDefiActiveTvlToActiveMcapPct: null,
		maxDefiActiveTvlToActiveMcapPct: null,
		includeStablecoins: false,
		includeGovernance: false,
		includeRwaPerps: false
	},
	actions
} as const

function makeProps(overrides: Record<string, unknown> = {}) {
	return {
		...baseProps,
		...overrides,
		options: { ...baseProps.options, ...((overrides.options as Record<string, unknown> | undefined) ?? {}) },
		selections: { ...baseProps.selections, ...((overrides.selections as Record<string, unknown> | undefined) ?? {}) },
		modes: { ...baseProps.modes, ...((overrides.modes as Record<string, unknown> | undefined) ?? {}) }
	}
}

describe('RWA overview filter dialog helpers', () => {
	it('marks non-all default select filters active on a clean page', () => {
		const props = makeProps()
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)

		expect(draft.activeIds).toEqual(['types'])
		expect(draft.activeIds).not.toContain('platforms')
		expect(definitions.filter((definition) => definition.kind === 'select').length).toBeGreaterThan(0)
	})

	it('serializes a removed default select filter as all values', () => {
		const props = makeProps()
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const nextDraft = RWA_FILTERS_TEST_UTILS.removeDraftFilter(draft, 'types')
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(definitions, nextDraft)

		expect(nextDraft.activeIds).toEqual([])
		expect(updates.types).toEqual(['Asset', 'Platform', 'Wrapper'])
		expect(updates.excludeTypes).toBeUndefined()
	})

	it('marks changed select filters active and serializes them with the shared include/exclude rules', () => {
		const props = makeProps({
			selections: {
				selectedPlatforms: ['Ondo', 'Maple']
			}
		})
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(definitions, draft)

		expect(draft.activeIds).toContain('platforms')
		expect(updates.platforms).toBeUndefined()
		expect(updates.excludePlatforms).toBe('Centrifuge')
	})

	it('seeds a newly added select filter with current values instead of an empty None selection', () => {
		const props = makeProps()
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const platforms = definitions.find((definition) => definition.id === 'platforms')

		const nextDraft = RWA_FILTERS_TEST_UTILS.addDraftFilter(draft, platforms!)
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(definitions, nextDraft)

		expect(nextDraft.activeIds).toEqual(['types', 'platforms'])
		expect(nextDraft.selectValues.platforms).toEqual(['Ondo', 'Maple', 'Centrifuge'])
		expect(updates.platforms).toBeUndefined()
		expect(updates.excludePlatforms).toBeUndefined()
	})

	it('does not serialize None for a Types filter whose default selection is empty', () => {
		const props = makeProps({
			modes: {
				mode: 'category',
				isChainMode: false,
				isCategoryMode: true
			},
			options: {
				categorySlug: 'other-rwas',
				typeOptions: [
					{ key: 'Unknown', name: 'Unknown' },
					{ key: 'Other', name: 'Other' }
				]
			},
			selections: {
				selectedTypes: []
			}
		})
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const types = definitions.find((definition) => definition.id === 'types')

		const nextDraft = RWA_FILTERS_TEST_UTILS.addDraftFilter(draft, types!)
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(definitions, nextDraft)

		expect(nextDraft.selectValues.types).toEqual([])
		expect(updates.types).toBeUndefined()
		expect(updates.excludeTypes).toBeUndefined()
	})

	it('keeps reset enabled for hidden filter params and chart params', () => {
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({ types: 'Asset' } as any)).toBe(true)
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({ chartView: 'treemap' } as any)).toBe(true)
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({ timeSeriesChartBreakdown: 'total' } as any)).toBe(true)
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({} as any)).toBe(false)
	})

	it('does not render an active pill for an empty or stale exclude query', () => {
		const props = makeProps()
		const router = { query: { excludePlatforms: 'Bogus' } }
		const pills = RWA_FILTERS_TEST_UTILS.getRwaActiveFilterPills(props as any, router as any)

		expect(pills).toEqual([])
	})
})
