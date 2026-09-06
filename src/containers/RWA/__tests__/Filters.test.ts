// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_FILTERS_TEST_UTILS, RWAOverviewFilters } from '../Filters'
import { useRWATableQueryParams } from '../hooks'

const routerMock = vi.hoisted(() => ({
	query: {} as Record<string, string | Array<string> | undefined>,
	push: vi.fn()
}))

vi.mock('next/router', () => ({
	useRouter: () => ({ query: routerMock.query, pathname: '/rwa', asPath: '/rwa', push: routerMock.push })
}))

const actions = {
	setDefiActiveTvlToOnChainMcapPctRange: () => {},
	setActiveMcapToOnChainMcapPctRange: () => {},
	setDefiActiveTvlToActiveMcapPctRange: () => {},
	setIncludeStablecoins: () => {},
	setIncludeGovernance: () => {},
	setIncludeRwaPerps: () => {},
	setIncludeCex: () => {},
	setIncludeBridgeTvl: () => {},
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
		includeRwaPerps: false,
		includeCex: false,
		includeBridgeTvl: true
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
	test('marks non-all default select filters active on a clean page', () => {
		const props = makeProps()
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)

		expect(draft.activeIds).toEqual(['types'])
		expect(draft.activeIds).not.toContain('platforms')
		expect(definitions.filter((definition) => definition.kind === 'select').length).toBeGreaterThan(0)
	})

	test('serializes a removed default select filter as all values', () => {
		const props = makeProps()
		const definitions = RWA_FILTERS_TEST_UTILS.getRwaFilterDefinitions(props as any)
		const draft = RWA_FILTERS_TEST_UTILS.createRwaFilterDraft(props as any)
		const nextDraft = RWA_FILTERS_TEST_UTILS.removeDraftFilter(draft, 'types')
		const updates = RWA_FILTERS_TEST_UTILS.serializeRwaFilterDraft(definitions, nextDraft)

		expect(nextDraft.activeIds).toEqual([])
		expect(updates.types).toEqual(['Asset', 'Platform', 'Wrapper'])
		expect(updates.excludeTypes).toBeUndefined()
	})

	test('marks changed select filters active and serializes them with the shared include/exclude rules', () => {
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

	test('seeds a newly added select filter with current values instead of an empty None selection', () => {
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

	test('does not serialize None for a Types filter whose default selection is empty', () => {
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

function FiltersProbe() {
	const { options } = baseProps
	const state = useRWATableQueryParams({
		assetNames: options.assetNames,
		types: options.typeOptions.map((option) => option.key),
		categories: options.categoriesOptions.map((option) => option.key),
		platforms: options.platforms,
		assetGroups: options.assetGroups,
		assetClasses: options.assetClassOptions.map((option) => option.key),
		rwaClassifications: options.rwaClassificationOptions.map((option) => option.key),
		accessModels: options.accessModelOptions.map((option) => option.key),
		issuers: options.issuers,
		defaultInclusion: baseProps.defaultInclusion,
		mode: 'chain'
	})
	return createElement(RWAOverviewFilters, { ...baseProps, selections: state, actions: state })
}

describe('RWA overview inclusion controls', () => {
	let container: HTMLDivElement
	let root: Root
	const render = () =>
		act(async () => {
			root.render(createElement(FiltersProbe))
		})
	const checkbox = (value: string) => container.querySelector<HTMLInputElement>(`input[value="${value}"]`)
	const click = async (value: string) => {
		await act(async () => {
			checkbox(value)!.click()
		})
		await render()
	}

	beforeEach(() => {
		routerMock.query = {}
		routerMock.push.mockReset()
		routerMock.push.mockImplementation(async ({ query }: { query: typeof routerMock.query }) => {
			routerMock.query = query
			return true
		})
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('reveals CEX only with perps and clears its selection when perps are switched off', async () => {
		await render()
		expect(checkbox('includeCex')).toBeNull()
		await click('includeRwaPerps')
		expect(checkbox('includeCex')!.checked).toBe(false)
		await click('includeCex')
		expect(checkbox('includeCex')!.checked).toBe(true)
		expect(routerMock.query).toMatchObject({ includeRwaPerps: 'true', includeCex: 'true' })
		await click('includeRwaPerps')
		expect(checkbox('includeCex')).toBeNull()
		expect(routerMock.query.includeCex).toBeUndefined()
		await click('includeRwaPerps')
		expect(checkbox('includeCex')!.checked).toBe(false)
	})

	test('restores inclusion from the URL and lets Reset filters clear both boxes', async () => {
		routerMock.query = { includeRwaPerps: 'true', includeCex: 'true' }
		await render()
		expect(checkbox('includeRwaPerps')!.checked).toBe(true)
		expect(checkbox('includeCex')!.checked).toBe(true)
		await act(async () => {
			const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset filters')!
			reset.click()
		})
		await render()
		expect(routerMock.query).toEqual({})
		expect(checkbox('includeRwaPerps')!.checked).toBe(false)
		expect(checkbox('includeCex')).toBeNull()
	})

	test('follows back/forward query changes without retaining a stale CEX selection', async () => {
		await render()
		routerMock.query = { includeRwaPerps: 'true', includeCex: 'true' }
		await render()
		expect(checkbox('includeCex')!.checked).toBe(true)
		routerMock.query = { includeRwaPerps: 'true' }
		await render()
		expect(checkbox('includeCex')!.checked).toBe(false)
		routerMock.query = { includeCex: 'true' }
		await render()
		expect(checkbox('includeRwaPerps')!.checked).toBe(false)
		expect(checkbox('includeCex')).toBeNull()
		await click('includeRwaPerps')
		expect(checkbox('includeCex')!.checked).toBe(false)
	})
})
