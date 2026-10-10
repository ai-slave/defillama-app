// @vitest-environment happy-dom

import type * as echarts from 'echarts/core'
import { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useChartResize } from '../useChartResize'

type FakeChart = {
	isDisposed: ReturnType<typeof vi.fn>
	resize: ReturnType<typeof vi.fn>
	getDom: () => { clientWidth: number; clientHeight: number }
	getWidth: () => number
	getHeight: () => number
}

/** A chart drawn at `drawn` whose element now measures `box`; happy-dom has no layout to measure. */
function fakeChart({ disposed = false, box = [320, 180], drawn = [0, 0] } = {}): FakeChart {
	return {
		isDisposed: vi.fn(() => disposed),
		resize: vi.fn(),
		getDom: () => ({ clientWidth: box[0], clientHeight: box[1] }),
		getWidth: () => drawn[0],
		getHeight: () => drawn[1]
	}
}

function resizeEntry(target: Element, width = 320, height = 180) {
	return { target, contentRect: { width, height } } as unknown as ResizeObserverEntry
}

function ChartHarness({
	instance,
	observeElement = false,
	showElement = true,
	onElementResize,
	onElementVisibilityChange
}: {
	instance: FakeChart
	observeElement?: boolean
	showElement?: boolean
	onElementResize?: () => void
	onElementVisibilityChange?: (isVisible: boolean) => void
}) {
	const instanceRef = useRef(instance as unknown as echarts.ECharts)
	const elementRef = useRef<HTMLDivElement>(null)
	instanceRef.current = instance as unknown as echarts.ECharts
	useChartResize(instanceRef, observeElement ? elementRef : undefined, {
		onResize: onElementResize,
		onVisibilityChange: onElementVisibilityChange
	})
	return observeElement && showElement ? <div ref={elementRef} /> : null
}

