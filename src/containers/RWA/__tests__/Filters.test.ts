import type { ComponentProps } from 'react'
import { describe, expect, test } from 'vitest'
import { RWA_FILTERS_TEST_UTILS, type RWAOverviewFilters } from '../Filters'
import { readRwaQueryFilters } from '../filterState'

const actions = {
	setDefiActiveTvlToOnChainMcapPctRange: () => {},
	setActiveMcapToOnChainMcapPctRange: () => {},
	setDefiActiveTvlToActiveMcapPctRange: () => {}
}

const baseProps: ComponentProps<typeof RWAOverviewFilters> = {
	enabled: true,
	defaultInclusion: { includeStablecoins: false, includeGovernance: false, includeRwaPerps: false },
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
		selectedTypes: ['Asset', 'Platform', 'Wrapper'],
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
		includeBridgeTvl: true,
		includeWrappers: false
	},
	actions
}

function makeProps(overrides: Record<string, unknown> = {}) {
	return {
		...baseProps,
		...overrides,
		options: { ...baseProps.options, ...(overrides.options as Record<string, unknown> | undefined) },
		selections: { ...baseProps.selections, ...(overrides.selections as Record<string, unknown> | undefined) },
		modes: { ...baseProps.modes, ...(overrides.modes as Record<string, unknown> | undefined) }
	}
}

describe('RWA overview filter dialog helpers', () => {
	test('starts with no active filter on a clean page', () => {
		const props = makeProps()
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)

		expect(draft.activeIds).toEqual([])
		expect(definitions.filter((definition) => definition.kind === 'select').length).toBeGreaterThan(0)
	})

	test('serializes a removed select filter as absent, so Clear all leaves the URL clean', () => {
		const props = makeProps({ selections: { selectedTypes: ['Asset'] } })
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		expect(draft.activeIds).toEqual(['types'])
		const nextDraft = RWA_FILTERS_TEST_UTILS.removeDraftFilter(draft, 'types')
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(props as any, nextDraft)

		expect(nextDraft.activeIds).toEqual([])
		expect(updates.types).toBeUndefined()
		expect(updates.excludeTypes).toBeUndefined()
	})

	test('opens a narrowed select filter as active in the dialog', () => {
		const props = makeProps({ selections: { selectedPlatforms: ['Ondo', 'Maple'] } })
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)

		expect(draft.activeIds).toEqual(['platforms'])
	})

	test('seeds a newly added select filter with current values instead of an empty None selection', () => {
		const props = makeProps()
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const platforms = definitions.find((definition) => definition.id === 'platforms')

		const nextDraft = RWA_FILTERS_TEST_UTILS.addDraftFilter(draft, platforms!)
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(props as any, nextDraft)

		expect(nextDraft.activeIds).toEqual(['platforms'])
		expect(nextDraft.selectValues.platforms).toEqual(['Ondo', 'Maple', 'Centrifuge'])
		expect(updates.platforms).toBeUndefined()
		expect(updates.excludePlatforms).toBeUndefined()
	})

	test('saved filters read back as the selections the dialog saved', () => {
		const props = makeProps()
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(props as any, {
			...draft,
			activeIds: ['types', 'platforms', 'issuers', 'redeemableStates', 'attestationsStates'],
			selectValues: { ...draft.selectValues, types: ['Asset'], platforms: ['Ondo', 'Maple'], issuers: [] },
			attributeStates: { redeemableStates: ['yes', 'no'], attestationsStates: [] }
		})
		const query: Record<string, string | Array<string>> = {}
		for (const key in updates) {
			const value = updates[key]
			if (value !== undefined) query[key] = value
		}
		const options = {
			types: ['Asset', 'Platform', 'Wrapper'],
			assetNames: ['USDY', 'USTB'],
			assetGroups: ['Bonds', 'Private Credit'],
			categories: ['Treasuries', 'Private Credit'],
			platforms: ['Ondo', 'Maple', 'Centrifuge'],
			assetClasses: ['Debt', 'Fund'],
			rwaClassifications: ['Tokenized Asset', 'Synthetic'],
			accessModels: ['Permissioned', 'Permissionless'],
			issuers: ['Issuer One', 'Issuer Two']
		}
		const filters = readRwaQueryFilters(query, options, 'chain')

		expect(filters.selectedTypes).toEqual(['Asset'])
		expect(filters.selectedPlatforms).toEqual(['Ondo', 'Maple'])
		expect(filters.selectedIssuers).toEqual([])
		expect(filters.selectedRedeemableStates).toEqual(['yes', 'no'])
		expect(filters.selectedAttestationsStates).toEqual([])
		expect(filters.selectedCategories).toEqual(['Treasuries', 'Private Credit'])
	})

	test('labels a narrowed filter pill the way the picker trigger describes it', () => {
		const props = makeProps({
			selections: {
				selectedTypes: [],
				selectedPlatforms: ['Ondo', 'Maple'],
				selectedRedeemableStates: ['yes', 'no']
			}
		})
		const pills = RWA_FILTERS_TEST_UTILS.getRwaActiveFilterPills(props as any, { query: {} } as any)

		expect(pills.map((pill) => pill.label)).toEqual([
			'Types: None',
			'Platforms: All except Centrifuge',
			'Redeemable: All except Unknown'
		])
	})
})

describe('RWA overview Include group', () => {
	test('seeds the draft from the current inclusion and serializes only overrides', () => {
		const props = makeProps()
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		expect(draft.inclusion).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeWrappers: false,
			includeBridgeTvl: true
		})

		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(props as any, {
			...draft,
			inclusion: { includeStablecoins: true, includeGovernance: false, includeWrappers: true, includeBridgeTvl: false }
		})
		expect(updates.includeStablecoins).toBe('true')
		expect(updates.includeGovernance).toBeUndefined()
		expect(updates.includeBridgeTvl).toBe('false')
		expect(updates.includeWrappers).toBe('true')
	})

	test('clears an override that returns to its default', () => {
		const props = makeProps({ selections: { includeStablecoins: true } })
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		expect(draft.inclusion.includeStablecoins).toBe(true)

		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(props as any, {
			...draft,
			inclusion: { ...draft.inclusion, includeStablecoins: false }
		})
		expect(updates.includeStablecoins).toBeUndefined()
	})

	test('shows an override as a pill on the strip', () => {
		const props = makeProps({ selections: { includeGovernance: true } })
		const router = { query: { includeGovernance: 'true' } }
		const pills = RWA_FILTERS_TEST_UTILS.getRwaActiveFilterPills(props as any, router as any)
		expect(pills.map((pill) => pill.label)).toEqual(['Governance Tokens: included'])
	})
})
