// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Tabs } from '~/ui/Tabs'
import { ProSegmented } from './ProSegmented'

let root: Root
let container: HTMLDivElement

const OPTIONS = [
	{ value: 'output' as const, label: 'Chart' },
	{ value: 'query' as const, label: 'SQL' }
]

const LABEL_WIDTH = 60

function stubLabelGeometry() {
	const left = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft')
	const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
	Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
		configurable: true,
		get(this: HTMLElement) {
			return this.textContent === 'SQL' ? LABEL_WIDTH : 0
		}
	})
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
		configurable: true,
		get() {
			return LABEL_WIDTH
		}
	})
	return () => {
		if (left) Object.defineProperty(HTMLElement.prototype, 'offsetLeft', left)
		if (width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', width)
	}
}

function indicator() {
	return container.querySelector<HTMLElement>('[aria-hidden="true"][data-ready]')!
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('one hidden indicator sits behind the labels', async () => {
	const restore = stubLabelGeometry()
	await act(async () =>
		root.render(<ProSegmented value="output" onValueChange={vi.fn()} options={OPTIONS} label="SQL card view" />)
	)
	const indicators = container.querySelectorAll('[data-ready]')
	expect(indicators).toHaveLength(1)
	expect(indicators[0].getAttribute('aria-hidden')).toBe('true')
	expect(indicators[0].className).toContain('z-0')
	expect(container.querySelectorAll('label')[0].className).toContain('z-10')
	restore()
})

test('the indicator slides to the selected segment', async () => {
	const restore = stubLabelGeometry()
	await act(async () =>
		root.render(<ProSegmented value="output" onValueChange={vi.fn()} options={OPTIONS} label="SQL card view" />)
	)
	expect(indicator().style.transform).toBe('translateX(0px)')
	expect(indicator().style.width).toBe(`${LABEL_WIDTH}px`)
	await act(async () =>
		root.render(<ProSegmented value="query" onValueChange={vi.fn()} options={OPTIONS} label="SQL card view" />)
	)
	expect(indicator().style.transform).toBe(`translateX(${LABEL_WIDTH}px)`)
	expect(indicator().getAttribute('data-ready')).toBe('true')
	restore()
})

test('tabs semantics move the indicator with the selected tab', async () => {
	const restore = stubLabelGeometry()
	await act(async () =>
		root.render(
			<Tabs value="output" onValueChange={vi.fn()} values={['output', 'query']}>
				<ProSegmented semantics="tabs" options={OPTIONS} label="SQL card view" />
			</Tabs>
		)
	)
	expect(container.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe('Chart')
	expect(indicator().style.transform).toBe('translateX(0px)')

	await act(async () =>
		root.render(
			<Tabs value="query" onValueChange={vi.fn()} values={['output', 'query']}>
				<ProSegmented semantics="tabs" options={OPTIONS} label="SQL card view" />
			</Tabs>
		)
	)
	expect(indicator().style.transform).toBe(`translateX(${LABEL_WIDTH}px)`)
	restore()
})

test('radio semantics keep the selected input checked', async () => {
	const restore = stubLabelGeometry()
	const onValueChange = vi.fn()
	await act(async () =>
		root.render(<ProSegmented value="query" onValueChange={onValueChange} options={OPTIONS} label="SQL card view" />)
	)
	const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
	expect(radios.map((radio) => radio.checked)).toEqual([false, true])
	expect(container.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('SQL card view')
	restore()
})
