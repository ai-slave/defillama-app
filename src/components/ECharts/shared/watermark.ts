import { createContext, useContext } from 'react'
/** DefiLlama logo watermark for an ECharts `graphic` option. */
export function buildWatermarkGraphic(isDark: boolean, height = 40) {
	return {
		type: 'image',
		zlevel: 10,
		z: 999,
		silent: true,
		left: 'center',
		top: 'middle',
		style: {
			image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
			width: Math.round((389 / 133) * height),
			height,
			opacity: 0.3
		}
	}
}

export type ChartWatermarkPlacement = 'canvas' | 'export-only'
export const ChartWatermarkContext = createContext<ChartWatermarkPlacement>('canvas')
export function useCanvasWatermarkEnabled() {
	return useContext(ChartWatermarkContext) === 'canvas'
}
export const DEFILLAMA_WATERMARK_IMAGE_PREFIX = '/assets/defillama-'
export function isWatermarkGraphicElement(element: unknown): boolean {
	if (!element || typeof element !== 'object' || !('style' in element)) return false
	const style = element.style
	return (
		!!style &&
		typeof style === 'object' &&
		'image' in style &&
		typeof style.image === 'string' &&
		style.image.startsWith(DEFILLAMA_WATERMARK_IMAGE_PREFIX)
	)
}
