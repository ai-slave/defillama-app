// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import { adaptChartData } from '~/containers/LlamaAI/utils/chartAdapter'
import type { ChartViewState } from '~/containers/LlamaAI/utils/chartCapabilities'
import { ChartDataTransformer } from '~/containers/LlamaAI/utils/chartDataTransformer'

interface TestChartControlsProps {
	children?: ReactNode
	controls: { state: ChartViewState }
	onStackedChange: (value: boolean) => void
	onPercentageChange: (value: boolean) => void
	onCumulativeChange: (value: boolean) => void
	onGroupingChange: (value: 'month') => void
	onLabelsChange: (value: boolean) => void
	onLogScaleChange: (value: boolean) => void
}

vi.mock('~/auth', () => ({ useAuthContext: () => ({}) }))
vi.mock('~/components/ChartExport/ChartPngExportButton', () => ({
	ChartPngExportButton: () => <button type="button" data-testid="chart-export" />
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: ({ charts, hallmarks }: { charts?: Array<{ type: string }>; hallmarks?: [number, string][] }) => (
		<div
			data-testid="cartesian"
			data-series-types={charts?.map((chart) => chart.type).join(',')}
			data-hallmarks={JSON.stringify(hallmarks ?? [])}
		/>
	)
}))
vi.mock('~/containers/LlamaAI/components/AddToArticle/useArticleExport', () => ({
	useArticleExport: () => null
}))
vi.mock('~/containers/LlamaAI/components/charts/ChartControls', () => ({
	ChartControls: ({
		children,
		controls,
		onStackedChange,
		onPercentageChange,
		onCumulativeChange,
		onGroupingChange,
		onLabelsChange,
		onLogScaleChange
	}: TestChartControlsProps) => (
		<div
			data-testid="chart-controls"
			data-stacked={controls.state.stacked}
			data-percentage={controls.state.percentage}
			data-log={controls.state.logScale}
			data-labels={controls.state.showLabels}
			data-grouping={controls.state.grouping}
		>
			<button data-action="grouping" onClick={() => onGroupingChange('month')} />
			<button data-action="percentage" onClick={() => onPercentageChange(!controls.state.percentage)} />
			<button data-action="cumulative" onClick={() => onCumulativeChange(true)} />
			<button data-action="stacking" onClick={() => onStackedChange(!controls.state.stacked)} />
			<button data-action="log" onClick={() => onLogScaleChange(!controls.state.logScale)} />
			<button data-action="labels" onClick={() => onLabelsChange(!controls.state.showLabels)} />
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

async function click(scope: ParentNode, selector: string) {
	const button = scope.querySelector<HTMLButtonElement>(selector)
	if (!button) throw new Error(`Expected button ${selector}`)
	await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

async function clickButton(scope: ParentNode, text: string) {
	const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
		(candidate) => candidate.textContent?.trim() === text
	)
	if (!button) throw new Error(`Expected ${text} button`)
	await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

async function setInputValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
	if (!setter) throw new Error('Expected native input value setter')
	await act(async () => {
		setter.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function setSelectValue(select: HTMLSelectElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
	if (!setter) throw new Error('Expected native select value setter')
	await act(async () => {
		setter.call(select, value)
		select.dispatchEvent(new Event('change', { bubbles: true }))
	})
}

function getCheckbox(scope: ParentNode, label: string) {
	const input = [...scope.querySelectorAll<HTMLLabelElement>('label')]
		.find((candidate) => candidate.textContent?.trim() === label)
		?.querySelector<HTMLInputElement>('input[type="checkbox"]')
	if (!input) throw new Error(`Expected ${label} checkbox`)
	return input
}

async function toggleCheckbox(scope: ParentNode, label: string) {
	const input = getCheckbox(scope, label)
	await act(async () => input.click())
}

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

	it('constructs only the active tab while retaining inactive chart controls', async () => {
		const chartA = { ...makeCartesianChart('A'), id: 'a' }
		const chartB = { ...makeCartesianChart('B'), id: 'b' }
		await act(async () => root.render(<ChartRenderer charts={[chartA, chartB]} chartData={chartData} />))

		expect(adaptChartData).toHaveBeenCalledTimes(1)
		await click(container, '[data-action="log"]')
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-log')).toBe('true')

		const chartBButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'B')
		if (!chartBButton) throw new Error('Expected chart B tab')
		await act(async () => chartBButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(adaptChartData).toHaveBeenCalledTimes(2)

		const chartAButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'A')
		if (!chartAButton) throw new Error('Expected chart A tab')
		await act(async () => chartAButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(adaptChartData).toHaveBeenCalledTimes(3)
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-log')).toBe('true')
	})

	it('keeps persisted keyed chart data isolated while activating tabs', async () => {
		const chartA = { ...makeCartesianChart('A'), id: 'a', datasetName: 'dataset-a' }
		const chartB = { ...makeCartesianChart('B'), id: 'b', datasetName: 'dataset-b' }
		const dataA = [chartData[0]]
		const dataB = [chartData[1]]
		await act(async () =>
			root.render(<ChartRenderer charts={[chartA, chartB]} chartData={{ 'dataset-a': dataA, 'dataset-b': dataB }} />)
		)

		expect(adaptChartData).toHaveBeenLastCalledWith(chartA, dataA)
		const chartBButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'B')
		if (!chartBButton) throw new Error('Expected chart B tab')
		await act(async () => chartBButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(adaptChartData).toHaveBeenLastCalledWith(chartB, dataB)
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

	it('previews a discrete series option without changing the applied chart', async () => {
		const config = makeCartesianChart()
		await act(async () =>
			root.render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={() => undefined} />)
		)
		await click(container, '[title="Edit chart style"]')
		const chartsBefore = document.querySelectorAll('[data-testid="cartesian"]')
		expect(chartsBefore).toHaveLength(2)
		expect(chartsBefore[0]?.getAttribute('data-series-types')).toBe('bar,bar')
		expect(chartsBefore[1]?.getAttribute('data-series-types')).toBe('bar,bar')

		const seriesType = document.querySelector<HTMLSelectElement>('[aria-label="Series 2 type"]')
		if (!seriesType) throw new Error('Expected second series type select')
		await setSelectValue(seriesType, 'area')
		const chartsAfter = document.querySelectorAll('[data-testid="cartesian"]')
		expect(chartsAfter[0]?.getAttribute('data-series-types')).toBe('bar,bar')
		expect(chartsAfter[1]?.getAttribute('data-series-types')).toBe('bar,line')
	})

	it('shows the first draft annotation while keeping the applied chart unchanged', async () => {
		const config = makeCartesianChart()
		await act(async () =>
			root.render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={() => undefined} />)
		)
		await click(container, '[title="Edit chart style"]')
		await clickButton(document, '+ Add annotation')
		const annotationLabel = document.querySelector<HTMLInputElement>('[aria-label="Annotation 1 label"]')
		if (!annotationLabel) throw new Error('Expected annotation label input')
		await setInputValue(annotationLabel, 'Preview note')
		await act(async () => annotationLabel.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		const charts = document.querySelectorAll('[data-testid="cartesian"]')
		expect(charts[0]?.getAttribute('data-hallmarks')).toBe('[]')
		const previewHallmarks = JSON.parse(charts[1]?.getAttribute('data-hallmarks') ?? '[]')
		expect(previewHallmarks).toEqual([[expect.any(Number), 'Preview note']])
	})

	it('keeps editor drafts out of the applied chart and discards them on cancel', async () => {
		const config = makeCartesianChart()
		await act(async () =>
			root.render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={() => undefined} />)
		)
		await click(container, '[data-action="stacking"]')
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-stacked')).toBe('true')

		await click(container, '[title="Edit chart style"]')
		const titleInput = document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')
		if (!titleInput) throw new Error('Expected chart title input')
		await setInputValue(titleInput, 'Unsaved Draft')
		await toggleCheckbox(document, 'Stacked')
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-stacked')).toBe('true')

		await clickButton(document, 'Cancel')
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-stacked')).toBe('true')

		await click(container, '[title="Edit chart style"]')
		expect(document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')?.value).toBe(config.title)
	})

	it('keeps reset local until save applies the original defaults', async () => {
		const config = makeCartesianChart()
		config.displayOptions = { ...config.displayOptions!, defaultStacked: true }
		await act(async () =>
			root.render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={() => undefined} />)
		)
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-stacked')).toBe('true')

		await click(container, '[data-action="stacking"]')
		await click(container, '[title="Edit chart style"]')
		const titleInput = document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')
		if (!titleInput) throw new Error('Expected chart title input')
		await setInputValue(titleInput, 'Unsaved Draft')
		await clickButton(document, 'Reset')

		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-stacked')).toBe('false')
		expect(getCheckbox(document, 'Stacked').checked).toBe(true)
		await clickButton(document, 'Save')
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-stacked')).toBe('true')
	})

	it('keeps saved configuration and view changes when the editor closes', async () => {
		const onLocalStyleSave = vi.fn()
		const config = makeCartesianChart()
		await act(async () =>
			root.render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={onLocalStyleSave} />)
		)

		await click(container, '[data-action="grouping"]')
		await click(container, '[title="Edit chart style"]')
		const titleInput = document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')
		if (!titleInput) throw new Error('Expected chart title input')
		await setInputValue(titleInput, 'Unsaved Draft')
		await toggleCheckbox(document, 'Stacked')
		await clickButton(document, 'Save')

		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-stacked')).toBe('true')
		expect(container.querySelector('[data-testid="chart-controls"]')?.getAttribute('data-grouping')).toBe('month')
		expect(onLocalStyleSave).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Unsaved Draft',
				displayOptions: expect.objectContaining({ defaultStacked: true })
			})
		)

		await click(container, '[title="Edit chart style"]')
		expect(document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')?.value).toBe('Unsaved Draft')
		const reopenedTitleInput = document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')
		if (!reopenedTitleInput) throw new Error('Expected chart title input')
		await setInputValue(reopenedTitleInput, 'Discarded Draft')
		await clickButton(document, 'Cancel')
		await click(container, '[title="Edit chart style"]')
		expect(document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')?.value).toBe('Unsaved Draft')
		await clickButton(document, 'Cancel')

		const externallyUpdated = {
			...config,
			axes: {
				...config.axes,
				yAxes: [{ ...config.axes.yAxes[0], label: 'Revenue (USD)' }]
			}
		}
		await act(async () =>
			root.render(
				<ChartRenderer charts={[externallyUpdated]} chartData={chartData} onLocalStyleSave={onLocalStyleSave} />
			)
		)
		await click(container, '[title="Edit chart style"]')
		expect(document.querySelector<HTMLInputElement>('[aria-label="Chart title"]')?.value).toBe(config.title)
	})

	it('rebuilds adaptation for a nested configuration change', async () => {
		const config = makeCartesianChart()
		await act(async () => root.render(<ChartRenderer charts={[config]} chartData={chartData} />))
		expect(adaptChartData).toHaveBeenCalledTimes(1)

		const updated = {
			...config,
			displayOptions: { ...config.displayOptions!, defaultStacked: true }
		}
		await act(async () => root.render(<ChartRenderer charts={[updated]} chartData={chartData} />))
		expect(adaptChartData).toHaveBeenCalledTimes(2)
	})
})
