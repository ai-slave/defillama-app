import type { CsvPayload } from '~/components/CsvDownloadButton'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import { filterDataByTimePeriod } from '~/containers/ProDashboard/timePeriod'
import { normalizeCacheList } from '~/server/api/cacheKey'
import type { ChartSeries } from '~/utils/breakdowns'
import { buildChartBuilderSeriesView, isChartBuilderSnapshotMetric } from '../../components/chartBuilderSeries'
import { prepareProChartCsv } from '../../components/chartCsv'
import { buildProTreemapData } from '../../utils/treemap'
import { getCompleteAdapterMetricChainSeries } from './adapterMetrics/breakdowns/chainSeries'
import { parseAdapterChartBuilderMetric } from './adapterMetrics/breakdowns/config'
import { normalizeLegacyChartBuilderChains } from './filters'
import { validateCategoryChainFanOut, validateChartBuilderFilters } from './requestLimits'
import { getCompleteStablecoinChainSeries } from './stablecoinData'

const DEFAULT_SERIES_COLOR = '#3e61cc'

function getScopedSeries(request: ChartBuilderCsvRequest, series: ChartSeries[]): ChartSeries[] {
	const { timePeriod, customTimePeriod } = request
	if (timePeriod === 'all') return series
	return series.map((item) => ({
		...item,
		data: filterDataByTimePeriod(item.data, timePeriod, customTimePeriod)
	}))
}

async function getCompleteChainSeries(request: ChartBuilderCsvRequest): Promise<ChartSeries[]> {
	const { config } = request
	const chains = normalizeLegacyChartBuilderChains(config.chains)
	const chainCategories = normalizeCacheList(config.chainCategories ?? [])
	if (config.metric === 'tvl') {
		throw new Error('Chain TVL CSV uses the Lens export path')
	}
	if (config.metric === 'stablecoins') {
		if (config.protocol && config.protocol.toLowerCase() !== 'all') {
			throw new Error('stablecoins metric is only available for All Protocols')
		}
		return (
			await getCompleteStablecoinChainSeries({
				chains,
				chainFilterMode: config.chainFilterMode,
				chainCategoryFilterMode: config.chainCategoryFilterMode,
				chainCategories
			})
		).series
	}
	const metric = parseAdapterChartBuilderMetric(config.metric)
	if (!metric) throw new Error(`Unsupported chain-series metric: ${config.metric}`)
	const supportsProtocolCategoryFilter = !config.protocol || config.protocol.toLowerCase() === 'all'
	return (
		await getCompleteAdapterMetricChainSeries({
			...(config.protocol ? { protocol: config.protocol } : {}),
			metric,
			chains,
			chainFilterMode: config.chainFilterMode,
			chainCategoryFilterMode: config.chainCategoryFilterMode,
			protocolCategoryFilterMode: config.protocolCategoryFilterMode,
			chainCategories,
			protocolCategories: supportsProtocolCategoryFilter
				? normalizeCacheList(config.protocolCategories ?? [], { lowercase: true })
				: []
		})
	).series
}

export async function getCompleteChartBuilderSeries(request: ChartBuilderCsvRequest): Promise<ChartSeries[]> {
	const { config } = request
	const chains = normalizeLegacyChartBuilderChains(config.chains)
	const categories = normalizeCacheList(config.categories, { lowercase: true })
	const validationError =
		validateChartBuilderFilters({
			chains,
			categories,
			chainCategories: normalizeCacheList(config.chainCategories ?? []),
			protocolCategories: normalizeCacheList(config.protocolCategories ?? [], { lowercase: true }),
			protocol: config.protocol
		}) ?? (config.metric === 'tvl' && config.mode === 'chains' ? validateCategoryChainFanOut(categories, chains) : null)
	if (validationError) throw new Error(validationError)

	if (config.mode !== 'protocol') throw new Error('Protocol-series CSV uses the streaming adapter or TVL path')
	const series = await getCompleteChainSeries(request)
	return getScopedSeries(request, series)
}

export function buildChartBuilderCsvPayload(request: ChartBuilderCsvRequest, series: ChartSeries[]): CsvPayload {
	const { config } = request
	if (config.chartType === 'treemap') {
		const treemapMode = isChartBuilderSnapshotMetric(config.metric) ? 'latest' : (config.treemapValue ?? 'latest')
		const valueLabel = treemapMode === 'latest' ? 'Last day (1d)' : treemapMode === 'sum7d' ? 'Sum 7d' : 'Sum 30d'
		const nodes = buildProTreemapData(series, treemapMode, () => DEFAULT_SERIES_COLOR)
		return {
			filename: request.filename,
			rows: [['Name', valueLabel], ...nodes.map((node) => [node.name, node.value])]
		}
	}

	const view = buildChartBuilderSeriesView({
		series,
		grouping: request.grouping,
		useLastValue: isChartBuilderSnapshotMetric(config.metric),
		displayAs: config.displayAs,
		chartType: config.chartType,
		resolveColor: () => DEFAULT_SERIES_COLOR
	})
	return prepareProChartCsv(view.dataset, request.filename)
}
