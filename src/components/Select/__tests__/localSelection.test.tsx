// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
	boundSelection,
	resolveLocalSelection,
	useLocalSelection,
	useLocalSelectionWithRemainder
} from '../localSelection'

type Options = Parameters<typeof useLocalSelection>[0]

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function renderSelection<T>(useHook: (options: Options) => T) {
	let latest!: T
	function Harness(options: Options) {
		latest = useHook(options)
		return null
	}
	return {
		render: async (options: Options) => {
			await act(async () => root.render(<Harness {...options} />))
			return latest
		},
		get current() {
			return latest
		}
	}
}

describe('useLocalSelection', () => {
	test('keeps a pick the options hide and shows it again when its option returns', async () => {
		const selection = renderSelection(useLocalSelection)
		const options = { scope: 'tokens', allowEmptySelection: true }
		await selection.render({ ...options, availableSeries: ['ETH', 'stETH', 'USDC'] })
		act(() => selection.current.setSelectedSeries(['ETH', 'stETH']))

		// A TVL setting that removes stETH from the data, then adds it back.
		expect((await selection.render({ ...options, availableSeries: ['ETH', 'USDC'] })).activeSeries).toEqual(['ETH'])
		expect((await selection.render({ ...options, availableSeries: ['ETH', 'stETH', 'USDC'] })).activeSeries).toEqual([
			'ETH',
			'stETH'
		])
	})

	test('shows a series that appears later after "all except", but not after an include list', async () => {
		const selection = renderSelection(useLocalSelection)
		const options = { scope: 'stablecoins', allowEmptySelection: true }
		await selection.render({ ...options, availableSeries: ['USDT', 'USDC', 'DAI', 'FDUSD'] })
		act(() => selection.current.setSelectedSeries(['USDC', 'DAI', 'FDUSD']))
		expect(
			(await selection.render({ ...options, availableSeries: ['USDT', 'USDC', 'DAI', 'FDUSD', 'PYUSD'] })).activeSeries
		).toEqual(['USDC', 'DAI', 'FDUSD', 'PYUSD'])

		act(() => selection.current.setSelectedSeries(['USDC']))
		expect(
			(await selection.render({ ...options, availableSeries: ['USDT', 'USDC', 'DAI', 'FDUSD', 'PYUSD', 'USDe'] }))
				.activeSeries
		).toEqual(['USDC'])
	})

	test('keeps picks through an empty series list and shows the default when none of them exist', async () => {
		const selection = renderSelection(useLocalSelection)
		await selection.render({ scope: 'peers', availableSeries: ['A', 'B'] })
		act(() => selection.current.setSelectedSeries(['B']))

		expect((await selection.render({ scope: 'peers', availableSeries: [] })).activeSeries).toEqual([])
		expect((await selection.render({ scope: 'peers', availableSeries: ['C', 'B'] })).activeSeries).toEqual(['B'])
		const stale = await selection.render({ scope: 'peers', availableSeries: ['E', 'F'] })
		// Falling back to the default counts as the default, so a pie shows its Others slice again.
		expect([stale.activeSeries, stale.isDefaultSelection]).toEqual([['E', 'F'], true])
	})

	test("starts from the default in a new scope and keeps each scope's own picks", async () => {
		const selection = renderSelection(useLocalSelection)
		await selection.render({ scope: 'protocol-a', availableSeries: ['USDC', 'ETH', 'DAI'] })
		act(() => selection.current.setSelectedSeries(['USDC']))

		const other = await selection.render({ scope: 'protocol-b', availableSeries: ['USDC', 'ETH', 'DAI'] })
		expect([other.activeSeries, other.isDefaultSelection]).toEqual([['USDC', 'ETH', 'DAI'], true])
		// Each scope keeps its own picks, such as a chart's type switched away from and back.
		const back = await selection.render({ scope: 'protocol-a', availableSeries: ['USDC', 'ETH', 'DAI'] })
		expect(back.activeSeries).toEqual(['USDC'])
	})

	test('follows the default until the user picks, and picking exactly the default follows it again', async () => {
		const selection = renderSelection(useLocalSelection)
		const options = { scope: 'chains', allowEmptySelection: true }
		await selection.render({ ...options, availableSeries: ['A', 'B'] })
		act(() => selection.current.setSelectedSeries(['A', 'B']))

		const grown = await selection.render({ ...options, availableSeries: ['A', 'B', 'C'] })
		expect([grown.activeSeries, grown.isDefaultSelection]).toEqual([['A', 'B', 'C'], true])

		act(() => selection.current.setSelectedSeries(['A']))
		const subset = await selection.render({ ...options, availableSeries: ['A', 'B', 'C', 'D'] })
		expect([subset.activeSeries, subset.isDefaultSelection]).toEqual([['A'], false])
	})

	test('keeps an explicit empty selection only when empty is allowed', async () => {
		const selection = renderSelection(useLocalSelection)
		await selection.render({ scope: 'empty', availableSeries: ['A', 'B'], allowEmptySelection: true })
		act(() => selection.current.setSelectedSeries([]))
		expect(selection.current.activeSeries).toEqual([])

		await selection.render({ scope: 'first-default', availableSeries: ['A', 'B'] })
		act(() => selection.current.setSelectedSeries([]))
		expect(selection.current.activeSeries).toEqual(['A'])
	})

	test('keeps a newly added series when a capped selection is full', async () => {
		const selection = renderSelection(useLocalSelection)
		const capped = await selection.render({ scope: 'capped', availableSeries: ['A', 'B', 'C'], maxSelectedSeries: 2 })
		expect(capped.activeSeries).toEqual(['A', 'B'])

		act(() => selection.current.setSelectedSeries(['A', 'B', 'C']))
		expect(selection.current.activeSeries).toEqual(['A', 'C'])
	})
})

