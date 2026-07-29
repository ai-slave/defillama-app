import type { MultiSeriesYAxisOption } from '~/components/ECharts/MultiSeriesChart/types'
import { formatTooltipValue } from '~/components/ECharts/shared/formatters'
import { mergeDeep } from '~/components/ECharts/shared/merge'
import { formatCompactNumber } from '~/utils/numberFormat'
import type { ChainChartLabels } from './constants'

type AxisExtent = {
	min?: number
}

type AxisBuilderContext = {
	chartColors: Record<ChainChartLabels, string>
	chartsInSeries: Set<ChainChartLabels>
	themeText: string
}

type AxisConfig = {
	formatter?: (value: number, context: AxisBuilderContext) => string
	resolveColor?: (context: AxisBuilderContext) => string
}

// Add per-label offset overrides here if a chain metric needs extra y-axis spacing.
const CUSTOM_OFFSETS: Partial<Record<ChainChartLabels, number>> = {}

const DASHED_AXIS_LINE_STYLE = {
	type: [5, 10],
	dashOffset: 5
}

function getZeroBaselineYAxisMin(extent: AxisExtent) {
	return typeof extent.min === 'number' && extent.min < 0 ? extent.min : 0
}

const AXIS_CONFIG_BY_TYPE: Partial<Record<ChainChartLabels, AxisConfig>> = {
	'Stablecoins Mcap': {
		resolveColor: ({ chartColors }) => chartColors['Stablecoins Mcap']
	},
	'Chain Fees': {
		resolveColor: ({ chartColors, chartsInSeries }) =>
			chartsInSeries.has('Chain Fees')
				? chartColors['Chain Fees']
				: chartsInSeries.has('Chain Revenue')
					? chartColors['Chain Revenue']
					: chartsInSeries.has('App Fees')
						? chartColors['App Fees']
						: chartColors['App Revenue']
	},
	'DEXs Volume': {
		resolveColor: ({ chartColors }) => chartColors['DEXs Volume']
	},
	'Perps Volume': {
		resolveColor: ({ chartColors }) => chartColors['Perps Volume']
	},
	'Token Incentives': {
		resolveColor: ({ chartColors }) => chartColors['Token Incentives']
	},
	'Bridged TVL': {
		resolveColor: ({ chartColors }) => chartColors['Bridged TVL']
	},
	'Active Addresses': {
		formatter: (value) => formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		resolveColor: ({ chartColors, chartsInSeries, themeText }) =>
			chartsInSeries.has('Active Addresses')
				? chartColors['Active Addresses']
				: chartsInSeries.has('New Addresses')
					? chartColors['New Addresses']
					: themeText
	},
	Transactions: {
		formatter: (value) => formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		resolveColor: ({ chartColors }) => chartColors['Transactions']
	},
	'Net Inflows': {
		resolveColor: ({ chartColors }) => chartColors['Net Inflows']
	},
	'Core Developers': {
		formatter: (value) => `${value} devs`,
		resolveColor: ({ chartColors }) => chartColors['Core Developers']
	},
	'Devs Commits': {
		formatter: (value) => `${value} commits`,
		resolveColor: ({ chartColors }) => chartColors['Devs Commits']
	},
	'Token Mcap': {
		formatter: (value) => formatTooltipValue(value, '$'),
		resolveColor: ({ chartColors }) => chartColors['Token Mcap']
	},
	'Token Price': {
		formatter: (value) => formatTooltipValue(value, '$'),
		resolveColor: ({ chartColors }) => chartColors['Token Price']
	},
	'Token Volume': {
		formatter: (value) => formatTooltipValue(value, '$'),
		resolveColor: ({ chartColors }) => chartColors['Token Volume']
	},
	Raises: {
		resolveColor: ({ chartColors }) => chartColors['Raises']
	}
}

export function buildChainYAxis({
	allYAxis,
	baseYAxis,
	chartColors,
	chartsInSeries,
	themeText
}: {
	allYAxis: Array<[ChainChartLabels, number | undefined]>
	baseYAxis: MultiSeriesYAxisOption
	chartColors: Record<ChainChartLabels, string>
	chartsInSeries: Set<ChainChartLabels>
	themeText: string
}) {
	const finalYAxis: MultiSeriesYAxisOption[] = []
	const context: AxisBuilderContext = { chartColors, chartsInSeries, themeText }
	const noOffset = allYAxis.length < 3

	for (const [type, index] of allYAxis) {
		if (type === 'TVL') {
			finalYAxis.push({
				...baseYAxis,
				min: getZeroBaselineYAxisMin
			})
			continue
		}

		const prevOffset = finalYAxis[finalYAxis.length - 1]?.offset ?? 0
		const axisOptions = mergeDeep(baseYAxis, {
			name: '',
			type: 'value',
			min: getZeroBaselineYAxisMin,
			offset: noOffset || index == null || index < 2 ? 0 : prevOffset + (CUSTOM_OFFSETS[type] ?? 40)
		})
		const axisConfig = AXIS_CONFIG_BY_TYPE[type]

		const formatter = axisConfig?.formatter
		if (formatter) {
			axisOptions.axisLabel = mergeDeep(axisOptions.axisLabel ?? {}, {
				formatter: (value: number) => formatter(value, context)
			})
		}

		if (axisConfig?.resolveColor) {
			const color = axisConfig.resolveColor(context)
			axisOptions.axisLine = {
				show: true,
				lineStyle: {
					...DASHED_AXIS_LINE_STYLE,
					color
				}
			}
		}

		finalYAxis.push(axisOptions)
	}

	if (finalYAxis.length === 0) {
		finalYAxis.push({
			...baseYAxis,
			min: getZeroBaselineYAxisMin
		})
	}

	return finalYAxis
}
