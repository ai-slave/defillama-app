// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StablecoinRuntimeSeries } from '../chartSeries'
import { prepareStablecoinMarketCapSeries, type StablecoinMarketCapSeries } from '../marketCapPresentation'
import { useStablecoinChartSelection, useStablecoinSelectionIntent } from '../useStablecoinChartSelection'

const EMPTY_RUNTIME_SERIES = { selectableSeries: [], renderedSelectableSeries: [], fixedRemainderSeries: [] }
type RuntimeSeries = Pick<
	StablecoinRuntimeSeries,
	'selectableSeries' | 'renderedSelectableSeries' | 'fixedRemainderSeries'
>
type SelectionResult = ReturnType<typeof useStablecoinChartSelection>

function SelectionHarness({
	series,
	runtimeSeries = EMPTY_RUNTIME_SERIES,
	selectionScope = 'global',
	onRender
}: {
	series: StablecoinMarketCapSeries | null
	runtimeSeries?: RuntimeSeries
	selectionScope?: string
	onRender: (result: SelectionResult) => void
}) {
	const { selectionIntent, setSelectionIntent } = useStablecoinSelectionIntent(`${selectionScope}-Token`)
	const selection = useStablecoinChartSelection({
		marketCapSeries: series,
		runtimeSeries,
		selectionIntent,
		setSelectionIntent
	})
	onRender(selection)
	return null
}

