import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { chartColor } from '~/constants/colors'
import { isChartDataRow, type ChartConfiguration, type ChartDataSeries } from '~/containers/LlamaAI/chartTypes'
import { parseStringNumber } from '~/containers/LlamaAI/utils/chartAdapters/shared'

export interface AdaptedPieChartData {
	chartType: 'pie'
	props: Partial<IPieChartProps>
	title: string
	description: string
	defaultExportKind: 'pie'
}

export function adaptPieChartData(config: ChartConfiguration, rawData: ChartDataSeries): AdaptedPieChartData {
	try {
		if (!rawData || rawData.length === 0) throw new Error('No data provided')

		const primarySeries = config.series[0]
		if (!primarySeries) throw new Error('No series configuration found')

		const entityField = primarySeries.dataMapping.xField
		const valueField = primarySeries.dataMapping.yField

		const totalsByEntity = new Map<string, number>()
		for (const row of rawData) {
			if (!isChartDataRow(row)) continue
			const entity = String(row[entityField] ?? 'Unknown')
			totalsByEntity.set(entity, (totalsByEntity.get(entity) ?? 0) + parseStringNumber(row[valueField]))
		}

		const pieData = Array.from(totalsByEntity, ([name, value]) => ({ name, value }))
		pieData.sort((a, b) => b.value - a.value)

		const stackColors: Record<string, string> = {}
		for (const [index, point] of pieData.entries()) {
			const name = point.name
			// Honor an explicit per-slice color from the config; fall back to the palette.
			stackColors[name] = config.seriesColors?.[name] ?? chartColor(index)
		}

		return {
			chartType: 'pie',
			props: {
				title: config.title,
				chartData: pieData,
				height: '360px',
				stackColors,
				valueSymbol: config.valueSymbol ?? '',
				showLegend: true
			},
			title: config.title,
			description: config.description,
			defaultExportKind: 'pie'
		}
	} catch (error) {
		console.error('PieChart adapter error:', error)
		return {
			chartType: 'pie',
			props: { title: 'Pie chart error', height: '360px' },
			title: config.title || 'Pie chart error',
			description: `Failed to render pie chart: ${error instanceof Error ? error.message : 'Unknown error'}`,
			defaultExportKind: 'pie'
		}
	}
}
