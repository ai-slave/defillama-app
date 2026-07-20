// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChartConfiguration, ChartStylePatch } from '~/containers/LlamaAI/types'
import { ChartStyleEditor } from './ChartStyleEditor'

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
	series: [
		{
			name: 'Revenue',
			type: 'line',
			yAxisId: 'value',
			metricClass: 'flow',
			dataMapping: { xField: 'timestamp', yField: 'value' },
			styling: {}
		}
	],
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

function EditorHarness({
	onSave,
	onPreview
}: {
	onSave: (config: ChartConfiguration, patch: ChartStylePatch) => Promise<void>
	onPreview?: (config: ChartConfiguration) => void
}) {
	const [saved, setSaved] = useState<ChartConfiguration>(config)
	const [preview, setPreview] = useState<ChartConfiguration>(config)
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
			<ChartStyleEditor
				config={config}
				original={config}
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
		const [savedConfig, savedPatch] = onSave.mock.calls[0]!
		expect(savedConfig.hallmarks?.[0]?.[1]).toBe('hello')
		expect(savedPatch.hallmarks?.[0]?.[1]).toBe('hello')
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
})
