import { describe, expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import {
	filterStablecoinAssets,
	resolveStablecoinFilterState,
	resolveSelectedStablecoinFilterKeys,
	stablecoinAttributeOptions,
	stablecoinBackingOptions,
	stablecoinPegTypeOptions
} from '../filterPolicy'
import type { FormattedStablecoinAsset } from '../utils'

const stablecoin = (overrides: Partial<FormattedStablecoinAsset>): FormattedStablecoinAsset => ({
	id: 'usdc',
	chartLabel: 'USDC',
	name: 'USD Coin',
	symbol: 'USDC',
	gecko_id: 'usd-coin',
	chains: ['Ethereum'],
	pegType: 'peggedUSD',
	pegMechanism: 'fiat-backed',
	circulating: 0,
	circulatingPrevDay: null,
	circulatingPrevWeek: null,
	circulatingPrevMonth: null,
	unreleased: null,
	mcap: null,
	price: null,
	change_1d: null,
	change_7d: null,
	change_1m: null,
	change_1d_nol: null,
	change_7d_nol: null,
	change_1m_nol: null,
	pegDeviation: null,
	pegDeviation_1m: null,
	pegDeviationInfo: null,
	doublecounted: false,
	...overrides
})

describe('stablecoin filter policy', () => {
	test('uses all option keys when no filters are active', () => {
		const state = resolveStablecoinFilterState({})

		expect(state).toEqual({
			selectedAttributes: stablecoinAttributeOptions.map((option) => option.key),
			selectedPegTypes: stablecoinPegTypeOptions.map((option) => option.key),
			selectedBackings: stablecoinBackingOptions.map((option) => option.key),
			minMcap: null,
			maxMcap: null,
			hasActiveFilters: false
		})
	})

	test('normalizes include and exclude keys case-insensitively', () => {
		const state = resolveStablecoinFilterState({
			attribute: ['stable', 'YIELDBEARING'],
			excludeAttribute: 'yieldbearing',
			pegtype: ['peggedusd', 'PEGGEDEUR'],
			excludePegtype: 'peggedeur',
			backing: 'fiatstables'
		})

		expect(state.selectedAttributes).toEqual(['STABLE'])
		expect(state.selectedPegTypes).toEqual(['PEGGEDUSD'])
		expect(state.selectedBackings).toEqual(['FIATSTABLES'])
		expect(state.hasActiveFilters).toBe(true)
	})

	test('keeps legacy typo aliases for attribute filters', () => {
		const state = resolveStablecoinFilterState({
			attribute: ['deppeged', 'unknow']
		})

		expect(state.selectedAttributes).toEqual(['DEPEGGED', 'UNKNOWN'])
	})

	test('treats None as an empty selected set', () => {
		const state = resolveStablecoinFilterState({
			attribute: 'none',
			pegtype: 'None',
			backing: ['FIATSTABLES', 'None']
		})

		expect(state.selectedAttributes).toEqual([])
		expect(state.selectedPegTypes).toEqual([])
		expect(state.selectedBackings).toEqual([])
	})

	test('filters by combined attribute, peg type, backing, and mcap range', () => {
		const assets = [
			stablecoin({ name: 'USD Coin', symbol: 'USDC', mcap: 100, pegDeviation: 0 }),
			stablecoin({ name: 'Dai', symbol: 'DAI', pegMechanism: 'crypto-backed', mcap: 75, pegDeviation: 0 }),
			stablecoin({ name: 'Euro Coin', symbol: 'EUROC', pegType: 'peggedEUR', mcap: 110, pegDeviation: 0 }),
			stablecoin({ name: 'Tether', symbol: 'USDT', mcap: 200, pegDeviation: 0 })
		]
		const state = resolveStablecoinFilterState({
			attribute: 'stable',
			pegtype: 'peggedusd',
			backing: 'fiatstables',
			minMcap: '50',
			maxMcap: '150'
		})

		expect(filterStablecoinAssets(assets, state).map((asset) => asset.symbol)).toEqual(['USDC'])
	})

	test('excludes assets without mcap only when a mcap range is active', () => {
		const assets = [
			stablecoin({ name: 'USD Coin', symbol: 'USDC', mcap: 100, pegDeviation: 0 }),
			stablecoin({ name: 'No Cap USD', symbol: 'NOCAP', mcap: null, pegDeviation: 0 })
		]

		expect(
			filterStablecoinAssets(
				assets,
				resolveStablecoinFilterState({
					attribute: 'stable'
				})
			).map((asset) => asset.symbol)
		).toEqual(['USDC', 'NOCAP'])
		expect(
			filterStablecoinAssets(
				assets,
				resolveStablecoinFilterState({
					attribute: 'stable',
					maxMcap: '150'
				})
			).map((asset) => asset.symbol)
		).toEqual(['USDC'])
	})

	test('marks invalid mcap query values active without applying a range', () => {
		const state = resolveStablecoinFilterState({ minMcap: 'not-a-number' })

		expect(state.minMcap).toBeNull()
		expect(state.hasActiveFilters).toBe(true)
	})
})

describe('stablecoin selection URL round trips', () => {
	const groups = [
		{ name: 'attributes', include: 'attribute', exclude: 'excludeAttribute', options: stablecoinAttributeOptions },
		{ name: 'backing', include: 'backing', exclude: 'excludeBacking', options: stablecoinBackingOptions },
		{ name: 'peg types', include: 'pegtype', exclude: 'excludePegtype', options: stablecoinPegTypeOptions },
		{
			name: 'chain-scoped backing',
			include: 'backing',
			exclude: 'excludeBacking',
			options: stablecoinBackingOptions.slice(0, 2)
		}
	] as const
	for (const { name, include, exclude, options } of groups) {
		test(`preserves none, all, only and every individual deselection for ${name}`, () => {
			const all = options.map((option) => option.key)
			const selections = [
				[],
				all,
				...all.map((key) => [key]),
				...all.map((key) => all.filter((value) => value !== key))
			]
			for (const selection of selections) {
				const updates = getQueryUpdatesFromSelected(include, exclude, all, selection)
				const restored = resolveSelectedStablecoinFilterKeys({
					includeParam: updates[include],
					excludeParam: updates[exclude],
					options
				})
				expect(new Set(restored)).toEqual(new Set(selection))
			}
			expect(getQueryUpdatesFromSelected(include, exclude, all, [])).toEqual({
				[include]: 'None',
				[exclude]: undefined
			})
			expect(getQueryUpdatesFromSelected(include, exclude, all, all)).toEqual({
				[include]: undefined,
				[exclude]: undefined
			})
		})
	}

	test('keeps explicit empty selection empty in the data pipeline', () => {
		const rows = [stablecoin({ pegDeviation: 0, mcap: 100 })]
		for (const key of ['attribute', 'backing', 'pegtype']) {
			expect(filterStablecoinAssets(rows, resolveStablecoinFilterState({ [key]: 'None' }))).toEqual([])
		}
	})

	test('preserves OR semantics for overlapping attributes', () => {
		const rows = [stablecoin({ pegDeviation: 0, yieldBearing: true, mcap: 100 })]
		expect(filterStablecoinAssets(rows, resolveStablecoinFilterState({ excludeAttribute: 'YIELDBEARING' }))).toEqual(
			rows
		)
		expect(filterStablecoinAssets(rows, resolveStablecoinFilterState({ attribute: 'DEPEGGED' }))).toEqual([])
	})

	test('does not allocate a new asset list for the default unfiltered view', () => {
		const rows = [stablecoin({ pegDeviation: 0, mcap: 100 })]
		expect(filterStablecoinAssets(rows, resolveStablecoinFilterState({}))).toBe(rows)
	})
})
