import type { ChartCsvDataset } from '~/components/ChartExport/ChartCsvExportButton'
import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/MultiSeriesChart/groupDataset'
import { buildSelectedPercentageChart } from '~/components/ECharts/MultiSeriesChart/selection'
import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { getRwaPerpsChartMetricSpec, type RWAPerpsChartMetric } from './chartBreakdown'
import {
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	sortRwaChartSeriesLabels,
	type RWAPositionalChartDataset
} from './chartDataset'
import { dropRwaRedundantTotal, ensureRwaTotalSeries, foldRwaTopSeries, RWA_MAX_CHART_SERIES } from './chartFold'

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

type RwaChartPresentation = { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig> }

/**
 * A split's share view (docs/charts.md, "Share views"): each row as percent of every member and the upstream Others,
 * with Total lines left out. The first `limit` picks, largest first by their latest day, draw their own series and
 * everything else is one Others. Volume sums into its period after the ranking, so both views rank alike.
 */
export function buildRwaShareChart({
	dataset,
	picked,
	groupBy,
	buildCharts,
	limit = RWA_MAX_CHART_SERIES
}: {
	dataset: RWAPositionalChartDataset
	picked: ReadonlyArray<string>
	groupBy: ChartTimeGroupingWithCumulative
	buildCharts: (dataset: RWAPositionalChartDataset) => Array<MultiSeriesChartSeriesConfig>
	limit?: number
}): RwaChartPresentation {
	const ranked = groupMultiSeriesBarChartDataset({
		dataset: foldRwaTopSeries(dataset, { max: Number.POSITIVE_INFINITY }),
		groupBy
	})
	const { dataset: shares, charts } = buildSelectedPercentageChart({
		dataset: ranked,
		charts: buildCharts(ranked).filter((chart) => !isRwaTotalSeriesLabel(chart.name)),
		selectedCharts: new Set(picked),
		missingValuePolicy: 'sum-available',
		limit
	})
	return { dataset: shares, charts }
}

/**
 * The perps time series under the series pick. Open interest and markets draw lines under their Total, which keeps
 * measuring every market of the page; volume stacks bars by the period, and its tooltip sums them. The csv lists
 * every pick in its own column, with the upstream Others while the chart draws it.
 */
export function buildRwaPerpsTimeSeriesChart({
	dataset,
	metric,
	view,
	period,
	picked
}: {
	dataset: RWAPositionalChartDataset
	metric: RWAPerpsChartMetric
	view: 'timeSeries' | 'share'
	period: ChartTimeGroupingWithCumulative
	picked: ReadonlyArray<string>
}): RwaChartPresentation & { csv: () => ChartCsvDataset } {
	const isVolume = metric === 'volume'
	const groupBy = isVolume ? period : 'daily'
	const buildCharts = isVolume ? buildRwaPerpsChartSeries : buildRwaTimeSeriesCharts
	if (view === 'share') {
		const share = { dataset, picked, groupBy, buildCharts }
		return {
			...buildRwaShareChart(share),
			csv: () => ({ ...buildRwaShareChart({ ...share, limit: Number.POSITIVE_INFINITY }).dataset, groupBy })
		}
	}
	const withTotal = isVolume
		? dataset
		: dropRwaRedundantTotal(ensureRwaTotalSeries(dataset, getRwaPerpsChartMetricSpec(metric).totalLabel))
	const drawn = groupMultiSeriesBarChartDataset({ dataset: foldRwaTopSeries(withTotal, { picked }), groupBy })
	return {
		dataset: drawn,
		charts: buildCharts(drawn),
		csv: () => ({
			...groupMultiSeriesBarChartDataset({
				dataset: foldRwaTopSeries(withTotal, { picked, max: Number.POSITIVE_INFINITY }),
				groupBy
			}),
			groupBy
		})
	}
}
