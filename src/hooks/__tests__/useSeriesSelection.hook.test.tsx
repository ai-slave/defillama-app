// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useAllSeriesSelection, useSeriesSelection, useSeriesSelectionWithFixedRemainder } from '../useSeriesSelection'

type SelectionResult = ReturnType<typeof useSeriesSelection>

function SelectionHarness({
	availableSeries,
	defaultSeries,
	maxSelectedSeries,
	selectionKey,
	storeDefaultAsIntent,
	resetToDefaultWhenStale,
	allowEmptySelection,
	onRender
}: {
	availableSeries: Array<string>
	defaultSeries?: Array<string>
	maxSelectedSeries?: number
	selectionKey?: string
	storeDefaultAsIntent?: boolean
	resetToDefaultWhenStale?: boolean
	allowEmptySelection?: boolean
	onRender: (result: SelectionResult) => void
}) {
	const result = useSeriesSelection({
		availableSeries,
		defaultSeries,
		maxSelectedSeries,
		selectionKey,
		storeDefaultAsIntent,
		resetToDefaultWhenStale,
		allowEmptySelection
	})
	onRender(result)
	return null
}

describe('useSeriesSelection', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: SelectionResult

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const renderSelection = async (props: Omit<React.ComponentProps<typeof SelectionHarness>, 'onRender'>) => {
		await act(async () => {
			root.render(<SelectionHarness {...props} onRender={(result) => (latest = result)} />)
		})
	}

	test('keeps an explicit selection through a transient empty series list', async () => {
		await renderSelection({ availableSeries: ['A', 'B'], selectionKey: 'peers' })
		act(() => latest.setSelectedSeries(['B']))
		expect(latest.activeSeries).toEqual(['B'])

		await renderSelection({ availableSeries: [], selectionKey: 'peers' })
		expect(latest.activeSeries).toEqual([])

		await renderSelection({ availableSeries: ['C', 'B'], selectionKey: 'peers' })
		expect(latest.activeSeries).toEqual(['B'])
	})

	test('establishes fresh capped defaults when the selection key changes', async () => {
		await renderSelection({ availableSeries: ['A', 'B', 'C'], maxSelectedSeries: 2, selectionKey: 'first' })
		act(() => latest.setSelectedSeries(['C']))
		expect(latest.activeSeries).toEqual(['C'])

		await renderSelection({
			availableSeries: ['A', 'B', 'C'],
			defaultSeries: ['B', 'A', 'C'],
			maxSelectedSeries: 2,
			selectionKey: 'second'
		})
		expect(latest.activeSeries).toEqual(['B', 'A'])
		expect(latest.selectedCharts).toEqual(new Set(['B', 'A']))
	})

	test('keeps a newly added peer when a selection is already at its cap', async () => {
		await renderSelection({ availableSeries: ['A', 'B', 'C'], maxSelectedSeries: 2 })
		expect(latest.activeSeries).toEqual(['A', 'B'])

		act(() => latest.setSelectedSeries(['A', 'B', 'C']))
		expect(latest.activeSeries).toEqual(['A', 'C'])
	})

	test('stores a complete default as intent while preserving explicit empty and resetting stale subsets', async () => {
		const options = {
			storeDefaultAsIntent: true,
			resetToDefaultWhenStale: true,
			allowEmptySelection: true
		}
		await renderSelection({ availableSeries: ['A', 'B'], ...options })
		act(() => latest.setSelectedSeries(['A', 'B']))
		await renderSelection({ availableSeries: ['A', 'B', 'C'], ...options })
		expect(latest.activeSeries).toEqual(['A', 'B', 'C'])

		act(() => latest.setSelectedSeries([]))
		await renderSelection({ availableSeries: ['A', 'B', 'C', 'D'], ...options })
		expect(latest.activeSeries).toEqual([])

		act(() => latest.setSelectedSeries(['D']))
		await renderSelection({ availableSeries: ['E', 'F'], ...options })
		expect(latest.activeSeries).toEqual(['E', 'F'])
	})

	test('keeps an explicit subset that matches every available series when the missing peer returns', async () => {
		const options = {
			storeDefaultAsIntent: true,
			resetToDefaultWhenStale: true,
			allowEmptySelection: true
		}
		await renderSelection({ availableSeries: ['A', 'B', 'C'], ...options })
		act(() => latest.setSelectedSeries(['A', 'B']))

		await renderSelection({ availableSeries: ['A', 'B'], ...options })
		expect(latest.activeSeries).toEqual(['A', 'B'])

		await renderSelection({ availableSeries: ['A', 'B', 'C'], ...options })
		expect(latest.activeSeries).toEqual(['A', 'B'])
	})
})

type FixedRemainderSelectionResult = ReturnType<typeof useSeriesSelectionWithFixedRemainder>

type AllSelectionResult = ReturnType<typeof useAllSeriesSelection>

function AllSelectionHarness({
	availableSeries,
	selectionKey,
	onRender
}: {
	availableSeries: Array<string>
	selectionKey?: string
	onRender: (result: AllSelectionResult) => void
}) {
	const result = useAllSeriesSelection({ availableSeries, selectionKey })
	onRender(result)
	return null
}

