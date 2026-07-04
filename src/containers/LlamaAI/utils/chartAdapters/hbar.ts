import type { ChartConfiguration, ChartDataSeries } from '~/containers/LlamaAI/types'
import { buildLogoByCategory, parseStringNumber } from '~/containers/LlamaAI/utils/chartAdapters/shared'
import { getNDistinctColors } from '~/utils'

export interface AdaptedHBarChartData {
	chartType: 'hbar'
	data: Array<[string | number, number]>
	props: {
		height: string
		valueSymbol: string
		colors?: string[]
		logos?: string[]
	}
	title: string
	description: string
	defaultExportKind: 'hbar'
}

export function adaptHBarChartData(config: ChartConfiguration, rawData: ChartDataSeries): AdaptedHBarChartData {
	try {
		if (!rawData || rawData.length === 0) throw new Error('No data provided')

		const primarySeries = config.series[0]
		if (!primarySeries) throw new Error('No series configuration found')

		// matched by lowercased category value rather than row index so logos can't drift off their bars
		const logoByCategory = buildLogoByCategory(config.axes.x)
		const chartData: Array<[string, number]> = []
		const logos = logoByCategory ? [] : undefined
		for (let index = 0; index < rawData.length; index++) {
			const record = rawData[index] as Record<string, unknown>
			const category = record[primarySeries.dataMapping.xField] ?? 'Unknown'
			const value = parseStringNumber(record[primarySeries.dataMapping.yField])
			chartData.push([String(category), value])
			if (logos) logos.push(logoByCategory!.get(String(category).toLowerCase()) ?? '')
		}

		const colors = getNDistinctColors(chartData.length)

		return {
			chartType: 'hbar',
			data: chartData,
			props: {
				height: '360px',
				valueSymbol: config.valueSymbol ?? '',
				colors,
				...(logos && { logos })
			},
			title: config.title,
			description: config.description,
			defaultExportKind: 'hbar'
		}
	} catch (error) {
		console.error('HBar adapter error:', error)
		return {
			chartType: 'hbar',
			data: [],
			props: {
				height: '360px',
				valueSymbol: config.valueSymbol ?? ''
			},
			title: config.title || 'Chart Error',
			description: `Failed to render horizontal bar chart: ${error instanceof Error ? error.message : 'Unknown error'}`,
			defaultExportKind: 'hbar'
		}
	}
}
