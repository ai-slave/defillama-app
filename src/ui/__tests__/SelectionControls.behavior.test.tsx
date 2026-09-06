// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ViewTabs } from '~/components/ViewTabs'
import { SegmentedControl } from '../SegmentedControl'
import { Tabs, TabPanel } from '../Tabs'

const OPTIONS = [
	{ value: 'table', label: 'Table' },
	{ value: 'chart', label: 'Chart' },
	{ value: 'details', label: 'Details' }
] as const

type Value = (typeof OPTIONS)[number]['value']

async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

function Selection({
	kind,
	onChange,
	initial = 'table',
	disabled = [],
	external,
	keepMounted = false
}: {
	kind: 'radio' | 'tabs' | 'view'
	onChange: (value: Value) => void
	initial?: Value | null
	disabled?: Array<Value>
	external?: Value | null
	keepMounted?: boolean
}) {
	const [local, setLocal] = useState<Value | null>(initial)
	const value = external === undefined ? local : external
	const change = (next: Value) => {
		setLocal(next)
		onChange(next)
	}
	const options = OPTIONS.map((option) => ({ ...option, disabled: disabled.includes(option.value) }))
	if (kind === 'radio') {
		return (
			<SegmentedControl
				value={value}
				onValueChange={change}
				options={options}
				label="Metric"
				variant="default"
				size="md"
			/>
		)
	}
	return (
		<Tabs value={value ?? 'table'} onValueChange={change} values={OPTIONS.map((option) => option.value)}>
			{kind === 'view' ? (
				<ViewTabs tabs={OPTIONS.map((option) => ({ id: option.value, label: option.label }))} label="View" />
			) : (
				<SegmentedControl semantics="tabs" options={options} label="View" variant="default" size="md" />
			)}
			{keepMounted ? (
				OPTIONS.map((option) => (
					<TabPanel key={option.value} value={option.value}>
						<input aria-label={`${option.label} draft`} />
					</TabPanel>
				))
			) : value === null ? null : (
				<TabPanel value={value}>
					<span>{value} content</span>
				</TabPanel>
			)}
		</Tabs>
	)
}

