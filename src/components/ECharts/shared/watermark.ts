import type * as echarts from 'echarts/core'
import { createContext, useContext } from 'react'

const LOGO_ASPECT_RATIO = 389 / 133

export type WatermarkBox = { x: number; y: number; width: number; height: number }

/**
 * The logo's size for the area it marks: 14% of the area's height, kept between 20px and 40px, and no wider than
 * 60% of the area. A full-size chart reaches the 40px cap and a 150px chart gets 20px, so the mark keeps the same
 * share of every chart instead of covering small ones.
 */
export function watermarkSize(box: { width: number; height: number }) {
	const height = Math.min(40, Math.max(20, Math.round(box.height * 0.14)))
	const width = Math.round(LOGO_ASPECT_RATIO * height)
	const maxWidth = Math.round(box.width * 0.6)
	if (width <= maxWidth) return { width, height }
	return { width: maxWidth, height: Math.round(maxWidth / LOGO_ASPECT_RATIO) }
}

/**
 * DefiLlama logo centered on `box`. `under` draws it below the series, for charts whose marks leave most of the plot
 * empty; `over` draws it above, for treemaps, pies and bars whose opaque fills would hide it.
 */
export function buildWatermarkGraphic(isDark: boolean, box: WatermarkBox, layer: 'under' | 'over') {
	const { width, height } = watermarkSize(box)
	return {
		type: 'image' as const,
		id: 'defillama-watermark',
		silent: true,
		...(layer === 'over' ? { zlevel: 10, z: 999 } : { z: 0 }),
		left: Math.round(box.x + (box.width - width) / 2),
		top: Math.round(box.y + (box.height - height) / 2),
		style: {
			image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
			width,
			height,
			opacity: 0.3
		}
	}
}

// ECharts lays the plot out around its axis labels and exposes that box only through its private model API.
type PlotModelAccess = {
	getModel(): {
		getComponent(type: 'grid', index: number): { coordinateSystem: { getRect(): WatermarkBox } } | undefined
	}
}

function readPlotBox(instance: echarts.ECharts): WatermarkBox {
	const grid = (instance as unknown as PlotModelAccess).getModel().getComponent('grid', 0)
	if (!grid) return { x: 0, y: 0, width: instance.getWidth(), height: instance.getHeight() }
	const { x, y, width, height } = grid.coordinateSystem.getRect()
	return { x, y, width, height }
}

type PlacedWatermark = { isDark: boolean; layer: 'under' | 'over'; box: WatermarkBox | null }
const placedWatermarks = new WeakMap<echarts.ECharts, PlacedWatermark>()

function syncWatermark(instance: echarts.ECharts) {
	if (instance.isDisposed()) return
	const placed = placedWatermarks.get(instance)!
	const box = readPlotBox(instance)
	const last = placed.box
	if (last && last.x === box.x && last.y === box.y && last.width === box.width && last.height === box.height) return
	placed.box = box
	instance.setOption({ graphic: [buildWatermarkGraphic(placed.isDark, box, placed.layer)] }, { silent: true })
}

/**
 * The logo element for a chart's next `setOption`, centered on its plot: the first cartesian grid's plot area, or
 * the whole canvas for a chart without a grid. The plot box is only known after ECharts lays the chart out, so a
 * chart's first render draws no logo, and the logo is added once that render and its enter animation finish. It
 * moves whenever a later render or resize moves the plot. Placing it on `finished` instead of right after the
 * first render keeps the extra update from cutting the line-drawing animation short.
 */
export function chartWatermarkGraphic(
	instance: echarts.ECharts,
	isDark: boolean,
	layer: 'under' | 'over'
): Array<ReturnType<typeof buildWatermarkGraphic>> {
	const placed = placedWatermarks.get(instance)
	// `finished` can fire inside a setOption or resize, where ECharts refuses another setOption, so the logo moves in
	// a microtask: after that call returns and before the browser paints.
	if (!placed) instance.on('finished', () => queueMicrotask(() => syncWatermark(instance)))
	placedWatermarks.set(instance, { isDark, layer, box: placed?.box ?? null })
	return placed?.box ? [buildWatermarkGraphic(isDark, placed.box, layer)] : []
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
