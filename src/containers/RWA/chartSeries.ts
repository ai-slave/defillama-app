import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import {
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	sortRwaChartSeriesLabels,
	type RWAPositionalChartDataset
} from './chartDataset'

/** The site's time series: Total lines first without a fill, then the groups with a soft fill. */
export function buildRwaTimeSeriesCharts(dataset: RWAPositionalChartDataset): Array<MultiSeriesChartSeriesConfig> {
	const seriesDimensions = sortRwaChartSeriesLabels(dataset.dimensions.filter((dimension) => dimension !== 'timestamp'))
	const colorSlots = getRwaChartSeriesColorSlots(seriesDimensions)

	return seriesDimensions.map((name) => {
		const colorSlot = colorSlots[name]
		if (colorSlot === undefined) throw new Error(`Missing RWA chart color slot for "${name}"`)
		const isReservedSeries = getRwaReservedSeriesColorSlot(name) !== null
		const isTotalSeries = isRwaTotalSeriesLabel(name)

		return {
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
			color: CHART_COLORS[colorSlot % CHART_COLORS.length] ?? CHART_COLORS[0],
			...(isReservedSeries
				? {
						hideAreaStyle: true,
						...(isTotalSeries ? { excludeFromTooltipTotal: true } : {})
					}
				: {})
		}
	})
}

/** Volume is a bar per period, one stack per group, whose tooltip sums the groups. */
export function buildRwaPerpsChartSeries(dataset: RWAPositionalChartDataset): Array<MultiSeriesChartSeriesConfig> {
	return dataset.dimensions.slice(1).map((name, index) => ({
		name,
		type: 'bar',
		stack: 'A',
		large: false,
		encode: { x: 'timestamp', y: name },
		color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]
	}))
}
