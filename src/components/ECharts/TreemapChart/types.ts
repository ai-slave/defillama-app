import type * as echarts from 'echarts/core'

export type TreemapValue = [size: number, secondary: number | null, color: number | null, gradient?: number]

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
	colorMode?: 'value' | 'categorical'
	height?: string
	onReady?: (instance: echarts.ECharts | null) => void
	showRootLabel?: boolean
	valueLabel?: string
	valueSymbol?: string
}
