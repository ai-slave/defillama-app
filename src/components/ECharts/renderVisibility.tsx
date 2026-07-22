import type { ECharts, EChartsOption } from 'echarts'
import { createContext, type ComponentType, type ReactNode, useCallback, useContext, useMemo, useRef } from 'react'

const EChartsRenderVisibilityContext = createContext(true)

export function EChartsRenderVisibilityProvider({ children, visible }: { children: ReactNode; visible: boolean }) {
	return <EChartsRenderVisibilityContext.Provider value={visible}>{children}</EChartsRenderVisibilityContext.Provider>
}

interface InteractiveChartState {
	legend?: EChartsOption['legend']
	dataZoom?: EChartsOption['dataZoom']
}

interface EChartsLifecycle {
	capture: (instance: ECharts) => void
	restore: (instance: ECharts) => void
}

const EMPTY_LIFECYCLE: EChartsLifecycle = { capture: () => {}, restore: () => {} }
const EChartsLifecycleContext = createContext<EChartsLifecycle>(EMPTY_LIFECYCLE)

export function usePersistentEChartsLifecycle() {
	return useContext(EChartsLifecycleContext)
}

export function withEChartsRenderVisibility<Props extends object>(Renderer: ComponentType<Props>) {
	function VisibilityBoundary(props: Props) {
		const visible = useContext(EChartsRenderVisibilityContext)
		const interactiveStateRef = useRef<InteractiveChartState | null>(null)

		const capture = useCallback((instance: ECharts) => {
			if (instance.isDisposed()) return
			const option = instance.getOption()
			interactiveStateRef.current = {
				legend: option.legend,
				dataZoom: option.dataZoom
			}
		}, [])

		const restore = useCallback((instance: ECharts) => {
			const state = interactiveStateRef.current
			if (!state) return
			requestAnimationFrame(() => {
				if (!instance.isDisposed()) instance.setOption({ legend: state.legend, dataZoom: state.dataZoom })
			})
		}, [])

		const lifecycle = useMemo(() => ({ capture, restore }), [capture, restore])
		return (
			<EChartsLifecycleContext.Provider value={lifecycle}>
				{visible ? <Renderer {...props} /> : null}
			</EChartsLifecycleContext.Provider>
		)
	}

	VisibilityBoundary.displayName = `WithEChartsRenderVisibility(${Renderer.displayName ?? Renderer.name})`
	return VisibilityBoundary
}