describe('useAllSeriesSelection', () => {
	test('expands all intent, preserves subsets, removes stale values, and keeps explicit empty', async () => {
		let latest: AllSelectionResult
		let observedSeries: Array<Array<string>> = []
		const container = document.createElement('div')
		const root = createRoot(container)
		const render = async (availableSeries: Array<string>) => {
			await act(async () => {
				root.render(
					<AllSelectionHarness
						availableSeries={availableSeries}
						onRender={(result) => {
							latest = result
							observedSeries.push(result.activeSeries)
						}}
					/>
				)
			})
		}

		await render(['A', 'B'])
		expect(latest!.activeSeries).toEqual(['A', 'B'])
		expect(latest!.includeUpstreamOthers).toBe(true)
		act(() => latest!.setSelectedSeries(['A', 'B']))
		await render(['A', 'B', 'C'])
		expect(latest!.activeSeries).toEqual(['A', 'B', 'C'])

		act(() => latest!.setSelectedSeries(['B']))
		await render(['B', 'C', 'D'])
		expect(latest!.activeSeries).toEqual(['B'])
		observedSeries = []
		await render(['C', 'D'])
		expect(observedSeries[0]).toEqual(['C', 'D'])
		expect(latest!.activeSeries).toEqual(['C', 'D'])

		act(() => latest!.setSelectedSeries([]))
		await render(['C', 'D', 'E'])
		expect(latest!.activeSeries).toEqual([])
		expect(latest!.includeUpstreamOthers).toBe(false)
		await act(async () => root.unmount())
	})

	test('does not restore upstream Others when a subset temporarily matches the available peers', async () => {
		let latest: AllSelectionResult
		const container = document.createElement('div')
		const root = createRoot(container)
		const render = async (availableSeries: Array<string>) => {
			await act(async () => {
				root.render(
					<AllSelectionHarness
						availableSeries={availableSeries}
						onRender={(result) => {
							latest = result
						}}
					/>
				)
			})
		}

		await render(['A', 'B', 'C'])
		act(() => latest!.setSelectedSeries(['A', 'B']))
		await render(['A', 'B'])
		expect(latest!.activeSeries).toEqual(['A', 'B'])
		expect(latest!.includeUpstreamOthers).toBe(false)
		await render(['A', 'B', 'C'])
		expect(latest!.activeSeries).toEqual(['A', 'B'])
		await act(async () => root.unmount())
	})
})

function FixedRemainderSelectionHarness({
	availableSeries,
	defaultSeries,
	allowEmptySelection,
	onRender
}: {
	availableSeries: Array<string>
	defaultSeries?: Array<string>
	allowEmptySelection?: boolean
	onRender: (result: FixedRemainderSelectionResult) => void
}) {
	const result = useSeriesSelectionWithFixedRemainder({ availableSeries, defaultSeries, allowEmptySelection })
	onRender(result)
	return null
}

describe('useSeriesSelectionWithFixedRemainder', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: FixedRemainderSelectionResult

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const renderSelection = async (
		availableSeries: Array<string>,
		defaultSeries?: Array<string>,
		allowEmptySelection?: boolean
	) => {
		await act(async () => {
			root.render(
				<FixedRemainderSelectionHarness
					availableSeries={availableSeries}
					defaultSeries={defaultSeries}
					allowEmptySelection={allowEmptySelection}
					onRender={(result) => (latest = result)}
				/>
			)
		})
	}

	test('shows a fixed remainder only for the complete default peer selection', async () => {
		await renderSelection(['A', 'B', 'C', 'Others'], ['A', 'B'], true)
		expect(latest.selectableSeries).toEqual(['A', 'B', 'C'])
		expect(latest.activeSeries).toEqual(['A', 'B'])
		expect(latest.renderedCharts).toEqual(new Set(['A', 'B', 'Others']))

		act(() => latest.setSelectedSeries(['A']))
		expect(latest.renderedCharts).toEqual(new Set(['A']))

		act(() => latest.setSelectedSeries([]))
		expect(latest.activeSeries).toEqual([])
		expect(latest.renderedCharts).toEqual(new Set())

		act(() => latest.setSelectedSeries(['A', 'C']))
		expect(latest.renderedCharts).toEqual(new Set(['A', 'C']))

		act(() => latest.setSelectedSeries(['B', 'A']))
		expect(latest.renderedCharts).toEqual(new Set(['B', 'A', 'Others']))
	})

	test('leaves ordinary peer selections unchanged when no remainder exists', async () => {
		await renderSelection(['A', 'B'])
		expect(latest.selectableSeries).toEqual(['A', 'B'])
		expect(latest.renderedCharts).toEqual(new Set(['A', 'B']))

		act(() => latest.setSelectedSeries(['B']))
		expect(latest.renderedCharts).toEqual(new Set(['B']))

		act(() => latest.setSelectedSeries([]))
		expect(latest.renderedCharts).toEqual(new Set(['A']))
	})

	test('allows an explicitly empty selection when no remainder exists', async () => {
		await renderSelection(['A', 'B'], undefined, true)

		act(() => latest.setSelectedSeries([]))
		expect(latest.activeSeries).toEqual([])
		expect(latest.renderedCharts).toEqual(new Set())
	})

	test('falls back to a valid default when the last selected series becomes stale', async () => {
		await renderSelection(['A', 'B'], undefined, true)
		act(() => latest.setSelectedSeries(['B']))

		await renderSelection(['A', 'C'], undefined, true)
		expect(latest.activeSeries).toEqual(['A'])
		expect(latest.renderedCharts).toEqual(new Set(['A']))
	})
})
