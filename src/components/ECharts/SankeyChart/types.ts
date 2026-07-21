import type * as echarts from 'echarts/core'

export interface ISankeyChartProps {
	title?: string
	headingAs?: 'h1' | 'h2' | 'h3'
	height?: string
	nodes: Array<{
		name: string
		color?: string
		depth?: number
		description?: string
		displayValue?: number | string
		percentageLabel?: string
	}>
	links: Array<{ source: string; target: string; value: number; color?: string }>
	nodeColors?: Record<string, string>
	valueSymbol?: string
	nodeAlign?: 'left' | 'right' | 'justify'
	orient?: 'horizontal' | 'vertical'
	onReady?: (instance: echarts.ECharts | null) => void
	enableImageExport?: boolean
	imageExportFilename?: string
	imageExportTitle?: string
}
