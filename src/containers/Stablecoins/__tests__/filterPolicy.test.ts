import { describe, expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import {
	filterStablecoinAssets,
	resolveStablecoinFilterState,
	stablecoinAttributeOptions,
	stablecoinBackingOptions,
	stablecoinPegTypeOptions
} from '../filterPolicy'
import type { StablecoinFilterState } from '../filterPolicy'
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

	test('reads All as every option, and None over All', () => {
		const state = resolveStablecoinFilterState({ attribute: 'All', pegtype: 'All', backing: ['All', 'None'] })

		expect(state.selectedAttributes).toEqual(['STABLE', 'YIELDBEARING', 'UNKNOWN', 'DEPEGGED'])
		expect(state.selectedPegTypes).toHaveLength(28)
		expect(state.selectedBackings).toEqual([])
	})

	test('treats None as an empty selected set', () => {
		const state = resolveStablecoinFilterState({
			attribute: 'None',
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
			attribute: 'STABLE',
			pegtype: 'PEGGEDUSD',
			backing: 'FIATSTABLES',
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
					attribute: 'STABLE'
				})
			).map((asset) => asset.symbol)
		).toEqual(['USDC', 'NOCAP'])
		expect(
			filterStablecoinAssets(
				assets,
				resolveStablecoinFilterState({
					attribute: 'STABLE',
					maxMcap: '150'
				})
			).map((asset) => asset.symbol)
		).toEqual(['USDC'])
	})

	test('keeps stablecoins of every peg type when only a market cap range is set', () => {
		const assets = [
			stablecoin({ symbol: 'WCLP', pegType: 'peggedCLP', mcap: 100, pegDeviation: 0 }),
			stablecoin({ symbol: 'WPEN', pegType: 'peggedPEN', mcap: 100, pegDeviation: 0 })
		]

		expect(
			filterStablecoinAssets(assets, resolveStablecoinFilterState({ minMcap: '50' })).map((asset) => asset.symbol)
		).toEqual(['WCLP', 'WPEN'])
	})

	test('marks invalid mcap query values active without applying a range', () => {
		const state = resolveStablecoinFilterState({ minMcap: 'not-a-number' })

		expect(state.minMcap).toBeNull()
		expect(state.hasActiveFilters).toBe(true)
	})
})

describe('stablecoin selection URL round trips', () => {
	const groups = [
		{
			name: 'attributes',
			include: 'attribute',
			exclude: 'excludeAttribute',
			options: stablecoinAttributeOptions,
			read: (state: StablecoinFilterState) => state.selectedAttributes
		},
		{
			name: 'backing',
			include: 'backing',
			exclude: 'excludeBacking',
			options: stablecoinBackingOptions,
			read: (state: StablecoinFilterState) => state.selectedBackings
		},
		{
			name: 'peg types',
			include: 'pegtype',
			exclude: 'excludePegtype',
			options: stablecoinPegTypeOptions,
			read: (state: StablecoinFilterState) => state.selectedPegTypes
		}
	] as const
	for (const { name, include, exclude, options, read } of groups) {
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
				const restored = read(resolveStablecoinFilterState(updates))
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
})
