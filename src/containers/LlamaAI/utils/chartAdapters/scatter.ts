import type { IScatterChartProps, ScatterTooltipParams } from '~/components/ECharts/ScatterChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { formatChartValue } from '~/components/ECharts/shared/formatters'
import { isChartDataRow, type ChartConfiguration, type ChartDataSeries } from '~/containers/LlamaAI/chartTypes'
import { parseFiniteNumber } from '~/containers/LlamaAI/utils/chartAdapters/shared'

export interface AdaptedScatterChartData {
	chartType: 'scatter'
	props: Partial<IScatterChartProps>
	title: string
	description: string
	defaultExportKind: 'scatter'
}

export function adaptScatterChartData(config: ChartConfiguration, rawData: ChartDataSeries): AdaptedScatterChartData {
	try {
		if (!rawData || rawData.length === 0) throw new Error('No data provided')

		const primarySeries = config.series[0]
		if (!primarySeries) throw new Error('No series configuration found')

		const xField = primarySeries.dataMapping.xField
		const yField = primarySeries.dataMapping.yField
		const entityField = primarySeries.dataMapping.entityFilter?.field || 'protocol'
		const entityType = entityField === 'chain' ? 'chain' : 'protocol'

		const scatterData: Array<[number, number, string, string]> = []
		for (const row of rawData) {
			if (!isChartDataRow(row)) continue
			const xValue = parseFiniteNumber(row[xField])
			const yValue = parseFiniteNumber(row[yField])
			// Missing legacy scatter coordinates must be dropped; coercing them to 0
			// creates phantom origin points in restored pre-keyed chart sessions.
			if (xValue == null || yValue == null) continue
			const entityName = String(row[entityField] ?? 'Unknown')
			const entitySlug = entityName.toLowerCase().replace(/\s+/g, '-')
			scatterData.push([xValue, yValue, entityName, entitySlug])
		}

		const xAxisLabel = config.axes.x.label || xField
		const yAxisLabel = config.axes.yAxes[0]?.label || yField
		const xAxisSymbol = config.axes.x.valueSymbol ?? config.valueSymbol ?? ''
		const yAxisSymbol = config.axes.yAxes[0]?.valueSymbol ?? config.valueSymbol ?? ''

		return {
			chartType: 'scatter',
			props: {
				chartData: scatterData,
				xAxisLabel,
				yAxisLabel,
				valueSymbol: config.valueSymbol || '',
				height: '360px',
				entityType,
				tooltipFormatter: (params: ScatterTooltipParams) => {
					if (params.value.length < 2) return ''
					const entityName = escapeHtml(String(params.value[2] ?? 'Unknown'))
					return `<strong>${entityName}</strong><br/>${escapeHtml(xAxisLabel)}: ${escapeHtml(formatChartValue(params.value[0], xAxisSymbol))}<br/>${escapeHtml(yAxisLabel)}: ${escapeHtml(formatChartValue(params.value[1], yAxisSymbol))}`
				}
			},
			title: config.title,
			description: config.description,
			defaultExportKind: 'scatter'
		}
	} catch (error) {
		console.error('ScatterChart adapter error:', error)
		return {
			chartType: 'scatter',
			props: { chartData: [], height: '360px' },
			title: config.title || 'Scatter chart error',
			description: "Couldn't render the scatter chart.",
			defaultExportKind: 'scatter'
		}
	}
}
