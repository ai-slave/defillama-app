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

export type TreemapVariant = 'narrative' | 'rwa'

export interface TreemapChartProps {
	treeData: Array<TreemapNode>
	variant: TreemapVariant
	/** 'value': each node brings its own `itemStyle.color` from `divergingColor`. 'categorical': the palette by rank. */
	colorMode?: 'value' | 'categorical'
	height?: string
	onReady?: (instance: echarts.ECharts | null) => void
	showRootLabel?: boolean
	valueLabel?: string
	valueSymbol?: string
}
