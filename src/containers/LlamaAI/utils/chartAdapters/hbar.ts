import { chartColor } from '~/constants/colors'
import { isChartDataRow, type ChartConfiguration, type ChartDataSeries } from '~/containers/LlamaAI/chartTypes'
import { buildLogoByCategory, parseStringNumber } from '~/containers/LlamaAI/utils/chartAdapters/shared'

export interface HBarGroupedSeries {
	name: string
	values: Array<number>
	color: string
}

export interface AdaptedHBarChartData {
	chartType: 'hbar'
	data: Array<[string | number, number]>
	props: {
		height: string
		valueSymbol: string
		colors?: Array<string>
		logos?: Array<string>
		series?: Array<HBarGroupedSeries>
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
		// per-bar colour ranking look below.
		if (config.series.length > 1) {
			const xField = primarySeries.dataMapping.xField
			const logoByCategory = buildLogoByCategory(config.axes.x)
			const categories: Array<string> = []
			const categoryIndex = new Map<string, number>()
			for (const row of rawData) {
				if (!isChartDataRow(row)) continue
				const category = String(row[xField] ?? 'Unknown')
				if (!categoryIndex.has(category)) {
					categoryIndex.set(category, categories.length)
					categories.push(category)
				}
			}
			const runtimeSeries: Array<{ config: ChartConfiguration['series'][number]; output: HBarGroupedSeries }> = []
			for (const [seriesIndex, seriesConfig] of config.series.entries()) {
				runtimeSeries.push({
					config: seriesConfig,
					output: {
						name: seriesConfig.name,
						values: new Array<number>(categories.length).fill(0),
						color: seriesConfig.styling.color || chartColor(seriesIndex)
					}
				})
			}
			for (const row of rawData) {
				if (!isChartDataRow(row)) continue
				const index = categoryIndex.get(String(row[xField] ?? 'Unknown'))
				if (index == null) continue
				for (const { config: seriesConfig, output } of runtimeSeries) {
					const filter = seriesConfig.dataMapping.entityFilter
					if (filter && !matchesEntityFilter(row[filter.field], filter.value)) continue
					output.values[index] = parseStringNumber(row[seriesConfig.dataMapping.yField])
				}
			}
			const series = runtimeSeries.map(({ output }) => output)
			const logos = logoByCategory ? categories.map((c) => logoByCategory.get(c.toLowerCase()) ?? '') : undefined
			const completeLogos = logos?.every(Boolean) ? logos : undefined
			const data: Array<[string, number]> = []
			const primaryOutput = runtimeSeries[0]?.output
			if (!primaryOutput) throw new Error('No series configuration found')
			for (const [index, category] of categories.entries()) {
				data.push([category, primaryOutput.values[index] ?? 0])
			}
			return {
				chartType: 'hbar',
				data,
				props: {
					height: '360px',
					valueSymbol: config.valueSymbol ?? '',
					series,
					...(completeLogos && { logos: completeLogos }),
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
		const logos: Array<string> | undefined = logoByCategory ? [] : undefined
		for (const row of rawData) {
			if (!isChartDataRow(row)) continue
			const category = row[primarySeries.dataMapping.xField] ?? 'Unknown'
			const value = parseStringNumber(row[primarySeries.dataMapping.yField])
			chartData.push([String(category), value])
			if (logos && logoByCategory) logos.push(logoByCategory.get(String(category).toLowerCase()) ?? '')
		}
		const completeLogos = logos?.every(Boolean) ? logos : undefined

		// A palette colour per bar by rank; honor an explicit per-category override from the editor.
		const colors: Array<string> = []
		for (const [index, [category]] of chartData.entries()) {
			colors.push(config.seriesColors?.[category] ?? chartColor(index))
		}

		return {
			chartType: 'hbar',
			data: chartData,
			props: {
				height: '360px',
				valueSymbol: config.valueSymbol ?? '',
				colors,
				...(completeLogos && { logos: completeLogos }),
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
			title: config.title || 'Chart error',
			description: "Couldn't render the horizontal bar chart.",
			defaultExportKind: 'hbar'
		}
	}
}
