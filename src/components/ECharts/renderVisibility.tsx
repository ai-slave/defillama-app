import type { ECharts, EChartsOption } from 'echarts'
import { createContext, type ComponentType, type ReactNode, useCallback, useContext, useMemo, useRef } from 'react'

const EChartsRenderVisibilityContext = createContext(true)

export function EChartsRenderVisibilityProvider({ children, visible }: { children: ReactNode; visible: boolean }) {
	return <EChartsRenderVisibilityContext.Provider value={visible}>{children}</EChartsRenderVisibilityContext.Provider>
}

interface EChartsLifecycle {
	capture: (instance: ECharts) => void
	restore: (instance: ECharts) => void
	hasEnteredRef: { current: boolean }
}

const EMPTY_LIFECYCLE: EChartsLifecycle = {
	capture: () => {},
	restore: () => {},
	hasEnteredRef: { current: false }
}
const EChartsLifecycleContext = createContext<EChartsLifecycle>(EMPTY_LIFECYCLE)

export function usePersistentEChartsLifecycle() {
	return useContext(EChartsLifecycleContext)
}

export function withEChartsRenderVisibility<Props extends object>(Renderer: ComponentType<Props>) {
	function VisibilityBoundary(props: Props) {
		const visible = useContext(EChartsRenderVisibilityContext)
		const interactiveStateRef = useRef<EChartsOption | null>(null)
		const hasEnteredRef = useRef(false)

		const capture = useCallback((instance: ECharts) => {
			if (instance.isDisposed()) return
			const option = instance.getOption()
			const interactiveState: EChartsOption = {}
			if (option.legend != null) interactiveState.legend = option.legend
			if (option.dataZoom != null) interactiveState.dataZoom = option.dataZoom
			interactiveStateRef.current = interactiveState
		}, [])

		const restore = useCallback((instance: ECharts) => {
			const state = interactiveStateRef.current
			if (!state || (state.legend == null && state.dataZoom == null)) return
			requestAnimationFrame(() => {
				if (!instance.isDisposed()) instance.setOption(state)
			})
		}, [])

		const lifecycle = useMemo(() => ({ capture, restore, hasEnteredRef }), [capture, restore])
		return (
			<EChartsLifecycleContext.Provider value={lifecycle}>
				{visible ? <Renderer {...props} /> : null}
			</EChartsLifecycleContext.Provider>
		)
	}

	VisibilityBoundary.displayName = `WithEChartsRenderVisibility(${Renderer.displayName ?? Renderer.name})`
	return VisibilityBoundary
}
