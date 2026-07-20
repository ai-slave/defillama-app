// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import { adaptChartData } from '~/containers/LlamaAI/utils/chartAdapter'
import { ChartDataTransformer } from '~/containers/LlamaAI/utils/chartDataTransformer'

interface TestChartControlsProps {
	children?: ReactNode
	onStackedChange: (value: boolean) => void
	onPercentageChange: (value: boolean) => void
	onCumulativeChange: (value: boolean) => void
	onGroupingChange: (value: 'month') => void
	onLabelsChange: (value: boolean) => void
	onLogScaleChange: (value: boolean) => void
}

vi.mock('~/auth', () => ({ useAuthContext: () => ({}) }))
vi.mock('~/components/ChartExport/ChartPngExportButton', () => ({ ChartPngExportButton: () => null }))
vi.mock('~/components/ECharts/MultiSeriesChart2', () => ({ default: () => <div data-testid="cartesian" /> }))
vi.mock('~/containers/LlamaAI/components/AddToArticle/ArticleExportContext', () => ({
	useArticleExport: () => null
}))
vi.mock('~/containers/LlamaAI/components/charts/ChartControls', () => ({
	ChartControls: ({
		children,
		onStackedChange,
		onPercentageChange,
		onCumulativeChange,
		onGroupingChange,
		onLabelsChange,
		onLogScaleChange
	}: TestChartControlsProps) => (
		<div>
			<button data-action="grouping" onClick={() => onGroupingChange('month')} />
			<button data-action="percentage" onClick={() => onPercentageChange(true)} />
			<button data-action="cumulative" onClick={() => onCumulativeChange(true)} />
			<button data-action="stacking" onClick={() => onStackedChange(true)} />
			<button data-action="log" onClick={() => onLogScaleChange(true)} />
			<button data-action="labels" onClick={() => onLabelsChange(true)} />
			{children}
		</div>
	)
}))
vi.mock('~/containers/LlamaAI/utils/chartAdapter', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/LlamaAI/utils/chartAdapter')>()
	return { ...actual, adaptChartData: vi.fn(actual.adaptChartData) }
})
vi.mock('~/hooks/useGetChartInstance', () => ({
	useGetChartInstance: () => ({ chartInstance: () => null, handleChartReady: () => undefined })
}))
vi.mock('~/components/ECharts/CandlestickChart', () => ({ default: () => <div data-testid="candlestick" /> }))

import { ChartRenderer } from './ChartRenderer'

function makeChart(id: string): ChartConfiguration {
	return {
		id,
		type: 'candlestick',
		title: id.toUpperCase(),
		description: '',
		axes: {
			x: { field: 'timestamp', label: 'Date', type: 'time' },
			yAxes: [{ id: 'price', fields: ['price'], label: 'Price', position: 'left' }]
		},
		series: [
			{
				name: 'Price',
				type: 'candlestick',
				yAxisId: 'price',
				metricClass: 'stock',
				dataMapping: { xField: 'timestamp', yField: 'price' },
				styling: {}
			}
		],
		dataTransformation: { timeField: 'timestamp', metrics: ['open', 'high', 'low', 'close'] }
	}
}

function makeCartesianChart(title = 'Protocol Revenue'): ChartConfiguration {
	return {
		id: 'revenue',
		type: 'combo',
		title,
		description: '',
		axes: {
			x: { field: 'timestamp', label: 'Date', type: 'time' },
			yAxes: [{ id: 'value', fields: ['fees', 'revenue'], label: 'USD', position: 'left', valueSymbol: '$' }]
		},
		series: [
			{
				name: 'Fees',
				type: 'bar',
				yAxisId: 'value',
				metricClass: 'flow',
				dataMapping: { xField: 'timestamp', yField: 'fees' },
				styling: {}
			},
			{
				name: 'Revenue',
				type: 'bar',
				yAxisId: 'value',
				metricClass: 'flow',
				dataMapping: { xField: 'timestamp', yField: 'revenue' },
				styling: {}
			}
		],
		dataTransformation: { timeField: 'timestamp', metrics: ['fees', 'revenue'] },
		displayOptions: {
			canStack: true,
			canShowPercentage: true,
			canShowCumulative: true,
			supportsGrouping: true
		}
	}
}

