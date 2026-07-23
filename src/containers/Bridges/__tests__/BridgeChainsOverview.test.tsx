// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BridgeChainsOverview } from '../BridgeChainsOverview'

const mocks = vi.hoisted(() => ({
	selectedCharts: vi.fn<(values: string[]) => void>()
}))

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: ({ charts }: { charts: Array<{ name: string }> }) => {
		mocks.selectedCharts(charts.map((chart) => chart.name))
		return <div data-testid="bridge-chart" />
	}
}))

vi.mock('~/components/Select/SelectWithCombobox', () => ({
	SelectWithCombobox: ({
		allValues,
		selectedValues,
		setSelectedValues
	}: {
		allValues: string[]
		selectedValues: string[]
		setSelectedValues: (values: string[]) => void
	}) => (
		<button type="button" onClick={() => setSelectedValues(selectedValues.filter((name) => name !== allValues[0]))}>
			Remove chain 1
		</button>
	)
}))

vi.mock('~/components/ChartExport/ChartExportButtons', () => ({
	ChartExportButtons: () => null
}))

vi.mock('~/containers/Bridges/BridgeChainsTable', () => ({
	BridgeChainsTable: () => null
}))

vi.mock('~/hooks/useGetChartInstance', () => ({
	useGetChartInstance: () => ({ chartInstance: null, handleChartReady: vi.fn() })
}))

vi.mock('~/ui/ChartPanel', () => ({
	ChartPanel: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
	ChartPanelToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	ChartPanelBodyFallback: () => <div>Loading</div>
}))

describe('BridgeChainsOverview selection wiring', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		mocks.selectedCharts.mockClear()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(() => {
		act(() => root.unmount())
		container.remove()
	})

	it('shows all selection intent as top 30 plus Others and removes Others at 30 selected chains', async () => {
		const allChains = Array.from({ length: 31 }, (_, index) => `Chain ${index + 1}`)
		const charts = allChains.map((name) => ({
			type: 'line' as const,
			name,
			encode: { x: 'timestamp', y: name }
		}))

		await act(async () => {
			root.render(
				<BridgeChainsOverview
					allChains={allChains}
					tableData={[]}
					chart={{ dataset: { dimensions: ['timestamp', ...allChains], source: [[1]] }, charts }}
				/>
			)
		})

		expect(mocks.selectedCharts).toHaveBeenLastCalledWith([...allChains.slice(0, 30), 'Others'])

		await act(async () => {
			container.querySelector('button')?.click()
		})

		const finalSelection = mocks.selectedCharts.mock.calls.at(-1)?.[0]
		expect(finalSelection).toHaveLength(30)
		expect(finalSelection).toContain('Chain 31')
		expect(finalSelection).not.toContain('Chain 1')
		expect(finalSelection).not.toContain('Others')
	})
})
