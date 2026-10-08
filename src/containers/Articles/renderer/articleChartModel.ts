import { buildSparseCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { formatTooltipValue } from '~/components/ECharts/shared/formatters'
import { chartColor } from '~/constants/colors'
import { CHART_TYPES, getDashboardChartValueSymbol } from '~/containers/ProDashboard/types'
import { formatUsd } from '~/utils/numberFormat'
import type { ArticleChartSeries } from '../types'

type Points = Array<[number, number]>

export function seriesDisplayName(s: ArticleChartSeries) {
	const meta = CHART_TYPES[s.chartType as keyof typeof CHART_TYPES]
	return meta?.title ? `${s.name} ${meta.title}` : s.name
}

export function uniqueChartTypeTitles(series: Array<ArticleChartSeries>) {
	const seen = new Set<string>()
	const out: Array<string> = []
	for (const s of series) {
		if (seen.has(s.chartType)) continue
		seen.add(s.chartType)
		const meta = CHART_TYPES[s.chartType as keyof typeof CHART_TYPES]
		out.push(meta?.title || s.chartType)
	}
	return out
}

/** `data[i]` is the loaded points for `series[i]`; series without points are left out of the chart. */
export function buildArticleChartModel(series: Array<ArticleChartSeries>, data: Array<Points | undefined>) {
	const chartSeries = []
	for (let i = 0; i < series.length; i++) {
		const s = series[i]
		const points = data[i]
		if (!points || points.length === 0) continue
		const meta = CHART_TYPES[s.chartType as keyof typeof CHART_TYPES]
		const seriesType: 'line' | 'bar' = meta?.chartType === 'bar' ? 'bar' : 'line'
		chartSeries.push({
			name: seriesDisplayName(s),
			type: seriesType,
			// A chart can mix metrics, e.g. TVL next to transactions, so each series carries its own unit.
			valueSymbol: getDashboardChartValueSymbol(s.chartType),
			color: chartColor(i),
			data: points,
			// Each API series owns its calendar; connect across union rows belonging only to sibling series.
			...(seriesType === 'line' ? { connectNulls: true } : {}),
			...(meta?.chartType === 'area' && series.length === 1 ? { areaStyle: {} } : {})
		})
	}
	return buildSparseCartesianChartModel(chartSeries)
}

export function articleChartValueSymbol(series: Array<ArticleChartSeries>) {
	const primary = series[0]
	return primary ? getDashboardChartValueSymbol(primary.chartType) : '$'
}

/** Headline value for a single-series chart, in that metric's unit; null while loading or for multi-series charts. */
export function articleChartLatestLabel(series: Array<ArticleChartSeries>, primaryData: Points | undefined) {
	const last = primaryData?.at(-1)
	if (series.length !== 1 || !last) return null
	const symbol = articleChartValueSymbol(series)
	return symbol === '$' ? formatUsd(last[1], { compact: true }) : formatTooltipValue(last[1], symbol)
}

export function articleChartDefaultCaption(series: Array<ArticleChartSeries>, entityNames: Array<string>) {
	const isUsdDenominated = series.every((s) => getDashboardChartValueSymbol(s.chartType) === '$')
	const chartLabel = uniqueChartTypeTitles(series).join(' / ')
	return `${entityNames.join(' vs ')} ${chartLabel.toLowerCase()}${isUsdDenominated ? ', USD-denominated' : ''}.`
}
