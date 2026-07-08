import type * as echarts from 'echarts/core'
import type { RefObject } from 'react'
import { useEffect } from 'react'

/**
 * Manages chart resize event listener with stable subscription.
 * The resize listener is attached once and never re-subscribes,
 * regardless of chart instance changes.
 *
 * @param instanceRef - A ref containing the ECharts instance to resize
 *
 * @example
 * ```tsx
 * function MyChart({ data }) {
 *   const chartRef = useRef<echarts.ECharts | null>(null)
 *
 *   // Resize listener is stable - won't re-attach when data changes
 *   useChartResize(chartRef)
 *
 *   useEffect(() => {
 *     const instance = echarts.init(ref.current, null, { renderer: 'canvas' })
 *     chartRef.current = instance
 *     instance.setOption(getOptions(data))
 *     return () => {
 *       chartRef.current = null
 *       instance.dispose()
 *     }
 *   }, [data])
 * }
 * ```
 */
export function useChartResize(instanceRef: RefObject<echarts.ECharts | null>) {
	useEffect(() => {
		let rafId: number | null = null
		const resize = () => {
			if (rafId != null) return
			rafId = requestAnimationFrame(() => {
				rafId = null
				const instance = instanceRef.current
				if (!instance || instance.isDisposed()) return
				instance.resize()
			})
		}

		// Charts can be sized by their container (flex-1 panels), not just the
		// viewport — observe the chart's own element once the instance exists.
		// The element is stable across re-inits (init reuses the same node), so
		// a one-time lazy attach is sufficient.
		let observer: ResizeObserver | null = null
		let attachRafId: number | null = null
		let attachAttempts = 0
		const attachObserver = () => {
			const dom = instanceRef.current?.getDom()
			if (dom && typeof ResizeObserver !== 'undefined') {
				observer = new ResizeObserver(resize)
				observer.observe(dom)
				return
			}
			if (++attachAttempts < 120) attachRafId = requestAnimationFrame(attachObserver)
		}
		attachRafId = requestAnimationFrame(attachObserver)

		window.addEventListener('resize', resize)
		window.addEventListener('chartResize', resize)
		return () => {
			if (rafId != null) cancelAnimationFrame(rafId)
			if (attachRafId != null) cancelAnimationFrame(attachRafId)
			observer?.disconnect()
			window.removeEventListener('resize', resize)
			window.removeEventListener('chartResize', resize)
		}
	}, [instanceRef])
}
