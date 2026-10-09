// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/ai/chat' }) }))
vi.mock('~/components/ChartExport/ChartPngExportButton', () => ({
	ChartPngExportButton: () => <button type="button" data-testid="chart-export" />
}))
// Drawn output is covered with the real chart in ChartRendererDrawn.test.tsx; these tests exercise the controls.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => <div data-testid="cartesian" /> }))
vi.mock('~/components/ECharts/CandlestickChart', () => ({ default: () => <div data-testid="candlestick" /> }))

import { pickOption } from '~/utils/testing/pickOption'
import { ChartRenderer } from '../ChartRenderer'

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

// The applied chart's view controls as a reader sees them; the style editor's preview renders in a portal.
const viewLabels = (scope: ParentNode) =>
	[...scope.querySelectorAll<HTMLButtonElement>('button[role="combobox"]')].map((button) => button.textContent?.trim())
const grouping = (scope: ParentNode) =>
	scope.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.getAttribute('aria-label')

async function press(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
	})
}

async function chooseView(scope: ParentNode, current: string, option: string) {
	const trigger = [...scope.querySelectorAll<HTMLButtonElement>('button[role="combobox"]')].find(
		(candidate) => candidate.textContent?.trim() === current
	)
	if (!trigger) throw new Error(`Expected ${current} control`)
	await press(trigger)
	const find = () =>
		[...document.querySelectorAll<HTMLElement>('[role="option"]')].find((candidate) =>
			candidate.textContent?.includes(option)
		)
	await waitForUi(() => expect(find()?.textContent).toContain(option))
	await press(find()!)
}

async function chooseGrouping(scope: ParentNode, interval: string) {
	const radio = scope.querySelector<HTMLInputElement>(`input[type="radio"][aria-label="${interval}"]`)
	if (!radio) throw new Error(`Expected ${interval} grouping`)
	await act(async () => radio.click())
}