function makeCategoryChart(): ChartConfiguration {
	return {
		...makeCartesianChart('Protocol Revenue by Chain'),
		type: 'bar',
		axes: {
			x: {
				field: 'chain',
				label: 'Chain',
				type: 'category',
				entityType: 'chain',
				logoCategories: ['Ethereum', 'Solana']
			},
			yAxes: [{ id: 'value', fields: ['revenue'], label: 'USD', position: 'left', valueSymbol: '$' }]
		},
		series: [
			{
				name: 'Revenue',
				type: 'bar',
				yAxisId: 'value',
				metricClass: 'flow',
				dataMapping: { xField: 'chain', yField: 'revenue' },
				styling: {}
			}
		],
		dataTransformation: { timeField: 'chain', metrics: ['revenue'] }
	}
}

const chartData = [
	{ timestamp: 1_767_225_600, chain: 'Ethereum', fees: 10, revenue: 4 },
	{ timestamp: 1_767_312_000, chain: 'Solana', fees: 12, revenue: 5 }
]

describe('ChartRenderer', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.mocked(adaptChartData).mockClear()
		vi.stubGlobal(
			'ResizeObserver',
			class {
				disconnect() {}
				observe() {}
			}
		)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('keeps the selected chart active across reorder and falls back after removal', async () => {
		const chartA = makeChart('a')
		const chartB = makeChart('b')
		const chartC = makeChart('c')
		const getActiveChartId = () => container.querySelector('[data-chart-id]')?.getAttribute('data-chart-id')

		await act(async () => root.render(<ChartRenderer charts={[chartA, chartB, chartC]} chartData={[]} />))
		const chartCButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'C')
		if (!chartCButton) throw new Error('Expected chart C tab')
		await act(async () => chartCButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

		expect(getActiveChartId()).toBe('c')

		await act(async () => root.render(<ChartRenderer charts={[chartC, chartA, chartB]} chartData={[]} />))
		expect(getActiveChartId()).toBe('c')

		await act(async () => root.render(<ChartRenderer charts={[chartA, chartB]} chartData={[]} />))
		expect(getActiveChartId()).toBe('a')

		await act(async () => root.render(<ChartRenderer charts={[chartB, chartA]} chartData={[]} />))
		expect(getActiveChartId()).toBe('a')
	})

	it('reuses base adaptation for view changes and rebuilds it for config and data changes', async () => {
		const transformSpy = vi.spyOn(ChartDataTransformer, 'applyViewState')
		const config = makeCartesianChart()
		await act(async () => root.render(<ChartRenderer charts={[config]} chartData={chartData} />))

		expect(adaptChartData).toHaveBeenCalledTimes(1)
		expect(transformSpy).toHaveBeenCalledTimes(1)

		for (const [index, action] of ['grouping', 'percentage', 'cumulative', 'stacking', 'log'].entries()) {
			const button = container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
			if (!button) throw new Error(`Expected ${action} action`)
			await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))

			expect(adaptChartData).toHaveBeenCalledTimes(1)
			expect(transformSpy).toHaveBeenCalledTimes(index + 2)
		}

		await act(async () => root.render(<ChartRenderer charts={[makeCategoryChart()]} chartData={chartData} />))
		expect(adaptChartData).toHaveBeenCalledTimes(2)

		const labelsButton = container.querySelector<HTMLButtonElement>('[data-action="labels"]')
		if (!labelsButton) throw new Error('Expected labels action')
		await act(async () => labelsButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(adaptChartData).toHaveBeenCalledTimes(2)
		expect(transformSpy).toHaveBeenLastCalledWith(
			expect.anything(),
			expect.objectContaining({ showLabels: true }),
			expect.objectContaining({ allowLabels: true })
		)

		const updatedData = [chartData[0], { ...chartData[1], revenue: 8 }]
		await act(async () => root.render(<ChartRenderer charts={[makeCategoryChart()]} chartData={updatedData} />))
		expect(adaptChartData).toHaveBeenCalledTimes(3)
		transformSpy.mockRestore()
	})

	it('keeps adaptation failures inside the chart and retries after base data changes', async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
		vi.mocked(adaptChartData).mockImplementationOnce(() => {
			throw new Error('Adapter failed')
		})

		const config = makeCartesianChart()
		await act(async () => root.render(<ChartRenderer charts={[config]} chartData={chartData} />))
		expect(container.textContent).toContain('Adapter failed')
		expect(adaptChartData).toHaveBeenCalledTimes(1)

		const updatedData = [chartData[0], { ...chartData[1], revenue: 8 }]
		await act(async () => root.render(<ChartRenderer charts={[config]} chartData={updatedData} />))
		expect(container.querySelector('[data-testid="cartesian"]')).not.toBeNull()
		expect(adaptChartData).toHaveBeenCalledTimes(2)
		consoleErrorSpy.mockRestore()
	})
})
