import { createChartRecord } from '~/components/ECharts/dynamicRow'
import type { IPieChartProps } from '~/components/ECharts/types'
import type { ChartConfiguration, ChartDataSeries } from '~/containers/LlamaAI/types'
import { getChartColor, oldBlue, parseStringNumber } from '~/containers/LlamaAI/utils/chartAdapters/shared'

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

		const aggregatedData = createChartRecord<number>()
		for (const row of rawData) {
			const record = row as Record<string, unknown>
			const entity = String(record[entityField] ?? 'Unknown')
			aggregatedData[entity] = (aggregatedData[entity] ?? 0) + parseStringNumber(record[valueField])
		}

		const pieData: Array<{ name: string; value: number }> = []
		for (const name in aggregatedData) pieData.push({ name, value: aggregatedData[name] })
		pieData.sort((a, b) => b.value - a.value)

		const stackColors = createChartRecord<string>()
		for (let index = 0; index < pieData.length; index++) {
			const name = pieData[index].name
			// Honor an explicit per-slice color from the config; fall back to the palette.
			stackColors[name] = config.seriesColors?.[name] ?? getChartColor(name, index, oldBlue)
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
			props: { title: 'Pie Chart Error', height: '360px' },
			title: config.title || 'Pie Chart Error',
			description: `Failed to render pie chart: ${error instanceof Error ? error.message : 'Unknown error'}`,
			defaultExportKind: 'pie'
		}
	}
}
