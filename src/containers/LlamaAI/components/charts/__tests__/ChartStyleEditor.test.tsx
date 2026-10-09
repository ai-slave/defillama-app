// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ChartConfiguration, ChartStylePatch } from '~/containers/LlamaAI/chartTypes'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ChartStyleEditor } from '../ChartStyleEditor'

// The series pickers are Selects, which read the router.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/ai/chat' }) }))

const revenueSeries: ChartConfiguration['series'][number] = {
	name: 'Revenue',
	type: 'line',
	yAxisId: 'value',
	metricClass: 'flow',
	dataMapping: { xField: 'timestamp', yField: 'value' },
	styling: {}
}

const config = {
	id: 'chart-1',
	type: 'line',
	title: 'Revenue',
	description: '',
	axes: {
		x: { field: 'timestamp', label: 'Date', type: 'time' },
		yAxes: [{ id: 'value', fields: ['value'], label: 'USD', position: 'left' }]
	},
	hallmarks: [[1_768_867_200, 'Existing note']],
	series: [revenueSeries],
	dataTransformation: { timeField: 'timestamp', metrics: ['value'] }
} satisfies ChartConfiguration

const caps = {
	showGrouping: true,
	showStack: false,
	showPercentage: false,
	showLogScale: false,
	showLabels: false,
	showHallmarks: true
}

const view = { logScale: false, stacked: false, showLabels: false, percentage: false }
const resetView = { logScale: false, stacked: true, showLabels: false, percentage: false }
const PREVIEW_DELAY = 350
const noop = () => {}
async function pointerClick(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
	})
}
/** Opens a Select and picks the option with this name. */
async function pick(trigger: HTMLElement, name: string) {
	await pointerClick(trigger)
	const option = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent === name)
		expect(found).toBeDefined()
		return found!
	})
	await pointerClick(option)
}

// The pane's fields carry a screen-reader-only label (Field hideLabel).
function labelled(name: string) {
	const label = [...document.querySelectorAll('label')].find((node) => node.textContent === name)
	return label ? (document.getElementById(label.htmlFor) as HTMLInputElement) : null
}

function EditorHarness({
	onSave,
	onPreview,
	editorConfig = config,
	originalConfig,
	onCancel = noop,
	previewPane
}: {
	onSave: (config: ChartConfiguration, patch: ChartStylePatch) => Promise<void>
	onCancel?: () => void
	previewPane?: ReactNode
	onPreview?: (config: ChartConfiguration) => void
	editorConfig?: ChartConfiguration
	originalConfig?: ChartConfiguration
}) {
	const [saved, setSaved] = useState<ChartConfiguration>(editorConfig)
	const [preview, setPreview] = useState<ChartConfiguration>(editorConfig)
	const handleSave = async (next: ChartConfiguration, patch: ChartStylePatch) => {
		await onSave(next, patch)
		setSaved(next)
	}
	const handlePreview = (next: ChartConfiguration) => {
		setPreview(next)
		onPreview?.(next)
	}

	return (
		<>
			<span data-testid="saved-annotation">{saved.hallmarks?.[0]?.[1]}</span>
			<span data-testid="preview-annotation">{preview.hallmarks?.[0]?.[1]}</span>
			<span data-testid="preview-annotation-count">{preview.hallmarks?.length ?? 0}</span>
			<span data-testid="preview-type">{preview.type}</span>
			<span data-testid="preview-series-names">{preview.series.map((series) => series.name).join('|')}</span>
			<ChartStyleEditor
				config={editorConfig}
				original={originalConfig ?? editorConfig}
				caps={caps}
				view={view}
				resetView={resetView}
				onPreview={handlePreview}
				onSave={handleSave}
				onCancel={onCancel}
				preview={previewPane}
			/>
		</>
	)
}

