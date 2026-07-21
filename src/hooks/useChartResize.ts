import type * as echarts from 'echarts/core'
import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'

type ChartInstanceRef = RefObject<echarts.ECharts | null>
type ChartElementRef = RefObject<Element | null>
type ChartElementRegistration = {
	instanceRef: ChartInstanceRef
	onResize?: () => void
}

// A null element identifies charts that only use the global resize dispatcher.
const chartElementsByInstanceRef = new Map<ChartInstanceRef, Element | null>()
const chartRegistrationsByElement = new Map<Element, ChartElementRegistration>()
let chartElementResizeObserver: ResizeObserver | null = null

function resizeChart(instanceRef: ChartInstanceRef) {
	const instance = instanceRef.current
	if (!instance || instance.isDisposed()) return
	instance.resize()
}

function resizeCharts() {
	for (const [instanceRef, element] of chartElementsByInstanceRef) {
		if (element) {
			if (!element.isConnected) continue
			const bounds = element.getBoundingClientRect()
			if (bounds.width <= 0 || bounds.height <= 0) continue
		}
		resizeChart(instanceRef)
	}
}

function addGlobalResizeListeners() {
	if (chartElementsByInstanceRef.size !== 1) return
	// ResizeObserver handles layout changes, while window.resize also covers a
	// device-pixel-ratio change where the CSS box itself does not change.
	window.addEventListener('resize', resizeCharts)
	window.addEventListener('chartResize', resizeCharts)
}

function removeGlobalResizeListeners() {
	if (chartElementsByInstanceRef.size !== 0) return
	window.removeEventListener('resize', resizeCharts)
	window.removeEventListener('chartResize', resizeCharts)
}

function observeChartElement(instanceRef: ChartInstanceRef, element: Element, onResize?: () => void) {
	if (!chartElementResizeObserver) {
		chartElementResizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const registration = chartRegistrationsByElement.get(entry.target)
				if (!registration) continue
				// Enterprise dashboard tabs remain mounted under `display: none`. Resizing a
				// zero-size ECharts canvas can reach partially unavailable renderer state.
				// ResizeObserver emits another entry with real dimensions when the tab is shown.
				if (!entry.target.isConnected || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) continue
				resizeChart(registration.instanceRef)
				registration.onResize?.()
			}
		})
	}
	chartRegistrationsByElement.set(element, { instanceRef, onResize })
	chartElementsByInstanceRef.set(instanceRef, element)
	chartElementResizeObserver.observe(element)
}

function unobserveChartElement(instanceRef: ChartInstanceRef, element: Element) {
	chartRegistrationsByElement.delete(element)
	if (chartElementsByInstanceRef.get(instanceRef) === element) chartElementsByInstanceRef.set(instanceRef, null)
	chartElementResizeObserver?.unobserve(element)
	if (chartRegistrationsByElement.size === 0) {
		chartElementResizeObserver?.disconnect()
		chartElementResizeObserver = null
	}
}

/**
 * Registers a chart with the shared resize dispatcher. All mounted charts use one browser
 * `resize` listener and one app-level `chartResize` listener instead of one pair per chart.
 *
 * @param instanceRef - A ref containing the ECharts instance to resize
 * @param elementRef - The chart element to observe for layout-driven size changes
 * @param onElementResize - Optional stable callback for pixel-positioned overlays after the chart resizes
 *
 * @example
 * ```tsx
 * function MyChart({ data }) {
 *   const chartRef = useRef<echarts.ECharts | null>(null)
 *
 *   // Resize listener is stable - won't re-attach when data changes
 *   useChartResize(chartRef, ref)
 *
 *   useEffect(() => {
 *     const instance = echarts.init(ref.current, null, { renderer: 'canvas' })
 *     chartRef.current = instance
 *     return () => {
 *       chartRef.current = null
 *       instance.dispose()
 *     }
 *   }, [])
 *
 *   useEffect(() => {
 *     chartRef.current?.setOption(getOptions(data))
 *   }, [data])
 * }
 * ```
 */
export function useChartResize(
	instanceRef: ChartInstanceRef,
	elementRef?: ChartElementRef,
	onElementResize?: () => void
) {
	const observedElementRef = useRef<Element | null>(null)

	useEffect(() => {
		chartElementsByInstanceRef.set(instanceRef, null)
		addGlobalResizeListeners()
		return () => {
			const observedElement = observedElementRef.current
			if (observedElement) {
				unobserveChartElement(instanceRef, observedElement)
				observedElementRef.current = null
			}
			chartElementsByInstanceRef.delete(instanceRef)
			removeGlobalResizeListeners()
		}
	}, [instanceRef])

	// Ref objects are stable when React replaces their DOM node, so synchronize the
	// observed target after every render and only touch ResizeObserver when it changed.
	useEffect(() => {
		const observedElement = observedElementRef.current
		const nextElement = elementRef?.current ?? null
		if (observedElement !== nextElement) {
			if (observedElement) unobserveChartElement(instanceRef, observedElement)
			if (nextElement) observeChartElement(instanceRef, nextElement, onElementResize)
			observedElementRef.current = nextElement
		} else if (nextElement) {
			const registration = chartRegistrationsByElement.get(nextElement)
			if (registration?.instanceRef !== instanceRef || registration.onResize !== onElementResize) {
				chartRegistrationsByElement.set(nextElement, { instanceRef, onResize: onElementResize })
			}
		}
	})
}
