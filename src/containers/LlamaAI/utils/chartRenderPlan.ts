import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import type { IScatterChartProps } from '~/components/ECharts/ScatterChart/types'
import { oldBlue } from '~/constants/colors'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import type { AdaptedChartData } from '~/containers/LlamaAI/utils/adaptedChartTypes'
import {
	buildControlsModel,
	type ChartCapabilities,
	type ChartControlsModel,
	type ChartViewState
} from '~/containers/LlamaAI/utils/chartCapabilities'
import { buildExportModel, type ChartExportModel } from '~/containers/LlamaAI/utils/chartExportModel'
import { resolveStylePolicy, type ChartStylePolicy } from '~/containers/LlamaAI/utils/chartStylePolicy'

interface BaseChartRenderPlan {
	controls: ChartControlsModel
	exportModel: ChartExportModel | null
	stylePolicy: ChartStylePolicy
	hasData: boolean
	filename: string
}

export type ChartRenderPlan =
	| (BaseChartRenderPlan & {
			rendererKind: 'cartesian'
			rendererProps: IMultiSeriesChartProps
	  })
	| (BaseChartRenderPlan & {
			rendererKind: 'pie'
			rendererProps: IPieChartProps
	  })
	| (BaseChartRenderPlan & {
			rendererKind: 'scatter'
			rendererProps: IScatterChartProps
	  })
	| (BaseChartRenderPlan & {
			rendererKind: 'hbar'
			rendererProps: IHBarChartProps
	  })

function getChartFilename(title: string) {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

export function buildRenderPlan(
	config: ChartConfiguration,
	adaptedChart: AdaptedChartData,
	state: ChartViewState,
	capabilities: ChartCapabilities
): ChartRenderPlan {
	// Collapse all policy decisions into one renderer-facing object so the React layer
	// only switches on renderer kind and never re-derives chart semantics.
	const stylePolicy = resolveStylePolicy(adaptedChart, state)
	const exportModel = buildExportModel(config, adaptedChart)
	const controls = buildControlsModel(config.title, state, capabilities)
	const filename = getChartFilename(config.title)

	switch (adaptedChart.chartType) {
		case 'cartesian': {
			const usedLegacyMultiSeriesChart =
				adaptedChart.seriesMeta.length > 1 ||
				(adaptedChart.axisType === 'category' &&
					adaptedChart.seriesMeta.length === 1 &&
					adaptedChart.seriesMeta[0]?.baseType === 'bar')

			return {
				rendererKind: 'cartesian',
				rendererProps: {
					...adaptedChart.props,
					// Server axis labels remain editable config metadata. Do not map them to visible
					// Cartesian axis names: legends and colored/unit ticks already identify the series,
					// while generic x labels such as "date" only add visual noise.
					solidChartAreaStyle: stylePolicy.solidAreaFill,
					categoryLogos: state.showLabels ? adaptedChart.props.categoryLogos : undefined,
					// Match legacy LlamaAI behavior only for charts that previously rendered through
					// the old MultiSeriesChart component. Other cartesian charts keep MSC2 defaults.
					// An explicit legend.show overrides that default.
					hideDefaultLegend:
						config.legend?.show === true
							? false
							: config.legend?.show === false
								? true
								: usedLegacyMultiSeriesChart
									? false
									: undefined,
					// Log-scale conflicts with stacked/percentage (both need a 0 baseline), so gate it off there.
					logScale: capabilities.allowLogScale && state.logScale && !state.stacked && !state.percentage,
					logEligibleYAxes: capabilities.logEligibleYAxes
				},
				controls,
				exportModel,
				stylePolicy,
				hasData: adaptedChart.rowCount > 0 && (adaptedChart.props.charts?.length ?? 0) > 0,
				filename
			}
		}
		case 'pie':
			return {
				rendererKind: 'pie',
				rendererProps: adaptedChart.props as IPieChartProps,
				controls,
				exportModel,
				stylePolicy,
				hasData: (adaptedChart.props.chartData?.length ?? 0) > 0,
				filename
			}
		case 'scatter':
			return {
				rendererKind: 'scatter',
				rendererProps: {
					...(adaptedChart.props as IScatterChartProps),
					height: '360px',
					showLabels: state.showLabels,
					logScale: capabilities.allowLogScale && state.logScale
				},
				controls,
				exportModel,
				stylePolicy,
				hasData: (adaptedChart.props.chartData?.length ?? 0) > 0,
				filename
			}
		case 'hbar':
			return {
				rendererKind: 'hbar',
				rendererProps: {
					categories: adaptedChart.data.map(([category]) => String(category)),
					values: adaptedChart.data.map(([, value]) => value),
					valueSymbol: adaptedChart.props.valueSymbol,
					color: config.series[0]?.styling?.color || oldBlue,
					colors: adaptedChart.props.colors,
					logos: state.showLabels ? adaptedChart.props.logos : undefined,
					series: adaptedChart.props.series,
					valueAxisMin: adaptedChart.props.valueAxisMin,
					valueAxisMax: adaptedChart.props.valueAxisMax,
					valueAxisInterval: adaptedChart.props.valueAxisInterval
				},
				controls,
				exportModel,
				stylePolicy,
				hasData: adaptedChart.data.length > 0,
				filename
			}
	}
}
