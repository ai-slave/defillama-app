// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChartConfig } from '../chartConfig'
import type { QueryResult } from '../exportResults'
import { ResultsChart } from '../ResultsChart'

// Chart rendering is independent of the stored-configuration migration contract.
vi.mock('../chart', () => ({ ChartRouter: () => null }))
vi.mock('../chart/ChartExportButton', () => ({ ChartExportButton: () => null }))

const result: QueryResult = {
	columns: [
		{ name: 'chain', type: 'VARCHAR' },
		{ name: 'tvl', type: 'DOUBLE' }
	],
	rows: [['Ethereum', 100]]
}
const initialConfig: ChartConfig = {
	chartType: 'bar',
	xCol: 'chain',
	yCols: ['tvl'],
	splitByCol: null,
	stackMode: 'off',
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto'
}
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('initializes a chart configuration and leaves subsequent user edits alone for the same columns', async () => {
	const onChange = vi.fn()
	await act(async () =>
		root.render(<ResultsChart result={result} chartConfig={undefined} onChartConfigChange={onChange} />)
	)
	expect(onChange).toHaveBeenCalledExactlyOnceWith({
		...initialConfig,
		candlestick: undefined,
		bubble: undefined,
		histogram: undefined
	})
	const onEdit = vi.fn()
	await act(async () =>
		root.render(
			<ResultsChart
				result={{ ...result, rows: [['Ethereum', 200]] }}
				chartConfig={{ ...initialConfig, numberFormat: 'currency' }}
				onChartConfigChange={onEdit}
			/>
		)
	)
	expect(onEdit).not.toHaveBeenCalled()
	expect(onChange).toHaveBeenCalledTimes(1)
})

test('migrates changed columns using the latest configuration and callback', async () => {
	const onChange = vi.fn()
	await act(async () =>
		root.render(<ResultsChart result={result} chartConfig={initialConfig} onChartConfigChange={onChange} />)
	)
	const latestCallback = vi.fn()
	const latestConfig: ChartConfig = { ...initialConfig, numberFormat: 'currency', seriesColors: { tvl: '#ff0000' } }
	await act(async () =>
		root.render(<ResultsChart result={result} chartConfig={latestConfig} onChartConfigChange={latestCallback} />)
	)
	const nextResult: QueryResult = {
		columns: [...result.columns, { name: 'fees', type: 'DOUBLE' }],
		rows: [['Ethereum', 100, 5]]
	}
	await act(async () =>
		root.render(<ResultsChart result={nextResult} chartConfig={latestConfig} onChartConfigChange={latestCallback} />)
	)
	expect(latestCallback).toHaveBeenCalledExactlyOnceWith({
		...initialConfig,
		numberFormat: 'currency',
		seriesColors: { tvl: '#ff0000' },
		candlestick: undefined,
		bubble: undefined,
		histogram: undefined
	})
	expect(onChange).toHaveBeenCalledTimes(1)
})
