import { describe, expect, test } from 'vitest'
import { RWA_FILTERS_TEST_UTILS } from '../Filters'
import { readRwaQueryFilters } from '../filterState'
import { makeProps } from './filterProps'

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
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)

		const nextDraft = RWA_FILTERS_TEST_UTILS.addDraftFilter(draft, 'platforms')
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

	test('More filters leaves the inline filters out: not offered, not counted, not cleared on apply', () => {
		const props = makeProps({
			inlineFilters: ['categories', 'assetGroups', 'accessModels'],
			selections: { selectedCategories: ['Treasuries'], selectedTypes: ['Asset'] }
		})
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(props as any, { ...draft, activeIds: [] })
		const pills = RWA_FILTERS_TEST_UTILS.getRwaActiveFilterPills(props as any, { query: {} } as any)

		expect(definitions.map((definition) => definition.id)).not.toContain('categories')
		expect(draft.activeIds).toEqual(['types'])
		expect('categories' in updates || 'excludeCategories' in updates).toBe(false)
		expect(updates.types).toBeUndefined()
		expect('types' in updates).toBe(true)
		expect(pills.map((pill) => pill.label)).toEqual(['Types: Asset'])
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
