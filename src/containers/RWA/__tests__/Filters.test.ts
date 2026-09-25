import type { ComponentProps } from 'react'
import { describe, expect, test } from 'vitest'
import { RWA_FILTERS_TEST_UTILS, type RWAOverviewFilters } from '../Filters'

const actions = {
	setDefiActiveTvlToOnChainMcapPctRange: () => {},
	setActiveMcapToOnChainMcapPctRange: () => {},
	setDefiActiveTvlToActiveMcapPctRange: () => {},
	setRedeemableStates: () => {},
	setAttestationsStates: () => {},
	setCexListedStates: () => {},
	setKycForMintRedeemStates: () => {},
	setKycAllowlistedWhitelistedToTransferHoldStates: () => {},
	setTransferableStates: () => {},
	setSelfCustodyStates: () => {}
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

	test('marks changed select filters active and serializes them with the shared include/exclude rules', () => {
		const props = makeProps({
			selections: {
				selectedPlatforms: ['Ondo', 'Maple']
			}
		})
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(props as any, draft)

		expect(draft.activeIds).toContain('platforms')
		expect(updates.platforms).toBeUndefined()
		expect(updates.excludePlatforms).toBe('Centrifuge')
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

	test('keeps reset enabled for hidden filter, chart, and flow params', () => {
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({ types: 'Asset' })).toBe(true)
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({ chartView: 'treemap' })).toBe(true)
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({ timeSeriesChartBreakdown: 'total' })).toBe(true)
		for (const key of [
			'flowMode',
			'flowOverlays',
			'flowRotationView',
			'flowRotationBy',
			'flowRotationFrequency',
			'flowHeatmapSize',
			'flowTreemapSize'
		]) {
			expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({ [key]: 'custom' })).toBe(true)
		}
		expect(RWA_FILTERS_TEST_UTILS.hasResettableRwaQueryParam({})).toBe(false)
	})

	test('does not render an active pill for an empty or stale exclude query', () => {
		const props = makeProps()
		const router = { query: { excludePlatforms: 'Bogus' } }
		const pills = RWA_FILTERS_TEST_UTILS.getRwaActiveFilterPills(props as any, router as any)

		expect(pills).toEqual([])
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
