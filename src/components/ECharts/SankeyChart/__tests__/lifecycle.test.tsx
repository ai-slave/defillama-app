// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import SankeyChart from '..'

let container: HTMLDivElement
let root: Root
let size = { width: 0, height: 0 }
let notifyResize: () => void = () => {}

beforeEach(() => {
	installChartCanvas({ width: 640, height: 360 })
	// happy-dom lays nothing out: the element reports the size a test sets, and the observer fires when told.
	size = { width: 0, height: 0 }
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => new DOMRect(0, 0, size.width, size.height)
	)
	vi.stubGlobal(
		'ResizeObserver',
		class {
			private targets = new Set<Element>()
			constructor(private callback: ResizeObserverCallback) {
				notifyResize = () =>
					this.callback(
						[...this.targets].map(
							(target) => ({ target, contentRect: target.getBoundingClientRect() }) as ResizeObserverEntry
						),
						this as unknown as ResizeObserver
					)
			}
			observe(target: Element) {
				this.targets.add(target)
			}
			unobserve(target: Element) {
				this.targets.delete(target)
			}
			disconnect() {
				this.targets.clear()
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
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const flow = (target: string, value: number) => ({
	nodes: [{ name: 'Revenue' }, { name: target }],
	links: [{ source: 'Revenue', target, value }]
})

function shownLinks() {
	const element = container.querySelector<HTMLElement>('[_echarts_instance_]')
	if (!element) return null
	return (echarts.getInstanceByDom(element)!.getOption() as Record<string, any>).series[0].links
}

test('waits for a hidden tab to become visible, then draws the latest flow once', async () => {
	const onReady = vi.fn()
	await act(async () =>
		root.render(<SankeyChart exportButtons={{ omit: 'renderer test' }} {...flow('Protocol', 10)} onReady={onReady} />)
	)
	await act(async () =>
		root.render(<SankeyChart exportButtons={{ omit: 'renderer test' }} {...flow('Treasury', 20)} onReady={onReady} />)
	)

	expect(shownLinks()).toBeNull()
	expect(onReady).not.toHaveBeenCalled()

	size = { width: 640, height: 360 }
	await act(async () => notifyResize())

	expect(shownLinks()).toEqual([{ source: 'Revenue', target: 'Treasury', value: 20 }])
	expect(onReady).toHaveBeenCalledOnce()
})

test('holds updates while an initialized chart is hidden and applies the latest one when shown again', async () => {
	size = { width: 640, height: 360 }
	await act(async () =>
		root.render(<SankeyChart exportButtons={{ omit: 'renderer test' }} {...flow('Protocol', 10)} />)
	)
	expect(shownLinks()).toEqual([{ source: 'Revenue', target: 'Protocol', value: 10 }])

	size = { width: 640, height: 0 }
	await act(async () => notifyResize())
	await act(async () =>
		root.render(<SankeyChart exportButtons={{ omit: 'renderer test' }} {...flow('Treasury', 20)} />)
	)

	expect(shownLinks()).toEqual([{ source: 'Revenue', target: 'Protocol', value: 10 }])

	size = { width: 640, height: 360 }
	await act(async () => notifyResize())

	expect(shownLinks()).toEqual([{ source: 'Revenue', target: 'Treasury', value: 20 }])
})
