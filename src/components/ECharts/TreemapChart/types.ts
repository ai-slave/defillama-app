import type * as echarts from 'echarts/core'

/** `change` is a percent change the RWA tooltip shows as the 1D return. */
export type TreemapValue = [size: number, secondary: number | null, color: number | null, change?: number | null]

export type TreemapNode = {
	name: string
	value: TreemapValue
	path?: string
	itemStyle?: { color?: string }
	children?: Array<TreemapNode>
}

/** 'flat': one level of tiles, each labeled with its name and `valueSymbol` value; no drill or roam. Sonic FeeM's
    rewards leaderboard draws through it, so a one-level share stays a treemap here rather than a page-local chart. */
export type TreemapVariant = 'narrative' | 'rwa' | 'flat'

export interface TreemapChartProps {
	treeData: Array<TreemapNode>
	variant: TreemapVariant
	/** 'value': each node brings its own `itemStyle.color` from `divergingColor`. 'categorical': the palette by rank. */
	colorMode?: 'value' | 'categorical'
	/** A fixed height. Left out, the chart fills its slot from a 360px floor (README → Size). */
	height?: string
	/** A min-h-* class that moves the 360px floor of a chart without `height`. */
	containerClassName?: string
	onReady?: (instance: echarts.ECharts | null) => void
	showRootLabel?: boolean
	valueLabel?: string
	valueSymbol?: string
}
