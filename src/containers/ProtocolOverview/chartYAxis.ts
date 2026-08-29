import type { MultiSeriesYAxisOption } from '~/components/ECharts/MultiSeriesChart/types'
import { formatTooltipValue } from '~/components/ECharts/shared/formatters'
import { mergeDeep } from '~/components/ECharts/shared/merge'
import { formatCompactNumber } from '~/utils/numberFormat'
import type { ProtocolChartsLabels } from './constants'

type AxisExtent = {
	min?: number
}

type AxisBuilderContext = {
	chartColors: Record<string, string>
	chartsInSeries: Set<ProtocolChartsLabels>
	unlockTokenSymbol: string
	gasUsedValueSymbol: string
}

type AxisConfig = {
	formatter?: (value: number, context: AxisBuilderContext) => string
	resolveColor?: (context: AxisBuilderContext) => string | undefined
	scale?: true
}

const CUSTOM_OFFSETS: Record<string, number> = {
	Contributors: 60,
	'Contributors Commits': 80,
	'Devs Commits': 70,
	'NFT Volume': 65
}

const DASHED_AXIS_LINE_STYLE = {
	type: [5, 10],
	dashOffset: 5
}

function getZeroBaselineYAxisMin(extent: AxisExtent) {
	return typeof extent.min === 'number' && extent.min < 0 ? extent.min : 0
}

const AXIS_CONFIG_BY_TYPE: Partial<Record<ProtocolChartsLabels, AxisConfig>> = {
	Mcap: {
		resolveColor: ({ chartColors, chartsInSeries }) =>
			chartsInSeries.has('Mcap') ? chartColors.Mcap : chartColors.FDV,
		scale: true
	},
	'Token Price': {
		resolveColor: ({ chartColors }) => chartColors['Token Price'],
		scale: true
	},
	'Token Volume': {
		resolveColor: ({ chartColors }) => chartColors['Token Volume']
	},
	'Token Liquidity': {
		resolveColor: ({ chartColors }) => chartColors['Token Liquidity']
	},
	'Bridge Deposits': {
		resolveColor: ({ chartColors }) => chartColors['Bridge Deposits']
	},
	Fees: {
		resolveColor: ({ chartColors, chartsInSeries }) =>
			chartsInSeries.has('Fees')
				? chartColors['Fees']
				: chartsInSeries.has('Revenue')
					? chartColors['Revenue']
					: chartsInSeries.has('Holders Revenue')
						? chartColors['Holders Revenue']
						: chartsInSeries.has('Incentives')
							? chartColors['Incentives']
							: chartColors['Fees']
	},
	'DEX Volume': {
		resolveColor: ({ chartColors, chartsInSeries }) =>
			chartsInSeries.has('DEX Volume')
				? chartColors['DEX Volume']
				: chartsInSeries.has('Perp Volume')
					? chartColors['Perp Volume']
					: chartsInSeries.has('Options Premium Volume')
						? chartColors['Options Premium Volume']
						: chartsInSeries.has('Options Notional Volume')
							? chartColors['Options Notional Volume']
							: chartsInSeries.has('Perp Aggregator Volume')
								? chartColors['Perp Aggregator Volume']
								: chartsInSeries.has('Bridge Aggregator Volume')
									? chartColors['Bridge Aggregator Volume']
									: chartsInSeries.has('DEX Aggregator Volume')
										? chartColors['DEX Aggregator Volume']
										: chartColors['DEX Volume']
	},
	'Open Interest': {
		resolveColor: ({ chartColors }) => chartColors['Open Interest']
	},
	Unlocks: {
		formatter: (value, { unlockTokenSymbol }) =>
			`${formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ${unlockTokenSymbol}`,
		resolveColor: ({ chartColors }) => chartColors['Unlocks']
	},
	'Active Addresses': {
		formatter: (value) => formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		resolveColor: ({ chartColors, chartsInSeries }) =>
			chartsInSeries.has('Active Addresses') ? chartColors['Active Addresses'] : chartColors['New Addresses']
	},
	Transactions: {
		formatter: (value) => formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		resolveColor: ({ chartColors }) => chartColors['Transactions']
	},
	'Gas Used': {
		formatter: (value, { gasUsedValueSymbol }) => formatTooltipValue(value, gasUsedValueSymbol),
		resolveColor: ({ chartColors }) => chartColors['Gas Used']
	},
	'Median APY': {
		formatter: (value) => `${value}%`,
		resolveColor: ({ chartColors }) => chartColors['Median APY']
	},
	'USD Inflows': {
		resolveColor: ({ chartColors }) => chartColors['USD Inflows']
	},
	'Total Proposals': {
		formatter: (value) => formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		resolveColor: ({ chartColors }) => chartColors['Total Proposals']
	},
	'Max Votes': {
		formatter: (value) => formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		resolveColor: ({ chartColors }) => chartColors['Max Votes']
	},
	Treasury: {
		resolveColor: ({ chartColors }) => chartColors['Treasury']
	},
	Tweets: {
		formatter: (value) => `${value} tweets`,
		resolveColor: ({ chartColors }) => chartColors['Tweets']
	},
	'NFT Volume': {
		resolveColor: ({ chartColors }) => chartColors['NFT Volume']
	}
}

export function buildProtocolYAxis({
	allYAxis,
	baseYAxis,
	chartColors,
	chartsInSeries,
	unlockTokenSymbol,
	gasUsedValueSymbol
}: {
	allYAxis: Array<[ProtocolChartsLabels, number | undefined]>
	baseYAxis: MultiSeriesYAxisOption
	chartColors: Record<string, string>
	chartsInSeries: Set<ProtocolChartsLabels>
	unlockTokenSymbol: string
	gasUsedValueSymbol: string
}) {
	const finalYAxis: MultiSeriesYAxisOption[] = []
	const context: AxisBuilderContext = { chartColors, chartsInSeries, unlockTokenSymbol, gasUsedValueSymbol }
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
		const axisConfig = AXIS_CONFIG_BY_TYPE[type]
		const axisOptions = mergeDeep(baseYAxis, {
			name: '',
			type: 'value',
			...(axisConfig?.scale ? { scale: true } : { min: getZeroBaselineYAxisMin }),
			offset: noOffset || index == null || index < 2 ? 0 : prevOffset + (CUSTOM_OFFSETS[type] ?? 40)
		})

		const formatter = axisConfig?.formatter
		if (formatter) {
			axisOptions.axisLabel = mergeDeep(axisOptions.axisLabel ?? {}, {
				formatter: (value: number) => formatter(value, context)
			})
		}

		const axisColor = axisConfig?.resolveColor?.(context)
		if (axisColor) {
			axisOptions.axisLine = {
				show: true,
				lineStyle: {
					...DASHED_AXIS_LINE_STYLE,
					color: axisColor
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
