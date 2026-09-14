import { createContext, useContext } from 'react'

export type ChartMotionMode = 'default' | 'draw'

export const CHART_DRAW_DURATION = 700
export const CHART_DRAW_THRESHOLD = 200_000

export const ChartMotionContext = createContext<ChartMotionMode>('default')

export function useChartMotion(): ChartMotionMode {
	return useContext(ChartMotionContext)
}

export interface ChartEnterAnimationOptions {
	animation?: boolean
	animationThreshold?: number
	animationDuration?: number
	animationEasing?: 'quarticOut'
}

export function enterAnimationOptions(
	mode: ChartMotionMode,
	hasAnimated: boolean,
	reducedMotion: boolean,
	duration: number = CHART_DRAW_DURATION
): ChartEnterAnimationOptions {
	if (mode === 'default') return {}
	if (reducedMotion) return { animation: false }
	if (hasAnimated) return { animationDuration: 0 }
	return {
		animation: true,
		animationThreshold: CHART_DRAW_THRESHOLD,
		animationDuration: duration,
		animationEasing: 'quarticOut'
	}
}
