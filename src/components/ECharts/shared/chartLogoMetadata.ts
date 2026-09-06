import type { ECharts } from 'echarts'

export type ChartLogoMetadata =
	| { kind: 'cartesian-x'; logos: Array<string>; categoryValues: Array<unknown> }
	| { kind: 'hbar'; logos: Array<string>; categories: Array<string> }

/**
 * Export code cannot recover HTML logo overlays from the canvas. Renderers attach
 * this small, typed metadata record so PNG export can redraw the same logos.
 */
export type EChartsWithLogoMetadata = ECharts & {
	__llamaChartLogos?: ChartLogoMetadata
}

export function setChartLogoMetadata(instance: ECharts, metadata: ChartLogoMetadata | undefined) {
	const chart = instance as EChartsWithLogoMetadata
	if (metadata) chart.__llamaChartLogos = metadata
	else delete chart.__llamaChartLogos
}

export function getChartLogoMetadata(instance: ECharts): ChartLogoMetadata | undefined {
	return (instance as EChartsWithLogoMetadata).__llamaChartLogos
}