async function click(scope: ParentNode, selector: string) {
	const button = scope.querySelector<HTMLButtonElement>(selector)
	if (!button) throw new Error(`Expected button ${selector}`)
	await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

// Leaving an edited draft asks first; confirm the discard.
async function discardDraft() {
	const confirmation = await waitForUi(() => {
		const dialog = document.querySelector('[role="alertdialog"]')
		expect(dialog).not.toBeNull()
		return dialog!
	})
	await clickButton(confirmation, 'Discard')
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
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

function aggregationPicker() {
	return document.querySelector<HTMLElement>('[aria-label="Series 1 aggregation"]')
}

// The style editor's title field carries a screen-reader-only label (Field hideLabel).
function chartTitleInput(scope: ParentNode = document) {
	const label = [...scope.querySelectorAll('label')].find((node) => node.textContent === 'Chart title')
	return label ? (document.getElementById(label.htmlFor) as HTMLInputElement) : null
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
	// The editor saves through a mutation.
	const client = new QueryClient()
	const render = (node: ReactNode) => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
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
		// Dialogs render through portals, so an empty container can still have a mounted root.
		await act(async () => root.unmount())
		// oxlint-disable-next-line vitest/no-standalone-expect -- Verify portal cleanup after every test, including roots with empty containers.
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		container.remove()
		vi.unstubAllGlobals()
	})

	test('preserves selection intent while deriving a fallback for missing charts', async () => {
		const chartA = makeChart('a')
		const chartB = makeChart('b')
		const chartC = makeChart('c')
		const getActiveChartId = () => container.querySelector('[data-chart-id]')?.getAttribute('data-chart-id')

		await act(async () => render(<ChartRenderer charts={[chartA, chartB, chartC]} chartData={[]} />))
		const chartCButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'C')
		if (!chartCButton) throw new Error('Expected chart C tab')
		await act(async () => chartCButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

		expect(getActiveChartId()).toBe('c')

		await act(async () => render(<ChartRenderer charts={[chartC, chartA, chartB]} chartData={[]} />))
		expect(getActiveChartId()).toBe('c')

		await act(async () => render(<ChartRenderer charts={[chartA, chartB]} chartData={[]} />))
		expect(getActiveChartId()).toBe('a')

		await act(async () => render(<ChartRenderer charts={[chartB, chartA]} chartData={[]} />))
		expect(getActiveChartId()).toBe('b')

		await act(async () => render(<ChartRenderer charts={[chartB, chartC, chartA]} chartData={[]} />))
		expect(getActiveChartId()).toBe('c')
	})

	test("switching tabs keeps each chart's view controls", async () => {
		const chartA = { ...makeCartesianChart('A'), id: 'a' }
		const chartB = { ...makeCartesianChart('B'), id: 'b' }
		await act(async () => render(<ChartRenderer charts={[chartA, chartB]} chartData={chartData} />))
		await chooseView(container, 'Scale: Linear', 'Log scale')
		expect(viewLabels(container)).toContain('Scale: Log')

		await clickButton(container, 'B')
		expect(viewLabels(container)).toContain('Scale: Linear')
		await clickButton(container, 'A')
		expect(viewLabels(container)).toContain('Scale: Log')
	})

	test('malformed rows stay inside the chart and a data update recovers it', async () => {
		const config = makeCartesianChart()
		await act(async () => render(<ChartRenderer charts={[config]} chartData={[null as never]} />))
		expect(container.textContent).toContain('No data available for chart')
		expect(viewLabels(container)).toEqual([])

		await act(async () => render(<ChartRenderer charts={[config]} chartData={chartData} />))
		expect(container.textContent).not.toContain('No data available for chart')
		expect(viewLabels(container)).toContain('Scale: Linear')
	})

	test('lets promoted date categories resolve aggregation and retain it after save and reset', async () => {
		const config = makeCartesianChart()
		config.axes.x.type = 'category'
		config.series[0].metricClass = 'unknown'
		const rows = chartData.map((row) => ({ ...row, timestamp: new Date(row.timestamp * 1000).toISOString() }))
		await act(async () =>
			render(<ChartRenderer charts={[config]} chartData={rows} onLocalStyleSave={() => undefined} />)
		)
		await click(container, '[aria-label="Edit chart style"]')
		const picker = aggregationPicker()
		if (!picker) throw new Error('Expected aggregation picker for promoted dates')
		expect(picker.textContent).toContain('Choose aggregation')
		await pickOption(picker, 'Sum per period')
		expect(aggregationPicker()?.textContent).toContain('Sum per period')
		await clickButton(document, 'Save')

		await click(container, '[aria-label="Edit chart style"]')
		await clickButton(document, 'Reset')
		expect(aggregationPicker()?.textContent).toContain('Sum per period')
		await clickButton(document, 'Save')
		await chooseGrouping(container, 'Month')
		expect(grouping(container)).toBe('Month')
	})

	test.each(['category', 'time'] as const)('hides aggregation for a non-groupable %s chart', async (axisType) => {
		const config = axisType === 'category' ? makeCategoryChart() : makeCartesianChart()
		if (axisType === 'time') config.displayOptions.supportsGrouping = false
		config.series[0].metricClass = 'unknown'
		await act(async () =>
			render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={() => undefined} />)
		)
		await click(container, '[aria-label="Edit chart style"]')
		expect(chartTitleInput()?.value).toBe(config.title)
		expect(document.querySelector('[aria-label$="aggregation"]')).toBeNull()
	})

	test('keeps editor drafts out of the applied chart and discards them on cancel', async () => {
		const config = makeCartesianChart()
		await act(async () =>
			render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={() => undefined} />)
		)
		await chooseView(container, 'Separate', 'Show stacked')
		expect(viewLabels(container)).toContain('Stacked')

		await click(container, '[aria-label="Edit chart style"]')
		const titleInput = chartTitleInput()
		if (!titleInput) throw new Error('Expected chart title input')
		await setInputValue(titleInput, 'Unsaved Draft')
		await toggleCheckbox(document, 'Stacked')
		expect(viewLabels(container)).toContain('Stacked')

		await clickButton(document, 'Cancel')
		await discardDraft()
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(viewLabels(container)).toContain('Stacked')

		await click(container, '[aria-label="Edit chart style"]')
		expect(chartTitleInput()?.value).toBe(config.title)
	})

	test('keeps reset local until save applies the original defaults', async () => {
		const config = makeCartesianChart()
		config.displayOptions = { ...config.displayOptions!, defaultStacked: true }
		await act(async () =>
			render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={() => undefined} />)
		)
		expect(viewLabels(container)).toContain('Stacked')

		await chooseView(container, 'Stacked', 'Show separate')
		await click(container, '[aria-label="Edit chart style"]')
		const titleInput = chartTitleInput()
		if (!titleInput) throw new Error('Expected chart title input')
		await setInputValue(titleInput, 'Unsaved Draft')
		await clickButton(document, 'Reset')

		expect(viewLabels(container)).toContain('Separate')
		expect(getCheckbox(document, 'Stacked').checked).toBe(true)
		await clickButton(document, 'Save')
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(viewLabels(container)).toContain('Stacked')
	})

	test('keeps saved configuration and view changes when the editor closes', async () => {
		const onLocalStyleSave = vi.fn()
		const config = makeCartesianChart()
		await act(async () =>
			render(<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={onLocalStyleSave} />)
		)

		await chooseGrouping(container, 'Month')
		await click(container, '[aria-label="Edit chart style"]')
		const titleInput = chartTitleInput()
		if (!titleInput) throw new Error('Expected chart title input')
		await setInputValue(titleInput, 'Unsaved Draft')
		await toggleCheckbox(document, 'Stacked')
		await clickButton(document, 'Save')

		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(viewLabels(container)).toContain('Stacked')
		expect(grouping(container)).toBe('Month')
		expect(onLocalStyleSave).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Unsaved Draft',
				displayOptions: expect.objectContaining({ defaultStacked: true })
			})
		)

		await click(container, '[aria-label="Edit chart style"]')
		expect(chartTitleInput()?.value).toBe('Unsaved Draft')
		const reopenedTitleInput = chartTitleInput()
		if (!reopenedTitleInput) throw new Error('Expected chart title input')
		await setInputValue(reopenedTitleInput, 'Discarded Draft')
		await clickButton(document, 'Cancel')
		await discardDraft()
		await click(container, '[aria-label="Edit chart style"]')
		expect(chartTitleInput()?.value).toBe('Unsaved Draft')
		await clickButton(document, 'Cancel')

		const externallyUpdated = {
			...config,
			axes: {
				...config.axes,
				yAxes: [
					{
						id: 'value',
						fields: ['fees', 'revenue'],
						label: 'Revenue (USD)',
						position: 'left',
						valueSymbol: '$'
					}
				]
			}
		} satisfies ChartConfiguration
		await act(async () =>
			render(<ChartRenderer charts={[externallyUpdated]} chartData={chartData} onLocalStyleSave={onLocalStyleSave} />)
		)
		await click(container, '[aria-label="Edit chart style"]')
		expect(chartTitleInput()?.value).toBe(config.title)
	})

	test('Escape closes an untouched style editor at once, with nothing to confirm', async () => {
		await act(async () =>
			render(<ChartRenderer charts={[makeCartesianChart()]} chartData={chartData} onLocalStyleSave={vi.fn()} />)
		)
		const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Edit chart style"]')!
		await act(async () => {
			trigger.focus()
			trigger.click()
		})
		const title = await waitForUi(() => {
			const input = chartTitleInput()
			expect(input).not.toBeNull()
			return input!
		})
		await act(async () => {
			title.focus()
			title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		})
		await waitForUi(() => expect(chartTitleInput()).toBeNull())
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
		expect(document.activeElement).toBe(trigger)
	})

	test('nested style editor asks before Escape discards an edited draft, and returns focus without saving', async () => {
		const onLocalStyleSave = vi.fn()
		const onParentClose = vi.fn()
		await act(async () =>
			render(
				<Ariakit.Dialog open onClose={onParentClose} aria-label="Article editor">
					<ChartRenderer charts={[makeCartesianChart()]} chartData={chartData} onLocalStyleSave={onLocalStyleSave} />
				</Ariakit.Dialog>
			)
		)
		const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Edit chart style"]')!
		await act(async () => {
			trigger.focus()
			trigger.click()
		})
		const styleEditor = () =>
			[...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((dialog) => chartTitleInput(dialog))
		await waitForUi(() => expect(styleEditor()?.contains(document.activeElement)).toBe(true))
		expect(styleEditor()!.querySelector('h2')?.textContent).toBe('Edit chart')
		const title = chartTitleInput(styleEditor()!)!
		await setInputValue(title, 'Discard this title')
		const escape = async () =>
			act(async () => {
				title.focus()
				title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
			})
		const confirmButton = (name: string) =>
			[...(document.querySelector('[role="alertdialog"]')?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
				(button) => button.textContent === name
			)
		await escape()
		await waitForUi(() => expect(confirmButton('Keep editing')).toBeDefined())
		await act(async () => confirmButton('Keep editing')!.click())
		await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
		expect(title.value).toBe('Discard this title')
		await escape()
		await waitForUi(() => expect(confirmButton('Discard')).toBeDefined())
		await act(async () => confirmButton('Discard')!.click())
		await waitForUi(() => expect(document.activeElement).toBe(trigger))
		expect(onParentClose).not.toHaveBeenCalled()
		expect(document.querySelector('[aria-label="Article editor"]')).not.toBeNull()
		expect(styleEditor()).toBeUndefined()
		expect(onLocalStyleSave).not.toHaveBeenCalled()
		await act(async () => trigger.click())
		expect(chartTitleInput()!.value).toBe('Protocol Revenue')
	})
})
