// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Pagination } from '../Pagination'

let width = 0
const observers = new Set<{ notify: () => void }>()
let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width)
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(private callback: () => void) {}
			notify = () => this.callback()
			observe() {
				observers.add(this)
				// A real observer reports the size once when observation starts.
				queueMicrotask(this.notify)
			}
			disconnect() {
				observers.delete(this)
			}
		}
	)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	observers.clear()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const EVENTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

async function resize(nextWidth: number) {
	width = nextWidth
	await act(async () => {
		for (const observer of observers) observer.notify()
	})
}

const shown = () => [...container.querySelectorAll('[data-event]')].map((item) => item.textContent).join('')
const pageCount = () => container.textContent.match(/\d+ \/ \d+/)?.[0]

test('shows as many unlock cards per page as the row fits, and recounts when the row resizes', async () => {
	width = 1300
	await act(async () =>
		root.render(
			<Pagination
				items={EVENTS.map((event) => (
					<span key={event} data-event>
						{event}
					</span>
				))}
			/>
		)
	)
	expect(shown()).toBe('ABC')
	expect(pageCount()).toBe('1 / 3')

	await resize(900)
	expect(shown()).toBe('AB')
	expect(pageCount()).toBe('1 / 4')

	await resize(375)
	expect(shown()).toBe('A')
	expect(pageCount()).toBe('1 / 7')
})