describe('controlled selection primitives', () => {
	let root: Root
	let container: HTMLDivElement
	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})
	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	const render = async (props: Parameters<typeof Selection>[0]) => {
		await act(async () => root.render(<Selection {...props} />))
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 30))
		})
	}
	const controls = () => [
		...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('button, input[type="radio"]')
	]
	const focus = async (element: HTMLElement) => {
		await act(async () => element.focus())
	}

	test.each(['radio', 'tabs', 'view'] as const)(
		'%s: does not notify on mount or external selection changes',
		async (kind) => {
			const onChange = vi.fn()
			await render({ kind, onChange })
			expect(onChange).not.toHaveBeenCalled()
			await render({ kind, onChange, external: 'details' })
			expect(controls()[2].getAttribute(kind === 'radio' ? 'aria-checked' : 'aria-selected')).toBe('true')
			expect(onChange).not.toHaveBeenCalled()
		}
	)

	test('radio: preserves an explicitly unselected value', async () => {
		const onChange = vi.fn()
		await render({ kind: 'radio', onChange, initial: null })
		expect(controls().map((button) => button.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false'])
		expect(controls().filter((button) => button.tabIndex === 0)).toHaveLength(1)
		expect(onChange).not.toHaveBeenCalled()
	})

	test('a radio group with no selection starts at its first enabled option', async () => {
		const onChange = vi.fn()
		await render({ kind: 'radio', initial: null, disabled: ['table'], onChange })
		expect(controls()[0].disabled).toBe(true)
		expect(controls()[1].tabIndex).toBe(0)
		expect(controls()[2].tabIndex).toBe(-1)
		expect(onChange).not.toHaveBeenCalled()
		await focus(controls()[1])
		await press(controls()[1], ' ')
		expect(onChange.mock.calls).toEqual([['chart']])
		await press(controls()[1], ' ')
		expect(onChange).toHaveBeenCalledTimes(1)
	})

	test('a disabled selected radio preserves its value and leaves one enabled entry point', async () => {
		const onChange = vi.fn()
		await render({ kind: 'radio', onChange, disabled: ['table'] })
		expect(controls()[0].getAttribute('aria-checked')).toBe('true')
		expect(controls().filter((button) => !button.disabled && button.tabIndex === 0)).toHaveLength(1)
		expect(onChange).not.toHaveBeenCalled()
		await focus(controls()[1])
		await press(controls()[1], 'ArrowRight')
		expect(document.activeElement).toBe(controls()[2])
		expect(onChange.mock.calls).toEqual([['details']])
		expect(controls()[2].getAttribute('aria-checked')).toBe('true')
		expect(controls().filter((button) => !button.disabled && button.tabIndex === 0)).toHaveLength(1)
	})

	test('radio arrows select once, skip disabled values, and wrap', async () => {
		const onChange = vi.fn()
		await render({ kind: 'radio', onChange, disabled: ['chart'] })
		await focus(controls()[0])
		await press(controls()[0], 'ArrowRight')
		expect(document.activeElement).toBe(controls()[2])
		expect(onChange.mock.calls).toEqual([['details']])
		await press(controls()[2], 'ArrowDown')
		expect(document.activeElement).toBe(controls()[0])
		expect(onChange.mock.calls).toEqual([['details'], ['table']])
		await press(controls()[0], 'End')
		expect(document.activeElement).toBe(controls()[2])
		await press(controls()[2], 'Home')
		expect(document.activeElement).toBe(controls()[0])
	})

	test.each(['tabs', 'view'] as const)('%s: focus movement does not activate or mount a panel', async (kind) => {
		const onChange = vi.fn()
		await render({ kind, onChange })
		const tablePanel = container.querySelector('[role="tabpanel"]')!
		await focus(controls()[0])
		await press(controls()[0], 'ArrowRight')
		expect(document.activeElement).toBe(controls()[1])
		expect(onChange).not.toHaveBeenCalled()
		expect(tablePanel.textContent).toBe('table content')
		await press(controls()[1], 'Enter')
		expect(onChange.mock.calls).toEqual([['chart']])
		expect(document.activeElement).toBe(controls()[1])
		const panel = container.querySelector('[role="tabpanel"]')!
		expect(panel.textContent).toBe('chart content')
		expect(panel.getAttribute('aria-labelledby')).toBe(controls()[1].id)
		expect(controls()[1].getAttribute('aria-controls')).toBe(panel.id)
		expect(controls()[0].hasAttribute('aria-controls')).toBe(false)
		await press(controls()[1], 'End')
		await press(controls()[2], ' ')
		expect(onChange.mock.calls).toEqual([['chart'], ['details']])
		await press(controls()[2], 'Home')
		expect(document.activeElement).toBe(controls()[0])
		expect(onChange).toHaveBeenCalledTimes(2)
	})

	test.each(['radio', 'tabs'] as const)(
		'%s: disabled values cannot be activated by mouse or keyboard',
		async (kind) => {
			const onChange = vi.fn()
			await render({ kind, onChange, disabled: ['table', 'chart', 'details'] })
			expect(controls().map((button) => button.getAttribute('aria-disabled'))).toEqual(['true', 'true', 'true'])
			await act(async () => controls()[1].click())
			await press(controls()[1], 'Enter')
			expect(onChange).not.toHaveBeenCalled()
		}
	)

	test('mounted hidden panels retain draft DOM and become hidden', async () => {
		await render({ kind: 'tabs', onChange: vi.fn(), keepMounted: true })
		const input = container.querySelector<HTMLInputElement>('input')!
		input.value = 'unsaved draft'
		await act(async () => controls()[1].click())
		expect(input.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true)
		await act(async () => controls()[0].click())
		expect(container.querySelector('input')).toBe(input)
		expect(input.value).toBe('unsaved draft')
	})

	test('native radios in separate groups cannot uncheck each other', async () => {
		const onChange = vi.fn()
		await act(async () =>
			root.render(
				<>
					<Selection kind="radio" onChange={onChange} />
					<Selection kind="radio" onChange={onChange} />
				</>
			)
		)
		const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
		expect(radios[0].name).not.toBe(radios[3].name)
		await act(async () => radios[1].click())
		expect(radios[1].checked).toBe(true)
		expect(radios[3].checked).toBe(true)
		expect(onChange.mock.calls).toEqual([['chart']])
	})

	test('two instances have independent selection and panel identities', async () => {
		const onChange = vi.fn()
		await act(async () =>
			root.render(
				<>
					<Selection kind="tabs" onChange={onChange} />
					<Selection kind="tabs" onChange={onChange} />
				</>
			)
		)
		const ids = [...container.querySelectorAll('[role="tab"], [role="tabpanel"]')].map((element) => element.id)
		expect(new Set(ids).size).toBe(ids.length)
		await act(async () => controls()[1].click())
		expect(controls()[1].getAttribute('aria-selected')).toBe('true')
		expect(controls()[3].getAttribute('aria-selected')).toBe('true')
		expect(onChange.mock.calls).toEqual([['chart']])
	})
})