describe('useStablecoinChartSelection', () => {
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

	const renderSelection = async (
		series: StablecoinMarketCapSeries | null,
		runtimeSeries = EMPTY_RUNTIME_SERIES,
		selectionScope = 'global'
	) => {
		await act(async () => {
			root.render(
				<SelectionHarness
					series={series}
					runtimeSeries={runtimeSeries}
					selectionScope={selectionScope}
					onRender={(result) => (latest = result)}
				/>
			)
		})
	}

	it('shares explicit snapshot selection without letting the treemap cap truncate ranked views', async () => {
		const rows = Array.from({ length: 22 }, (_, index) => ({ name: `Token ${index}`, value: 22 - index }))
		const prepare = (view: StablecoinMarketCapSeries['kind']) =>
			prepareStablecoinMarketCapSeries({ rows, view, getName: (row) => row.name, getValue: (row) => row.value })

		await renderSelection(prepare('pie'))
		expect(latest.activeSeries).toHaveLength(22)
		await renderSelection(prepare('treemap'))
		expect(latest.activeSeries).toHaveLength(22)
		await renderSelection(prepare('pie'))
		expect(latest.activeSeries).toHaveLength(22)

		act(() => latest.setSelectedSeries(['Token 21']))
		expect(latest.activeSeries).toEqual(['Token 21'])

		await renderSelection(prepare('treemap'))
		expect(latest.activeSeries).toEqual(['Token 21'])
		act(() => latest.setSelectedSeries(['Token 20']))
		expect(latest.activeSeries).toEqual(['Token 20'])

		await renderSelection(prepare('hbar'))
		expect(latest.activeSeries).toEqual(['Token 20'])
		await renderSelection(prepare('treemap'))
		expect(latest.activeSeries).toEqual(['Token 20'])

		act(() => latest.setSelectedSeries([]))
		expect(latest.activeSeries).toEqual([])
		await renderSelection(prepare('pie'))
		expect(latest.activeSeries).toEqual([])
	})

	it('keeps every explicit treemap peer without a presentation cap', async () => {
		const rows = Array.from({ length: 22 }, (_, index) => ({ name: `Token ${index}`, value: 22 - index }))
		const prepare = (view: StablecoinMarketCapSeries['kind']) =>
			prepareStablecoinMarketCapSeries({ rows, view, getName: (row) => row.name, getValue: (row) => row.value })

		await renderSelection(prepare('pie'))
		act(() => latest.setSelectedSeries(Array.from({ length: 22 }, (_, index) => `Token ${21 - index}`)))
		await renderSelection(prepare('treemap'))
		expect(latest.activeSeries).toEqual(Array.from({ length: 22 }, (_, index) => `Token ${index}`))

		act(() => latest.setSelectedSeries(['Token 20', 'Token 21']))
		expect(latest.activeSeries).toEqual(['Token 20', 'Token 21'])
		await renderSelection(prepare('hbar'))
		expect(latest.activeSeries).toEqual(['Token 20', 'Token 21'])
	})

	it('preserves runtime selection and fixed-remainder behavior across snapshot views', async () => {
		const runtimeSeries: RuntimeSeries = {
			selectableSeries: ['A', 'B', 'C'],
			renderedSelectableSeries: ['A', 'B', 'C'],
			fixedRemainderSeries: ['Others']
		}
		const snapshot = prepareStablecoinMarketCapSeries({
			rows: [
				{ name: 'A', value: 3 },
				{ name: 'B', value: 2 }
			],
			view: 'pie',
			getName: (row) => row.name,
			getValue: (row) => row.value
		})

		await renderSelection(null, runtimeSeries)
		expect(latest.renderedCharts).toEqual(new Set(['A', 'B', 'C', 'Others']))
		act(() => latest.setSelectedSeries(['B']))
		expect(latest.renderedCharts).toEqual(new Set(['B']))

		await renderSelection(snapshot, runtimeSeries)
		expect(latest.activeSeries).toEqual(['B'])
		act(() => latest.setSelectedSeries(['A']))
		await renderSelection(null, runtimeSeries)
		expect(latest.activeSeries).toEqual(['A'])
		expect(latest.renderedCharts).toEqual(new Set(['A']))

		act(() => latest.setSelectedSeries(['B']))
		await renderSelection(snapshot, runtimeSeries)
		expect(latest.activeSeries).toEqual(['B'])
		await renderSelection(null, runtimeSeries)
		expect(latest.activeSeries).toEqual(['B'])
		expect(latest.renderedCharts).toEqual(new Set(['B']))

		act(() => latest.setSelectedSeries(['A', 'B', 'C']))
		expect(latest.renderedCharts).toEqual(new Set(['A', 'B', 'C', 'Others']))

		act(() => latest.setSelectedSeries(['B']))
		await renderSelection(snapshot, runtimeSeries)
		await renderSelection(null, {
			selectableSeries: ['D', 'E'],
			renderedSelectableSeries: ['D', 'E'],
			fixedRemainderSeries: ['Others']
		})
		expect(latest.activeSeries).toEqual([])
		expect(latest.renderedCharts).toEqual(new Set())
	})

	it('carries an explicit select-all intent into a larger peer universe', async () => {
		const runtimeSeries: RuntimeSeries = {
			selectableSeries: ['A', 'B'],
			renderedSelectableSeries: ['A', 'B'],
			fixedRemainderSeries: ['Others']
		}
		const snapshot = prepareStablecoinMarketCapSeries({
			rows: [
				{ name: 'A', value: 3 },
				{ name: 'B', value: 2 },
				{ name: 'C', value: 1 }
			],
			view: 'pie',
			getName: (row) => row.name,
			getValue: (row) => row.value
		})

		await renderSelection(null, runtimeSeries)
		act(() => latest.setSelectedSeries(['A', 'B']))
		await renderSelection(snapshot, runtimeSeries)
		expect(latest.activeSeries).toEqual(['A', 'B', 'C'])
	})

	it('establishes the full default when route scope changes and the old selection is stale', async () => {
		const prepare = (names: string[]) =>
			prepareStablecoinMarketCapSeries({
				rows: names.map((name, index) => ({ name, value: names.length - index })),
				view: 'pie',
				getName: (row) => row.name,
				getValue: (row) => row.value
			})

		await renderSelection(prepare(['A', 'B']), EMPTY_RUNTIME_SERIES, 'ethereum')
		act(() => latest.setSelectedSeries(['B']))
		await renderSelection(prepare(['C', 'D', 'E']), EMPTY_RUNTIME_SERIES, 'solana')
		expect(latest.activeSeries).toEqual(['C', 'D', 'E'])
	})

	it('uses the active default without erasing same-scope include intent when peers temporarily disappear', async () => {
		const prepare = (names: string[]) =>
			prepareStablecoinMarketCapSeries({
				rows: names.map((name, index) => ({ name, value: names.length - index })),
				view: 'pie',
				getName: (row) => row.name,
				getValue: (row) => row.value
			})

		await renderSelection(prepare(['A', 'B']))
		act(() => latest.setSelectedSeries(['B']))
		await renderSelection(prepare(['C', 'D', 'E']))
		expect(latest.activeSeries).toEqual(['C', 'D', 'E'])
		await renderSelection(prepare(['B', 'C', 'D', 'E']))
		expect(latest.activeSeries).toEqual(['B'])

		act(() => latest.setSelectedSeries([]))
		await renderSelection(prepare(['F', 'G']))
		expect(latest.activeSeries).toEqual([])
	})

	it('preserves exclusions across views with different peer inventories', async () => {
		const prepare = (names: string[]) =>
			prepareStablecoinMarketCapSeries({
				rows: names.map((name, index) => ({ name, value: names.length - index })),
				view: 'pie',
				getName: (row) => row.name,
				getValue: (row) => row.value
			})

		await renderSelection(prepare(['A', 'B', 'C', 'D']))
		act(() => latest.setSelectedSeries(['A', 'B', 'C']))
		await renderSelection(prepare(['A', 'B']))
		expect(latest.activeSeries).toEqual(['A', 'B'])
		await renderSelection(prepare(['A', 'B', 'C', 'D']))
		expect(latest.activeSeries).toEqual(['A', 'B', 'C'])
	})
})
