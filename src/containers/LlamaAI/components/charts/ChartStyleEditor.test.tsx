// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChartConfiguration, ChartStylePatch } from '~/containers/LlamaAI/chartTypes'
import { ChartStyleEditor } from './ChartStyleEditor'

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
	showStack: false,
	showPercentage: false,
	showLogScale: false,
	showLabels: false,
	showHallmarks: true
}

const view = { logScale: false, stacked: false, showLabels: false, percentage: false }
const resetView = { logScale: false, stacked: true, showLabels: false, percentage: false }
const PREVIEW_DELAY = 350

function EditorHarness({
	onSave,
	onPreview,
	editorConfig = config,
	originalConfig
}: {
	onSave: (config: ChartConfiguration, patch: ChartStylePatch) => Promise<void>
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
				onCancel={vi.fn()}
			/>
		</>
	)
}

describe('ChartStyleEditor', () => {
	let container: HTMLDivElement
	let root: Root

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

	it('debounces annotation preview while keeping the saved chart unchanged', async () => {
		vi.useFakeTimers()
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		const onPreview = vi.fn()
		await act(async () => root.render(<EditorHarness onSave={onSave} onPreview={onPreview} />))

		const annotationInput = container.querySelector<HTMLInputElement>('[aria-label="Annotation 1 label"]')
		if (!annotationInput) throw new Error('Expected annotation label input')
		const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
		if (!setInputValue) throw new Error('Expected native input value setter')
		for (const value of ['h', 'he', 'hel', 'hell', 'hello']) {
			await act(async () => {
				setInputValue.call(annotationInput, value)
				annotationInput.dispatchEvent(new Event('input', { bubbles: true }))
			})
		}

		expect(container.querySelector('[data-testid="saved-annotation"]')?.textContent).toBe('Existing note')
		expect(container.querySelector('[data-testid="preview-annotation"]')?.textContent).toBe('Existing note')
		expect(onPreview).not.toHaveBeenCalled()
		expect(onSave).not.toHaveBeenCalled()

		await act(async () => vi.advanceTimersByTime(349))
		expect(onPreview).not.toHaveBeenCalled()
		await act(async () => vi.advanceTimersByTime(1))
		expect(onPreview).toHaveBeenCalledOnce()
		expect(container.querySelector('[data-testid="preview-annotation"]')?.textContent).toBe('hello')
		expect(container.querySelector('[data-testid="saved-annotation"]')?.textContent).toBe('Existing note')

		const saveButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
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
		expect(container.querySelector('[data-testid="saved-annotation"]')?.textContent).toBe('hello')
	})

	it('flushes a pending text preview when the input loses focus', async () => {
		vi.useFakeTimers()
		const onPreview = vi.fn()
		await act(async () => root.render(<EditorHarness onSave={vi.fn(async () => undefined)} onPreview={onPreview} />))
		const annotationInput = container.querySelector<HTMLInputElement>('[aria-label="Annotation 1 label"]')
		if (!annotationInput) throw new Error('Expected annotation label input')
		const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
		if (!setInputValue) throw new Error('Expected native input value setter')

		await act(async () => {
			setInputValue.call(annotationInput, 'Updated note')
			annotationInput.dispatchEvent(new Event('input', { bubbles: true }))
			annotationInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
		})

		expect(onPreview).toHaveBeenCalledOnce()
		expect(container.querySelector('[data-testid="preview-annotation"]')?.textContent).toBe('Updated note')
	})

	it('previews discrete chart options and added annotations immediately', async () => {
		const onPreview = vi.fn()
		await act(async () => root.render(<EditorHarness onSave={vi.fn(async () => undefined)} onPreview={onPreview} />))
		const barButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'bar'
		)
		const addAnnotationButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === '+ Add annotation'
		)
		if (!barButton || !addAnnotationButton) throw new Error('Expected discrete editor actions')

		await act(async () => barButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(container.querySelector('[data-testid="preview-type"]')?.textContent).toBe('bar')
		await act(async () => addAnnotationButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(container.querySelector('[data-testid="preview-annotation-count"]')?.textContent).toBe('2')
		expect(onPreview).toHaveBeenCalledTimes(2)
	})

	it('keeps the last valid preview and disables save while series names are duplicated', async () => {
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
		await act(async () =>
			root.render(<EditorHarness editorConfig={editorConfig} onSave={onSave} onPreview={onPreview} />)
		)

		const secondName = container.querySelector<HTMLInputElement>('[aria-label="Series 2 name"]')
		if (!secondName) throw new Error('Expected second series name input')
		const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
		if (!setInputValue) throw new Error('Expected native input value setter')

		await act(async () => {
			setInputValue.call(secondName, 'Revenue')
			secondName.dispatchEvent(new Event('input', { bubbles: true }))
			vi.advanceTimersByTime(PREVIEW_DELAY)
		})

		const saveButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'Save'
		)
		if (!saveButton) throw new Error('Expected save button')
		expect(saveButton.disabled).toBe(true)
		expect(saveButton.title).toContain('must be unique')
		expect(onPreview).not.toHaveBeenCalled()
		expect(container.querySelector('[data-testid="preview-series-names"]')?.textContent).toBe('Revenue|Fees')

		await act(async () => {
			setInputValue.call(secondName, 'Net Revenue')
			secondName.dispatchEvent(new Event('input', { bubbles: true }))
			vi.advanceTimersByTime(PREVIEW_DELAY)
		})

		expect(saveButton.disabled).toBe(false)
		expect(onPreview).toHaveBeenCalledOnce()
		expect(container.querySelector('[data-testid="preview-series-names"]')?.textContent).toBe('Revenue|Net Revenue')
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
			container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`) ??
			[...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)
		if (!button) throw new Error(`Expected button "${label}"`)
		await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	const previewNames = () => container.querySelector('[data-testid="preview-series-names"]')?.textContent

	it('moves a series up and saves the permutation in the patch', async () => {
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => root.render(<EditorHarness editorConfig={bucketConfig} onSave={onSave} />))

		await clickButton('Move series 2 up')
		expect(previewNames()).toBe('2 days|11-20 days|6-10 days|1 day')

		await clickButton('Save')
		expect(onSave).toHaveBeenCalledOnce()
		const call = onSave.mock.calls[0]
		expect(call).toBeDefined()
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toEqual([1, 0, 2, 3])
		expect(patch.series?.map((s) => s.name)).toEqual(['2 days', '11-20 days', '6-10 days', '1 day'])
	})

	it('sorts series naturally with the sort button', async () => {
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => root.render(<EditorHarness editorConfig={bucketConfig} onSave={onSave} />))

		await clickButton('Sort series')
		expect(previewNames()).toBe('1 day|2 days|6-10 days|11-20 days')

		await clickButton('Save')
		const call = onSave.mock.calls[0]
		expect(call).toBeDefined()
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toEqual([3, 1, 2, 0])
	})

	it('omits order from the patch when series were not reordered', async () => {
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () => root.render(<EditorHarness editorConfig={bucketConfig} onSave={onSave} />))

		await clickButton('Save')
		const call = onSave.mock.calls[0]
		expect(call).toBeDefined()
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toBeUndefined()
	})

	it('maps reset back to the original series order relative to the saved config', async () => {
		const editorConfig = {
			...config,
			type: 'bar',
			series: [bucketSeries('1 day', 'd1'), bucketSeries('2 days', 'd2')]
		} satisfies ChartConfiguration
		const originalConfig = {
			...config,
			type: 'bar',
			series: [bucketSeries('2 days', 'd2'), bucketSeries('1 day', 'd1')]
		} satisfies ChartConfiguration
		const onSave = vi.fn(async (_config: ChartConfiguration, _patch: ChartStylePatch) => undefined)
		await act(async () =>
			root.render(<EditorHarness editorConfig={editorConfig} originalConfig={originalConfig} onSave={onSave} />)
		)

		await clickButton('Reset')
		expect(previewNames()).toBe('2 days|1 day')

		await clickButton('Save')
		const call = onSave.mock.calls[0]
		expect(call).toBeDefined()
		if (!call) throw new Error('Missing save call')
		const patch = call[1]
		expect(patch.order).toEqual([1, 0])
	})
})
