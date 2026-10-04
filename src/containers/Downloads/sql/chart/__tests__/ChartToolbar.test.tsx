// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import { ChartToolbar } from '../ChartToolbar'

vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)

const columns: Array<ClassifiedColumn> = [
	{ name: 'date', coarse: 'date', fine: 'date', index: 0 },
	{ name: 'chain', coarse: 'category', fine: 'text', index: 1 },
	...Array.from({ length: 9 }, (_, i): ClassifiedColumn => ({
		name: `value${i}`,
		coarse: 'number',
		fine: 'float',
		index: i + 2
	}))
]
const initial: ChartConfig = {
	chartType: 'bar',
	xCol: 'date',
	yCols: ['value0', 'value1'],
	splitByCol: null,
	stackMode: 'off',
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto'
}
let root: Root
let container: HTMLDivElement
let current: ChartConfig
const change = vi.fn()
function Harness({
	config = initial,
	classified = columns,
	nested = false
}: {
	config?: ChartConfig
	classified?: Array<ClassifiedColumn>
	nested?: boolean
}) {
	const [value, setValue] = useState(config)
	current = value
	const controls = (
		<ChartToolbar
			config={value}
			classified={classified}
			onChange={(patch) => {
				change(patch)
				setValue((prev) => ({ ...prev, ...patch }))
			}}
		/>
	)
	return nested ? (
		<Ariakit.DialogProvider>
			<Ariakit.DialogDisclosure>Chart editor</Ariakit.DialogDisclosure>
			<Ariakit.Dialog aria-label="Chart editor" portal>
				{controls}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	) : (
		controls
	)
}
beforeEach(() => {
	change.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function settle(action: () => void) {
	await act(async () => {
		action()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}
async function render(children: ReactNode) {
	await settle(() => root.render(children))
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent === name
	)!
}
function radio(group: string, value: string) {
	return document.querySelector<HTMLInputElement>(`[role="radiogroup"][aria-label="${group}"] input[value="${value}"]`)!
}
function dialog(name: string) {
	return document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"]:not([hidden])`)!
}
async function click(el: HTMLElement) {
	await settle(() => {
		el.focus()
		el.click()
	})
}
async function press(el: HTMLElement, key: string) {
	await settle(() => {
		el.focus()
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
	})
}
/** A column picker chip, which reads "label: value". */
function picker(label: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('[role="combobox"]')].find((el) =>
		el.textContent?.startsWith(`${label}: `)
	)!
}
function choice(name: string) {
	return [...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')].find(
		(el) => el.textContent === name
	)!
}

test('radio groups preserve configuration on mount, select once with arrows, and keep independent values', async () => {
	await render(<Harness />)
	expect(change).not.toHaveBeenCalled()
	for (const group of ['Chart type', 'Number format', 'Stack mode']) {
		expect(
			[...document.querySelectorAll<HTMLInputElement>(`[role="radiogroup"][aria-label="${group}"] input`)].filter(
				(el) => el.tabIndex === 0
			)
		).toHaveLength(1)
	}
	await press(radio('Number format', 'auto'), 'ArrowRight')
	expect(current.numberFormat).toBe('humanized')
	expect(change.mock.calls).toEqual([[{ numberFormat: 'humanized' }]])
	await press(radio('Number format', 'humanized'), 'End')
	expect(current.numberFormat).toBe('percent')
	await press(radio('Stack mode', 'off'), 'ArrowRight')
	expect(current.stackMode).toBe('stacked')
	expect(current.chartType).toBe('bar')
	await press(radio('Chart type', 'bar'), 'ArrowLeft')
	expect(current.chartType).toBe('areaPct')
})

test('external values and disabled selected chart types do not write configuration', async () => {
	const onChange = vi.fn()
	await render(<ChartToolbar config={initial} classified={columns} onChange={onChange} />)
	await render(
		<ChartToolbar
			config={{ ...initial, numberFormat: 'percent', chartType: 'line' }}
			classified={[columns[2]]}
			onChange={onChange}
		/>
	)
	expect(radio('Number format', 'percent').checked).toBe(true)
	expect(radio('Chart type', 'line').checked).toBe(true)
	expect(radio('Chart type', 'line').disabled).toBe(true)
	expect(radio('Chart type', 'histogram').tabIndex).toBe(0)
	expect(onChange).not.toHaveBeenCalled()
	await click(radio('Chart type', 'line'))
	expect(onChange).not.toHaveBeenCalled()
	await render(<ChartToolbar config={initial} classified={[]} onChange={onChange} />)
	expect(
		[...document.querySelectorAll<HTMLInputElement>('[aria-label="Chart type"] input')].every((el) => el.disabled)
	).toBe(true)
	expect(onChange).not.toHaveBeenCalled()
})

test('column pickers expose selected values, close on selection, and retain split none and disabled series behavior', async () => {
	await render(<Harness config={{ ...initial, yCols: ['value0'] }} />)
	await click(picker('split by'))
	expect(choice('none').getAttribute('aria-selected')).toBe('true')
	await click(choice('chain'))
	expect(current.splitByCol).toBe('chain')
	expect(button('Y series').disabled).toBe(true)
	expect(document.activeElement).toBe(picker('split by'))
	await click(picker('split by'))
	expect(choice('chain').getAttribute('aria-selected')).toBe('true')
	await click(choice('none'))
	expect(current.splitByCol).toBeNull()
	expect(button('Y series').disabled).toBe(false)
	await click(picker('x'))
	expect(choice('date').getAttribute('aria-selected')).toBe('true')
	await click(choice('chain'))
	expect(current.xCol).toBe('chain')
	expect(document.activeElement).toBe(picker('x'))
})

test('series settings allow empty selection and retain focus when controls disappear', async () => {
	await render(<Harness config={{ ...initial, yCols: [] }} />)
	await click(button('Y series'))
	const settings = dialog('Y series settings')
	expect(settings.querySelector('[role="menuitem"]')).toBeNull()
	await click(button('Add value0'))
	expect(current.yCols).toEqual(['value0'])
	expect(document.activeElement).toBe(settings)
	await click(button('Remove value0'))
	expect(current.yCols).toEqual([])
	expect(document.activeElement).toBe(settings)
})

test('series additions stop at eight and become available after removing a series', async () => {
	await render(<Harness config={{ ...initial, yCols: Array.from({ length: 8 }, (_, i) => `value${i}`) }} />)
	await click(button('Y series'))
	expect(button('Add value8').disabled).toBe(true)
	await click(button('Add value8'))
	expect(current.yCols).toHaveLength(8)
	await click(button('Remove value0'))
	expect(button('Add value8').disabled).toBe(false)
	await click(button('Add value8'))
	expect(current.yCols).toEqual(['value1', 'value2', 'value3', 'value4', 'value5', 'value6', 'value7', 'value8'])
})

test('nested colors expose selection and Escape closes one popup at a time inside a dialog', async () => {
	await render(<Harness nested />)
	await click(button('Chart editor'))
	await click(button('Y series'))
	await click(button('Use right axis for value0'))
	expect(button('Use right axis for value0').getAttribute('aria-pressed')).toBe('true')
	expect(current.rightAxisCols).toEqual(['value0'])
	await click(button('Color for value0'))
	expect(dialog('Color for value0')).not.toBeNull()
	await click(radio('Preset colors', CHART_COLORS[1].toLowerCase()))
	expect(current.seriesColors.value0).toBe(CHART_COLORS[1])
	expect(radio('Preset colors', CHART_COLORS[1].toLowerCase()).getAttribute('aria-checked')).toBe('true')
	await press(radio('Preset colors', CHART_COLORS[1].toLowerCase()), 'Escape')
	expect(dialog('Color for value0')).toBeNull()
	expect(dialog('Y series settings')).not.toBeNull()
	expect(document.activeElement).toBe(button('Color for value0'))
	await press(button('Color for value0'), 'Escape')
	expect(dialog('Y series settings')).toBeNull()
	expect(dialog('Chart editor')).not.toBeNull()
	expect(document.activeElement).toBe(button('Y series'))
	await press(button('Y series'), 'Escape')
	expect(dialog('Chart editor')).toBeNull()
	expect(document.activeElement).toBe(button('Chart editor'))
})

test('custom colors retain validation and reset restores the palette without changing other settings', async () => {
	await render(<Harness />)
	await click(button('Y series'))
	await click(button('Color for value0'))
	const input = document.querySelector<HTMLInputElement>('[aria-label="Custom color for value0"]')!
	const setDraft = async (value: string) =>
		settle(() => {
			input.focus()
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
	await setDraft('bad')
	await settle(() => input.blur())
	expect(current.seriesColors).toEqual({})
	await setDraft('#123abc')
	await settle(() => input.blur())
	expect(current.seriesColors).toEqual({ value0: '#123abc' })
	await click(button('reset'))
	expect(current.seriesColors).toEqual({})
	expect(radio('Preset colors', CHART_COLORS[0].toLowerCase()).getAttribute('aria-checked')).toBe('true')
	expect(current.yCols).toEqual(initial.yCols)
	expect(current.numberFormat).toBe(initial.numberFormat)
})

test('chart-type navigation skips incompatible columns without activating disabled choices', async () => {
	await render(<Harness config={{ ...initial, chartType: 'scatter' }} classified={columns.slice(0, 4)} />)
	await press(radio('Chart type', 'scatter'), 'ArrowRight')
	expect(current.chartType).toBe('histogram')
	expect(change.mock.calls).toEqual([[{ chartType: 'histogram' }]])
	await press(radio('Chart type', 'histogram'), 'End')
	expect(current.chartType).toBe('treemap')
	expect(radio('Chart type', 'candlestick').disabled).toBe(true)
})

test('a custom color leaves one palette entry point and arrow navigation selects once', async () => {
	await render(<Harness config={{ ...initial, seriesColors: { value0: '#123abc' } }} />)
	await click(button('Y series'))
	await click(button('Color for value0'))
	const presets = [
		...dialog('Color for value0').querySelectorAll<HTMLInputElement>('[aria-label="Preset colors"] input')
	]
	expect(presets.every((el) => !el.checked)).toBe(true)
	expect(presets.filter((el) => el.tabIndex === 0)).toHaveLength(1)
	expect(change).not.toHaveBeenCalled()
	await press(presets[0], 'ArrowRight')
	expect(current.seriesColors.value0).toBe(CHART_COLORS[1])
	expect(change).toHaveBeenCalledTimes(1)
})

test('choosing a numeric X column removes it from Y and preserves the remaining series', async () => {
	await render(<Harness config={{ ...initial, xCol: null }} classified={columns.slice(2, 4)} />)
	await click(picker('x'))
	expect(
		[...document.querySelectorAll('[role="listbox"] [role="option"]')].every(
			(el) => el.getAttribute('aria-selected') !== 'true'
		)
	).toBe(true)
	await click(choice('value0'))
	expect(current.xCol).toBe('value0')
	expect(current.yCols).toEqual(['value1'])
})
