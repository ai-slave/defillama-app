import type { ChartConfiguration, ChartDataSeries } from '~/containers/LlamaAI/types'
import { buildLogoByCategory, parseStringNumber } from '~/containers/LlamaAI/utils/chartAdapters/shared'
import { getNDistinctColors } from '~/utils'

export interface HBarGroupedSeries {
	name: string
	values: number[]
	color: string
}

export interface AdaptedHBarChartData {
	chartType: 'hbar'
	data: Array<[string | number, number]>
	props: {
		height: string
		valueSymbol: string
		colors?: string[]
		logos?: string[]
		series?: HBarGroupedSeries[]
		valueAxisMin?: number | 'dataMin'
		valueAxisMax?: number | 'dataMax'
		valueAxisInterval?: number
	}
	title: string
	description: string
	defaultExportKind: 'hbar'
}

// Mirror cartesian's entityFilter comparison (string-insensitive + numeric coercion) so a series
// filtered by a numeric column still matches its rows.
function matchesEntityFilter(rowValue: unknown, value: string | number): boolean {
	if (typeof rowValue === 'string' && typeof value === 'string') return rowValue.toLowerCase() === value.toLowerCase()
	if (rowValue === value) return true
	if (rowValue == null || value == null) return false
	return String(rowValue).toLowerCase() === String(value).toLowerCase()
}

// hbar renders the value axis horizontally (ECharts x-axis), so min/max/interval that the editor
// sets on the config's value axis (yAxes[0]) are forwarded to the x-axis of HBarChart.
function valueAxisControls(config: ChartConfiguration) {
	const a = config.axes?.yAxes?.[0]
	return {
		...(a?.min !== undefined && { valueAxisMin: a.min }),
		...(a?.max !== undefined && { valueAxisMax: a.max }),
		...(a?.interval !== undefined && { valueAxisInterval: a.interval })
	}
}

export function adaptHBarChartData(config: ChartConfiguration, rawData: ChartDataSeries): AdaptedHBarChartData {
	try {
		if (!rawData || rawData.length === 0) throw new Error('No data provided')

		const primarySeries = config.series[0]
		if (!primarySeries) throw new Error('No series configuration found')

		// Multi-series hbar → grouped bars (two+ bars per category). Single-series keeps the
		// per-bar distinct-color ranking look below.
		if (config.series.length > 1) {
			const xField = primarySeries.dataMapping.xField
			const logoByCategory = buildLogoByCategory(config.axes.x)
			const categories: string[] = []
			const categoryIndex = new Map<string, number>()
			for (const row of rawData) {
				const category = String((row as Record<string, unknown>)[xField] ?? 'Unknown')
				if (!categoryIndex.has(category)) {
					categoryIndex.set(category, categories.length)
					categories.push(category)
				}
			}
			const palette = getNDistinctColors(config.series.length)
			const series = new Array<HBarGroupedSeries>(config.series.length)
			for (let seriesIndex = 0; seriesIndex < config.series.length; seriesIndex++) {
				const seriesConfig = config.series[seriesIndex]
				series[seriesIndex] = {
					name: seriesConfig.name,
					values: new Array<number>(categories.length).fill(0),
					color: seriesConfig.styling?.color || palette[seriesIndex]
				}
			}
			for (const row of rawData) {
				const record = row as Record<string, unknown>
				const index = categoryIndex.get(String(record[xField] ?? 'Unknown'))
				if (index == null) continue
				for (let seriesIndex = 0; seriesIndex < config.series.length; seriesIndex++) {
					const seriesConfig = config.series[seriesIndex]
					const filter = seriesConfig.dataMapping.entityFilter
					if (filter && !matchesEntityFilter(record[filter.field], filter.value)) continue
					series[seriesIndex].values[index] = parseStringNumber(record[seriesConfig.dataMapping.yField])
				}
			}
			const logos = logoByCategory ? categories.map((c) => logoByCategory.get(c.toLowerCase()) ?? '') : undefined
			const data = new Array<[string, number]>(categories.length)
			for (let index = 0; index < categories.length; index++) {
				data[index] = [categories[index], series[0].values[index]]
			}
			return {
				chartType: 'hbar',
				data,
				props: {
					height: '360px',
					valueSymbol: config.valueSymbol ?? '',
					series,
					...(logos && { logos }),
					...valueAxisControls(config)
				},
				title: config.title,
				description: config.description,
				defaultExportKind: 'hbar'
			}
		}

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

		// Distinct color per bar by default; honor an explicit per-category override from the editor.
		const distinct = getNDistinctColors(chartData.length)
		const colors = chartData.map(([category], i) => config.seriesColors?.[category] ?? distinct[i])

		return {
			chartType: 'hbar',
			data: chartData,
			props: {
				height: '360px',
				valueSymbol: config.valueSymbol ?? '',
				colors,
				...(logos && { logos }),
				...valueAxisControls(config)
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
