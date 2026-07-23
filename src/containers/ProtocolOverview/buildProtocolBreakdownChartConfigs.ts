import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'

export function buildProtocolBreakdownChartConfigs({
	seriesNames,
	dimensions,
	type,
	colors,
	stack,
	hideAreaStyle = false
}: {
	seriesNames: string[]
	dimensions?: Array<string | number>
	type: MultiSeriesChartSeriesConfig['type']
	colors?: Record<string, string>
	stack?: string
	hideAreaStyle?: boolean
}): MultiSeriesChartSeriesConfig[] {
	const dimensionIndex = dimensions ? new Map(dimensions.map((name, index) => [name, index])) : null
	const charts = new Array<MultiSeriesChartSeriesConfig>(seriesNames.length)
	for (let i = 0; i < seriesNames.length; i++) {
		const name = seriesNames[i]
		charts[i] = {
			type,
			name,
			encode: { x: 0, y: dimensionIndex?.get(name) ?? i + 1 },
			...(colors?.[name] ? { color: colors[name] } : {}),
			...(stack ? { stack } : {}),
			...(type === 'line' && hideAreaStyle ? { hideAreaStyle: true } : {})
		}
	}
	return charts
}
