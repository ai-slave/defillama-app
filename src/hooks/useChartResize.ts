import type * as echarts from 'echarts/core'
import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'

type ChartInstanceRef = RefObject<echarts.ECharts | null>
type ChartElementRef = RefObject<Element | null>
type ChartElementRegistration = {
	instanceRef: ChartInstanceRef
	onResize?: () => void
}

const chartInstanceRefs = new Set<ChartInstanceRef>()
const observedChartInstanceRefs = new Set<ChartInstanceRef>()
const chartRegistrationsByElement = new Map<Element, ChartElementRegistration>()
let chartElementResizeObserver: ResizeObserver | null = null

function resizeChart(instanceRef: ChartInstanceRef) {
	const instance = instanceRef.current
	if (!instance || instance.isDisposed()) return
	instance.resize()
}

function resizeCharts() {
	for (const instanceRef of chartInstanceRefs) {
		resizeChart(instanceRef)
	}
}

function resizeChartsWithoutObservedElements() {
	for (const instanceRef of chartInstanceRefs) {
		if (!observedChartInstanceRefs.has(instanceRef)) resizeChart(instanceRef)
	}
}

function addGlobalResizeListeners() {
	if (chartInstanceRefs.size !== 1) return
	window.addEventListener('resize', resizeChartsWithoutObservedElements)
	window.addEventListener('chartResize', resizeCharts)
}

function removeGlobalResizeListeners() {
	if (chartInstanceRefs.size !== 0) return
	window.removeEventListener('resize', resizeChartsWithoutObservedElements)
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
	observedChartInstanceRefs.add(instanceRef)
	chartRegistrationsByElement.set(element, { instanceRef, onResize })
	chartElementResizeObserver.observe(element)
}

function unobserveChartElement(instanceRef: ChartInstanceRef, element: Element) {
	observedChartInstanceRefs.delete(instanceRef)
	chartRegistrationsByElement.delete(element)
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
		chartInstanceRefs.add(instanceRef)
		addGlobalResizeListeners()
		return () => {
			const observedElement = observedElementRef.current
			if (observedElement) {
				unobserveChartElement(instanceRef, observedElement)
				observedElementRef.current = null
			}
			chartInstanceRefs.delete(instanceRef)
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