describe('useChartResize', () => {
	let container: HTMLDivElement
	let root: Root
	let observerCallback: ResizeObserverCallback | null
	let observerConstructCount: number
	let observerObserve: ReturnType<typeof vi.fn>
	let observerUnobserve: ReturnType<typeof vi.fn>
	let observerDisconnect: ReturnType<typeof vi.fn>

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		observerCallback = null
		observerConstructCount = 0
		observerObserve = vi.fn()
		observerUnobserve = vi.fn()
		observerDisconnect = vi.fn()
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback: ResizeObserverCallback) {
					observerConstructCount++
					observerCallback = callback
				}
				observe = observerObserve
				unobserve = observerUnobserve
				disconnect = observerDisconnect
			}
		)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	test('uses one resize listener to resize every live chart instance', async () => {
		const addListener = vi.spyOn(window, 'addEventListener')
		const first = fakeChart()
		const second = fakeChart()

		await act(async () =>
			root.render(
				<>
					<ChartHarness instance={first} />
					<ChartHarness instance={second} />
				</>
			)
		)

		expect(addListener.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1)

		window.dispatchEvent(new Event('resize'))
		expect(first.resize).toHaveBeenCalledOnce()
		expect(second.resize).toHaveBeenCalledOnce()
	})

	test('uses one element observer and resizes only the chart whose container changed', async () => {
		const first = fakeChart()
		const second = fakeChart()
		const firstElementResize = vi.fn()
		const secondElementResize = vi.fn()

		await act(async () =>
			root.render(
				<>
					<ChartHarness instance={first} observeElement onElementResize={firstElementResize} />
					<ChartHarness instance={second} observeElement onElementResize={secondElementResize} />
				</>
			)
		)

		const elements = container.querySelectorAll('div')
		for (const element of elements) {
			vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 320, height: 180 } as DOMRect)
		}
		expect(observerConstructCount).toBe(1)
		expect(observerObserve).toHaveBeenCalledTimes(2)
		observerCallback?.([resizeEntry(elements[1])], {} as ResizeObserver)
		expect(first.resize).not.toHaveBeenCalled()
		expect(second.resize).toHaveBeenCalledOnce()
		expect(firstElementResize).not.toHaveBeenCalled()
		expect(secondElementResize).toHaveBeenCalledOnce()

		window.dispatchEvent(new Event('resize'))
		expect(first.resize).toHaveBeenCalledOnce()
		expect(second.resize).toHaveBeenCalledTimes(2)

		await act(async () => root.render(null))
		expect(observerUnobserve).toHaveBeenCalledTimes(2)
		expect(observerDisconnect).toHaveBeenCalledOnce()
	})

	test('an observed chart still at its drawn size is not laid out again, but a window resize still redraws it', async () => {
		const instance = fakeChart({ box: [320, 180], drawn: [320, 180] })
		const onElementResize = vi.fn()
		await act(async () =>
			root.render(<ChartHarness instance={instance} observeElement onElementResize={onElementResize} />)
		)
		const element = container.querySelector('div')!
		vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 320, height: 180 } as DOMRect)

		// The observer's first report, right after the chart's first render.
		observerCallback?.([resizeEntry(element)], {} as ResizeObserver)
		expect(instance.resize).not.toHaveBeenCalled()
		expect(onElementResize).toHaveBeenCalledOnce()

		// A device-pixel-ratio change keeps the box size and arrives only as a window resize.
		window.dispatchEvent(new Event('resize'))
		expect(instance.resize).toHaveBeenCalledOnce()
	})

	test('waits to resize an observed chart until its hidden container becomes visible', async () => {
		const instance = fakeChart()
		const onElementResize = vi.fn()
		const onElementVisibilityChange = vi.fn()
		await act(async () =>
			root.render(
				<ChartHarness
					instance={instance}
					observeElement
					onElementResize={onElementResize}
					onElementVisibilityChange={onElementVisibilityChange}
				/>
			)
		)
		const element = container.querySelector('div')!

		observerCallback?.([resizeEntry(element, 0, 180)], {} as ResizeObserver)
		expect(instance.resize).not.toHaveBeenCalled()
		expect(onElementResize).not.toHaveBeenCalled()
		expect(onElementVisibilityChange).toHaveBeenLastCalledWith(false)

		element.remove()
		observerCallback?.([resizeEntry(element, 320, 180)], {} as ResizeObserver)
		expect(instance.resize).not.toHaveBeenCalled()
		expect(onElementResize).not.toHaveBeenCalled()
		expect(onElementVisibilityChange).toHaveBeenCalledTimes(2)
		expect(onElementVisibilityChange).toHaveBeenLastCalledWith(false)

		container.appendChild(element)
		observerCallback?.([resizeEntry(element, 320, 180)], {} as ResizeObserver)
		expect(instance.resize).toHaveBeenCalledOnce()
		expect(onElementResize).toHaveBeenCalledOnce()
		expect(onElementVisibilityChange).toHaveBeenLastCalledWith(true)
	})

	test('globally resizes visible observed charts but skips hidden containers', async () => {
		const instance = fakeChart()
		await act(async () => root.render(<ChartHarness instance={instance} observeElement />))
		const element = container.querySelector('div')!
		const getBounds = vi.spyOn(element, 'getBoundingClientRect')

		getBounds.mockReturnValue({ width: 0, height: 180 } as DOMRect)
		window.dispatchEvent(new Event('resize'))
		expect(instance.resize).not.toHaveBeenCalled()

		getBounds.mockReturnValue({ width: 320, height: 180 } as DOMRect)
		window.dispatchEvent(new Event('resize'))
		expect(instance.resize).toHaveBeenCalledOnce()
	})

	test('moves observation to a chart element recreated after an empty render', async () => {
		const instance = fakeChart()
		await act(async () => root.render(<ChartHarness instance={instance} observeElement />))
		const firstElement = container.querySelector('div')!
		expect(observerObserve).toHaveBeenLastCalledWith(firstElement)
		await act(async () => root.render(<ChartHarness instance={instance} observeElement />))
		expect(observerObserve).toHaveBeenCalledOnce()
		expect(observerUnobserve).not.toHaveBeenCalled()

		await act(async () => root.render(<ChartHarness instance={instance} observeElement showElement={false} />))
		expect(observerUnobserve).toHaveBeenLastCalledWith(firstElement)

		await act(async () => root.render(<ChartHarness instance={instance} observeElement />))
		const nextElement = container.querySelector('div')!
		expect(nextElement).not.toBe(firstElement)
		expect(observerObserve).toHaveBeenLastCalledWith(nextElement)

		observerCallback?.([resizeEntry(firstElement)], {} as ResizeObserver)
		expect(instance.resize).not.toHaveBeenCalled()
		observerCallback?.([resizeEntry(nextElement)], {} as ResizeObserver)
		expect(instance.resize).toHaveBeenCalledOnce()
	})

	test('skips disposed instances', async () => {
		const instance = fakeChart({ disposed: true })
		await act(async () => root.render(<ChartHarness instance={instance} />))

		window.dispatchEvent(new Event('resize'))

		expect(instance.resize).not.toHaveBeenCalled()
	})
})
