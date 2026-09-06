import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'

export function buildProtocolBreakdownChartConfigs({
	seriesNames,
	dimensions,
	type,
	colors,
	stack,
	hideAreaStyle = false
}: {
	seriesNames: Array<string>
	dimensions?: Array<string | number>
	type: MultiSeriesChartSeriesConfig['type']
	colors?: Record<string, string>
	stack?: string
	hideAreaStyle?: boolean
}): Array<MultiSeriesChartSeriesConfig> {
	const dimensionIndex = dimensions ? new Map(dimensions.map((name, index) => [name, index])) : null
	const charts = new Array<MultiSeriesChartSeriesConfig>(seriesNames.length)
	let index = 0
	for (const name of seriesNames) {
		const color = colors?.[name]
		charts[index] = {
			type,
			name,
			encode: { x: 0, y: dimensionIndex?.get(name) ?? index + 1 },
			...(color ? { color } : {}),
			...(stack ? { stack } : {}),
			...(type === 'line' && hideAreaStyle ? { hideAreaStyle: true } : {})
		}
		index++
	}
	return charts
}