describe('ChartStyleEditor', () => {
	let container: HTMLDivElement
	let root: Root
	// The editor saves through a mutation.
	const client = new QueryClient()
	const render = (node: ReactNode) => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	test('debounces annotation preview while keeping the saved chart unchanged', async () => {
		vi.useFakeTimers()
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		const onPreview = vi.fn()
		await act(async () => render(<EditorHarness onSave={onSave} onPreview={onPreview} />))

		const annotationInput = document.querySelector<HTMLInputElement>('[aria-label="Annotation 1 label"]')
		if (!annotationInput) throw new Error('Expected annotation label input')
		const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
		if (!setInputValue) throw new Error('Expected native input value setter')
		for (const value of ['h', 'he', 'hel', 'hell', 'hello']) {
			await act(async () => {
				setInputValue.call(annotationInput, value)
				annotationInput.dispatchEvent(new Event('input', { bubbles: true }))
			})
		}

		expect(document.querySelector('[data-testid="saved-annotation"]')?.textContent).toBe('Existing note')
		expect(document.querySelector('[data-testid="preview-annotation"]')?.textContent).toBe('Existing note')
		expect(onPreview).not.toHaveBeenCalled()
		expect(onSave).not.toHaveBeenCalled()

		await act(async () => vi.advanceTimersByTime(349))
		expect(onPreview).not.toHaveBeenCalled()
		await act(async () => vi.advanceTimersByTime(1))
		expect(onPreview).toHaveBeenCalledOnce()
		expect(document.querySelector('[data-testid="preview-annotation"]')?.textContent).toBe('hello')
		expect(document.querySelector('[data-testid="saved-annotation"]')?.textContent).toBe('Existing note')

		const saveButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'Save'
		)
		if (!saveButton) throw new Error('Expected save button')
		await act(async () => saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

		expect(onSave).toHaveBeenCalledOnce()
		expect(onSave.mock.calls).toEqual([
			[
				expect.objectContaining({ hallmarks: [[expect.any(Number), 'hello']] }),
				expect.objectContaining({ hallmarks: [[expect.any(Number), 'hello']] })
			]
		])
		expect(document.querySelector('[data-testid="saved-annotation"]')?.textContent).toBe('hello')
	})

	test('flushes a pending text preview when the input loses focus', async () => {
		vi.useFakeTimers()
		const onPreview = vi.fn()
		await act(async () => render(<EditorHarness onSave={vi.fn(async () => undefined)} onPreview={onPreview} />))
		const annotationInput = document.querySelector<HTMLInputElement>('[aria-label="Annotation 1 label"]')
		if (!annotationInput) throw new Error('Expected annotation label input')
		const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
		if (!setInputValue) throw new Error('Expected native input value setter')

		await act(async () => {
			setInputValue.call(annotationInput, 'Updated note')
			annotationInput.dispatchEvent(new Event('input', { bubbles: true }))
			annotationInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
		})

		expect(onPreview).toHaveBeenCalledOnce()
		expect(document.querySelector('[data-testid="preview-annotation"]')?.textContent).toBe('Updated note')
	})

	test('previews discrete chart options and added annotations immediately', async () => {
		const onPreview = vi.fn()
		await act(async () => render(<EditorHarness onSave={vi.fn(async () => undefined)} onPreview={onPreview} />))
		const barButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'bar'
		)
		const addAnnotationButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === '+ Add annotation'
		)
		if (!barButton || !addAnnotationButton) throw new Error('Expected discrete editor actions')

		await act(async () => barButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(document.querySelector('[data-testid="preview-type"]')?.textContent).toBe('bar')
		await act(async () => addAnnotationButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(document.querySelector('[data-testid="preview-annotation-count"]')?.textContent).toBe('2')
		expect(onPreview).toHaveBeenCalledTimes(2)
	})

	// The backend ships metricClass 'unknown' when the model did not declare how a series aggregates.
	// The owner resolves it here, once per y-field, and the choice is what update-chart-style persists.
	test('lets the owner set the aggregation of unknown series, per y-field, and saves it', async () => {
		const unknown = (name: string, value: string): ChartConfiguration['series'][number] => ({
			...revenueSeries,
			name,
			type: 'bar',
			metricClass: 'unknown',
			dataMapping: { xField: 'timestamp', yField: 'value', entityFilter: { field: 'protocol', value } }
		})
		const editorConfig = {
			...config,
			type: 'bar',
			series: [
				unknown('Aave', 'aave'),
				unknown('Lido', 'lido'),
				{ ...revenueSeries, name: 'TVL', metricClass: 'stock', dataMapping: { xField: 'timestamp', yField: 'tvl' } }
			]
		} satisfies ChartConfiguration
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => render(<EditorHarness editorConfig={editorConfig} onSave={onSave} />))

		const pickers = () => [...document.querySelectorAll<HTMLButtonElement>('button[aria-label$="aggregation"]')]
		expect(pickers().map((picker) => picker.textContent)).toEqual([
			'Choose aggregation',
			'Choose aggregation',
			'End-of-period value'
		])

		await pick(pickers()[0], 'Sum per period')
		expect(pickers().map((picker) => picker.textContent)).toEqual([
			'Sum per period',
			'Sum per period',
			'End-of-period value'
		])

		const saveButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'Save'
		)
		if (!saveButton) throw new Error('Expected save button')
		await act(async () => saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

		expect(onSave).toHaveBeenCalledOnce()
		const [savedConfig, patch] = onSave.mock.calls[0]
		expect(savedConfig.series.map((series) => series.metricClass)).toEqual(['flow', 'flow', 'stock'])
		expect(patch.series?.map((series) => series.metricClass)).toEqual(['flow', 'flow', 'stock'])
	})

	test('keeps the last valid preview and says so under a series name that repeats another', async () => {
		vi.useFakeTimers()
		const editorConfig = {
			...config,
			type: 'combo',
			series: [
				revenueSeries,
				{
					...revenueSeries,
					name: 'Fees',
					type: 'bar',
					dataMapping: { xField: 'timestamp', yField: 'fees' }
				}
			]
		} satisfies ChartConfiguration
		const onPreview = vi.fn()
		const onSave = vi.fn(async () => undefined)
		await act(async () => render(<EditorHarness editorConfig={editorConfig} onSave={onSave} onPreview={onPreview} />))

		const secondName = labelled('Series 2 name')
		if (!secondName) throw new Error('Expected second series name input')
		const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
		if (!setInputValue) throw new Error('Expected native input value setter')

		await act(async () => {
			setInputValue.call(secondName, 'Revenue')
			secondName.dispatchEvent(new Event('input', { bubbles: true }))
			vi.advanceTimersByTime(PREVIEW_DELAY)
		})

		expect(fieldErrorOf(secondName)).toBe('Enter a name no other series uses.')
		expect(onPreview).not.toHaveBeenCalled()
		expect(document.querySelector('[data-testid="preview-series-names"]')?.textContent).toBe('Revenue|Fees')

		await act(async () => {
			setInputValue.call(secondName, 'Net Revenue')
			secondName.dispatchEvent(new Event('input', { bubbles: true }))
			vi.advanceTimersByTime(PREVIEW_DELAY)
		})

		expect(secondName.getAttribute('aria-invalid')).toBeNull()
		expect(onPreview).toHaveBeenCalledOnce()
		expect(document.querySelector('[data-testid="preview-series-names"]')?.textContent).toBe('Revenue|Net Revenue')
	})

	const bucketSeries = (name: string, yField: string): ChartConfiguration['series'][number] => ({
		...revenueSeries,
		name,
		type: 'bar',
		dataMapping: { xField: 'timestamp', yField }
	})

	const bucketConfig = {
		...config,
		type: 'bar',
		series: [
			bucketSeries('11-20 days', 'd11_20'),
			bucketSeries('2 days', 'd2'),
			bucketSeries('6-10 days', 'd6_10'),
			bucketSeries('1 day', 'd1')
		]
	} satisfies ChartConfiguration

	const clickButton = async (label: string) => {
		const button =
			document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`) ??
			[...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)
		if (!button) throw new Error(`Expected button "${label}"`)
		await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	const previewNames = () => document.querySelector('[data-testid="preview-series-names"]')?.textContent

	test.each(['unknown', 'stock'] as const)(
		'discards unsaved aggregation changes on reset from %s',
		async (metricClass) => {
			const editorConfig = { ...config, series: [{ ...revenueSeries, metricClass }] }
			const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
			const onPreview = vi.fn((_config: ChartConfiguration) => undefined)
			await act(async () => render(<EditorHarness editorConfig={editorConfig} onSave={onSave} onPreview={onPreview} />))
			const picker = document.querySelector<HTMLButtonElement>('button[aria-label="Series 1 aggregation"]')
			if (!picker) throw new Error('Expected aggregation picker')
			await pick(picker, 'Sum per period')
			expect(onPreview.mock.lastCall?.[0].series[0].metricClass).toBe('flow')

			await clickButton('Reset')
			expect(picker.textContent).toBe(metricClass === 'unknown' ? 'Choose aggregation' : 'End-of-period value')
			expect(onPreview.mock.lastCall?.[0].series[0].metricClass).toBe(metricClass)
			await clickButton('Save')
			const [savedConfig, patch] = onSave.mock.calls[0]
			expect(savedConfig.series[0].metricClass).toBe(metricClass)
			expect(patch.series?.[0].metricClass).toBe(metricClass === 'unknown' ? undefined : metricClass)
		}
	)

	test('moves a series up and saves the permutation in the patch', async () => {
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => render(<EditorHarness editorConfig={bucketConfig} onSave={onSave} />))

		const secondSeriesInput = labelled('Series 2 name')
		await clickButton('Move series 2 up')
		expect(labelled('Series 1 name')).toBe(secondSeriesInput)
		expect(previewNames()).toBe('2 days|11-20 days|6-10 days|1 day')

		await clickButton('Save')
		expect(onSave).toHaveBeenCalledOnce()
		const call = onSave.mock.calls[0]
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toEqual([1, 0, 2, 3])
		expect(patch.series?.map((s) => s.name)).toEqual(['2 days', '11-20 days', '6-10 days', '1 day'])
	})

	test('sorts series naturally with the sort button', async () => {
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => render(<EditorHarness editorConfig={bucketConfig} onSave={onSave} />))

		await clickButton('Sort series')
		expect(previewNames()).toBe('1 day|2 days|6-10 days|11-20 days')

		await clickButton('Save')
		const call = onSave.mock.calls[0]
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toEqual([3, 1, 2, 0])
	})

	test('omits order from the patch when series were not reordered', async () => {
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => render(<EditorHarness editorConfig={bucketConfig} onSave={onSave} />))

		await clickButton('Save')
		const call = onSave.mock.calls[0]
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toBeUndefined()
	})

	test('resets series names and order while preserving saved aggregation by data binding', async () => {
		const editorConfig = {
			...config,
			type: 'bar',
			series: [bucketSeries('Saved day 1', 'd1'), { ...bucketSeries('Saved day 2', 'd2'), metricClass: 'stock' }]
		} satisfies ChartConfiguration
		const originalConfig = {
			...config,
			type: 'bar',
			series: [
				{ ...bucketSeries('2 days', 'd2'), metricClass: 'unknown' },
				{ ...bucketSeries('1 day', 'd1'), metricClass: 'unknown' }
			]
		} satisfies ChartConfiguration
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		const onPreview = vi.fn((_config: ChartConfiguration) => undefined)
		await act(async () =>
			render(
				<EditorHarness
					editorConfig={editorConfig}
					originalConfig={originalConfig}
					onSave={onSave}
					onPreview={onPreview}
				/>
			)
		)

		await clickButton('Reset')
		expect(previewNames()).toBe('2 days|1 day')
		expect(onPreview.mock.lastCall?.[0].series.map((series) => series.metricClass)).toEqual(['stock', 'flow'])

		await clickButton('Save')
		const call = onSave.mock.calls[0]
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toEqual([1, 0])
		expect(patch.series?.map((series) => series.metricClass)).toEqual(['stock', 'flow'])
	})
	test('preserves duplicate annotation inputs through deletion and edits and saves only tuples', async () => {
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		const duplicateConfig: ChartConfiguration = {
			...config,
			hallmarks: [
				[1_768_867_200, ''],
				[1_768_867_200, '']
			]
		}
		await act(async () => render(<EditorHarness editorConfig={duplicateConfig} onSave={onSave} />))
		const surviving = document.querySelector<HTMLInputElement>('[aria-label="Annotation 2 label"]')!
		await act(async () => surviving.focus())
		await clickButton('Remove annotation')
		expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
		expect(document.activeElement).toBe(surviving)
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(surviving, 'Edited')
			surviving.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
		await clickButton('+ Add annotation')
		expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
		await clickButton('Save')
		expect(onSave.mock.calls[0][0].hallmarks).toEqual([
			[1_768_867_200, 'Edited'],
			[expect.any(Number), '']
		])
		expect(onSave.mock.calls[0][1].hallmarks).toEqual(onSave.mock.calls[0][0].hallmarks)
	})

	const typeTitle = async (value: string) => {
		const title = labelled('Chart title')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, value)
			title.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}
	const named = (label: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)

	test('a running save keeps Cancel and Escape from asking or closing until it settles', async () => {
		const saving = Promise.withResolvers<undefined>()
		const onCancel = vi.fn()
		await act(async () => render(<EditorHarness onSave={() => saving.promise} onCancel={onCancel} />))
		await typeTitle('Draft title')
		await clickButton('Save')
		await waitForUi(() => expect(document.querySelector('button[aria-busy="true"]')).not.toBeNull())
		await clickButton('Cancel')
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
		const title = labelled('Chart title')!
		await act(async () =>
			title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		)
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
		expect(onCancel).not.toHaveBeenCalled()
		expect(named('Cancel')!.getAttribute('aria-disabled')).toBe('true')
		await act(async () => saving.resolve(undefined))
		await waitForUi(() => expect(named('Cancel')!.getAttribute('aria-disabled')).toBeNull())
	})

	test('Reset during a running save keeps the editor locked and the saved title', async () => {
		const saving = Promise.withResolvers<undefined>()
		const onSave = vi.fn((_config: ChartConfiguration, _patch: ChartStylePatch) => saving.promise)
		await act(async () => render(<EditorHarness onSave={onSave} />))
		await typeTitle('First title')
		await clickButton('Save')
		await waitForUi(() => expect(document.querySelector('button[aria-busy="true"]')).not.toBeNull())
		await clickButton('Reset')
		expect(named('Cancel')!.getAttribute('aria-disabled')).toBe('true')
		expect(labelled('Chart title')!.value).toBe('First title')
		await act(async () => saving.resolve(undefined))
		expect(onSave.mock.calls.map(([saved]) => saved.title)).toEqual(['First title'])
	})

	test('a running save locks every draft field, so no later edit is lost when it lands', async () => {
		const saving = Promise.withResolvers<undefined>()
		await act(async () => render(<EditorHarness onSave={() => saving.promise} />))
		await typeTitle('First title')
		await clickButton('Save')
		await waitForUi(() => expect(document.querySelector('button[aria-busy="true"]')).not.toBeNull())
		const fields = [
			labelled('Chart title')!,
			document.querySelector('input[type="color"]')!,
			labelled('Series 1 name')!,
			document.querySelector('[aria-label="Annotation 1 label"]')!,
			named('bar')!,
			named('+ Add annotation')!,
			named('Reset')!
		]
		// A browser disables every control inside a disabled fieldset; happy-dom does not compute that, so read it the same way.
		// Reset stays focusable while locked (aria-disabled), like Cancel and the ×.
		const disabled = (field: Element) =>
			field.matches(':disabled, [aria-disabled="true"]') || field.closest('fieldset[disabled]') !== null
		expect(fields.map(disabled)).toEqual([true, true, true, true, true, true, true])
		await act(async () => saving.resolve(undefined))
		await waitForUi(() => expect(fields.map(disabled)).toEqual([false, false, false, false, false, false, false]))
	})

	test('names each series colour swatch by its series', async () => {
		await act(async () => render(<EditorHarness editorConfig={bucketConfig} onSave={vi.fn(async () => undefined)} />))
		expect([...document.querySelectorAll('input[type="color"]')].map(accessibleName)).toEqual([
			'Series 1 color',
			'Series 2 color',
			'Series 3 color',
			'Series 4 color'
		])
	})

	// Below md the editor shows one pane at a time; the errors live in the Style pane.
	test('Save from the preview pane with a blank title switches to the style pane and focuses the title', async () => {
		const onSave = vi.fn(async () => undefined)
		await act(async () => render(<EditorHarness onSave={onSave} previewPane={<div>Chart preview</div>} />))
		await typeTitle('')
		const pane = (name: string) =>
			[...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
				(radio) => radio.closest('label')?.textContent === name
			)!
		await act(async () => pane('Preview').click())
		expect(pane('Style').checked).toBe(false)

		await clickButton('Save')

		expect(pane('Style').checked).toBe(true)
		const title = labelled('Chart title')!
		expect(document.activeElement).toBe(title)
		expect(fieldErrorOf(title)).toBe('Enter a chart title.')
		expect(onSave).not.toHaveBeenCalled()
	})

	// A pie colours each slice: its series names have no field, so they never block Save.
	test('saves a pie whose series name is blank, since no name field renders for it', async () => {
		const pieConfig = {
			...config,
			type: 'pie',
			axes: { ...config.axes, x: { field: 'protocol', label: 'Protocol', type: 'category' } },
			hallmarks: undefined,
			series: [{ ...revenueSeries, name: '' }]
		} satisfies ChartConfiguration
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => render(<EditorHarness editorConfig={pieConfig} onSave={onSave} />))
		expect(labelled('Series 1 name')).toBeNull()

		await clickButton('Save')

		expect(onSave).toHaveBeenCalledOnce()
	})

	test('an edit typed back to the opened value closes on Cancel without asking', async () => {
		const onCancel = vi.fn()
		await act(async () => render(<EditorHarness onSave={vi.fn(async () => undefined)} onCancel={onCancel} />))
		await typeTitle('Draft title')
		await typeTitle(config.title)
		await clickButton('Cancel')
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
		expect(onCancel).toHaveBeenCalledOnce()
	})
})