describe('useLocalSelectionWithRemainder', () => {
	test('draws the Others remainder only while the peers shown are the default ones', async () => {
		const selection = renderSelection(useLocalSelectionWithRemainder)
		const initial = await selection.render({
			scope: 'breakdown',
			availableSeries: ['A', 'B', 'C', 'Others'],
			defaultSeries: ['A', 'B'],
			allowEmptySelection: true
		})
		expect([initial.selectableSeries, initial.renderedCharts]).toEqual([['A', 'B', 'C'], new Set(['A', 'B', 'Others'])])

		act(() => selection.current.setSelectedSeries(['A', 'C']))
		expect(selection.current.renderedCharts).toEqual(new Set(['A', 'C']))
		act(() => selection.current.setSelectedSeries(['B', 'A']))
		expect(selection.current.renderedCharts).toEqual(new Set(['B', 'A', 'Others']))
		act(() => selection.current.setSelectedSeries([]))
		expect(selection.current.renderedCharts).toEqual(new Set())
	})
})

describe('resolveLocalSelection', () => {
	test('shows picks in their order, drops duplicates and missing names, and applies the cap', () => {
		expect(
			resolveLocalSelection({
				intent: { mode: 'include', names: ['C', 'A', 'C', 'Z', 'B'] },
				availableSeries: ['A', 'B', 'C'],
				maxSelectedSeries: 2
			})
		).toEqual(['C', 'A'])
	})

	test('shows the capped default before the user picks', () => {
		expect(
			resolveLocalSelection({
				intent: null,
				availableSeries: ['A', 'B', 'C'],
				defaultSeries: ['C', 'B', 'A'],
				maxSelectedSeries: 2
			})
		).toEqual(['C', 'B'])
	})
})

describe('boundSelection', () => {
	test('keeps a newly selected tail series when the selection is at its cap', () => {
		expect(boundSelection(['A', 'B'], ['A', 'B', 'C'], 2)).toEqual(['A', 'C'])
	})
})
