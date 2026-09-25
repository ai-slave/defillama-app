// @vitest-environment happy-dom

import { act, StrictMode, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useResize } from '../useResize'

const observations = new Map<Element, () => void>()
const widths = new Map<string, number>()
let container: HTMLDivElement
let root: Root

function MeasuredRow({ id }: { id: string | null }) {
	const elementRef = useRef<HTMLDivElement>(null)
	const { width, ref } = useResize(elementRef)
	return (
		<>
			<output>{width}</output>
			{id ? <div key={id} id={id} ref={ref} /> : null}
		</>
	)
}

beforeEach(() => {
	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
		return widths.get(this.id) ?? 0
	})
	vi.stubGlobal(
		'ResizeObserver',
		class {
			private elements = new Set<Element>()
			constructor(private callback: () => void) {}
			observe(element: Element) {
				this.elements.add(element)
				observations.set(element, this.callback)
			}
			disconnect() {
				for (const element of this.elements) observations.delete(element)
				this.elements.clear()
			}
		}
	)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	observations.clear()
	widths.clear()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

async function render(id: string | null) {
	await act(async () =>
		root.render(
			<StrictMode>
				<MeasuredRow id={id} />
			</StrictMode>
		)
	)
}

async function resize(id: string, width: number) {
	widths.set(id, width)
	await act(async () => {
		for (const [element, notify] of observations) {
			if (element.id === id) notify()
		}
	})
}

test('updates the measured width when the container shrinks and grows without a window resize', async () => {
	widths.set('row', 300)
	await render('row')
	expect(container.querySelector('output')?.textContent).toBe('300')
	await resize('row', 120)
	expect(container.querySelector('output')?.textContent).toBe('120')
	await resize('row', 450)
	expect(container.querySelector('output')?.textContent).toBe('450')
})

test('measures a row first attached after an empty render', async () => {
	await render(null)
	expect(container.querySelector('output')?.textContent).toBe('0')
	widths.set('row', 240)
	await render('row')
	expect(container.querySelector('output')?.textContent).toBe('240')
	await resize('row', 180)
	expect(container.querySelector('output')?.textContent).toBe('180')
})

test('stops observing removed rows and measures their replacements', async () => {
	widths.set('first', 300)
	await render('first')
	expect(container.querySelector('output')?.textContent).toBe('300')
	widths.set('second', 200)
	await render('second')
	expect([...observations.keys()].map((element) => element.id)).toEqual(['second'])
	await resize('first', 100)
	expect(container.querySelector('output')?.textContent).toBe('200')
	await resize('second', 160)
	expect(container.querySelector('output')?.textContent).toBe('160')
	await render(null)
	expect(observations.size).toBe(0)
	await render('first')
	expect(container.querySelector('output')?.textContent).toBe('100')
	await act(async () => root.render(null))
	expect(observations.size).toBe(0)
})
