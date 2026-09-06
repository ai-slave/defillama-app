import type { ChartBuilderConfig } from '~/containers/ProDashboard/types'
import { normalizeCacheList } from '~/server/api/cacheKey'
import { parseCachedJsonResult } from '~/server/api/resultCache'
import type { ChartSeries } from '~/utils/breakdowns'
import { recordRuntimeError } from '~/utils/telemetry'
import type { ChartBuilderSeriesData } from '../../dataContracts'
import { parseAdapterChartBuilderMetric } from './adapterMetrics/breakdowns/config'
import { getCachedAdapterMetricChainBreakdown, getCachedAdapterMetricProtocolBreakdown } from './adapterMetrics/data'
import { getCachedChainNativeBreakdown, isChainNativeBreakdownMetric } from './chainNativeData'
import { normalizeLegacyChartBuilderChains } from './filters'
import { getCachedProtocolTvlBreakdown, getCachedProtocolTvlChainBreakdown } from './protocols/data'
import { validateCategoryChainFanOut, validateChartBuilderFilters } from './requestLimits'
import { getCachedStablecoinChainBreakdown } from './stablecoinData'

const clampTopN = (limit: number): number => Math.min(Math.max(Math.trunc(limit), 1), 20)

function withoutOthers(series: Array<ChartSeries>): Array<ChartSeries> {
	return series.filter((entry) => !entry.name.startsWith('Others'))
}

async function getProtocolSeries(config: ChartBuilderConfig['config']): Promise<ChartBuilderSeriesData> {
	if (config.metric === 'stablecoins' || isChainNativeBreakdownMetric(config.metric)) {
		throw new Error(`Unsupported protocol-series metric: ${config.metric}`)
	}

	const chains = normalizeLegacyChartBuilderChains(config.chains)
	const chainFilterMode = config.chainFilterMode
	const categoryFilterMode = config.categoryFilterMode
	const topN = clampTopN(config.limit)
	let series: Array<ChartSeries>
	if (config.metric === 'tvl') {
		series = parseCachedJsonResult(
			await getCachedProtocolTvlBreakdown({
				chains,
				categories: normalizeCacheList(config.categories, { lowercase: true }),
				topN,
				groupByParent: config.groupByParent === true,
				chainFilterMode,
				categoryFilterMode
			})
		).series
	} else {
		const metric = parseAdapterChartBuilderMetric(config.metric)
		if (!metric) throw new Error(`Unsupported protocol-series metric: ${config.metric}`)
		series = parseCachedJsonResult(
			await getCachedAdapterMetricProtocolBreakdown({
				metric,
				chains,
				categories: normalizeCacheList(config.categories, { lowercase: true }),
				topN,
				groupByParent: config.groupByParent === true,
				chainFilterMode,
				categoryFilterMode
			})
		).series
	}

	const hideOthers = config.hideOthers === true || (config.chainCategories?.length ?? 0) > 0
	return { series: hideOthers ? withoutOthers(series) : series }
}

async function getChainSeries(config: ChartBuilderConfig['config']): Promise<ChartBuilderSeriesData> {
	const protocol = config.protocol
	const chains = normalizeLegacyChartBuilderChains(config.chains)
	const chainCategories = normalizeCacheList(config.chainCategories ?? [])
	const chainFilterMode = config.chainFilterMode
	const chainCategoryFilterMode = config.chainCategoryFilterMode
	const protocolCategoryFilterMode = config.protocolCategoryFilterMode
	// The browser route omits a zero limit and therefore uses the route's default of five.
	const topN = config.limit === 0 ? 5 : clampTopN(config.limit)

	let series: Array<ChartSeries>
	if (config.metric === 'tvl') {
		series = parseCachedJsonResult(
			await getCachedProtocolTvlChainBreakdown({
				...(protocol ? { protocol } : {}),
				chains,
				topN,
				chainFilterMode,
				chainCategoryFilterMode,
				chainCategories
			})
		).series
	} else if (config.metric === 'stablecoins') {
		if (protocol && protocol.toLowerCase() !== 'all') {
			throw new Error('stablecoins metric is only available when protocol=All')
		}
		series = parseCachedJsonResult(
			await getCachedStablecoinChainBreakdown({
				chains,
				topN,
				chainFilterMode,
				chainCategoryFilterMode,
				chainCategories: normalizeCacheList(chainCategories)
			})
		).series
	} else if (isChainNativeBreakdownMetric(config.metric)) {
		if (protocol && protocol.toLowerCase() !== 'all') {
			throw new Error(`${config.metric} metric is only available when protocol=All`)
		}
		series = parseCachedJsonResult(
			await getCachedChainNativeBreakdown({
				metric: config.metric,
				chains,
				topN,
				chainFilterMode,
				chainCategoryFilterMode,
				chainCategories
			})
		).series
	} else {
		const metric = parseAdapterChartBuilderMetric(config.metric)
		if (!metric) throw new Error(`Unsupported chain-series metric: ${config.metric}`)
		const supportsProtocolCategoryFilter = !protocol || protocol.toLowerCase() === 'all'
		series = parseCachedJsonResult(
			await getCachedAdapterMetricChainBreakdown({
				...(protocol ? { protocol } : {}),
				metric,
				chains,
				topN,
				chainFilterMode,
				chainCategoryFilterMode,
				protocolCategoryFilterMode,
				chainCategories: normalizeCacheList(chainCategories),
				protocolCategories: supportsProtocolCategoryFilter
					? normalizeCacheList(config.protocolCategories ?? [], { lowercase: true })
					: []
			})
		).series
	}

	const hideOthers =
		config.hideOthers === true || chainCategories.length > 0 || (config.protocolCategories?.length ?? 0) > 0
	return { series: hideOthers ? withoutOthers(series) : series }
}

export async function fetchChartBuilderServerData(
	config: ChartBuilderConfig['config']
): Promise<ChartBuilderSeriesData> {
	try {
		const chains = normalizeLegacyChartBuilderChains(config.chains)
		const categories = normalizeCacheList(config.categories, { lowercase: true })
		const validationError =
			validateChartBuilderFilters({
				chains,
				categories,
				chainCategories: normalizeCacheList(config.chainCategories ?? []),
				protocolCategories: normalizeCacheList(config.protocolCategories ?? [], { lowercase: true }),
				protocol: config.protocol
			}) ??
			(config.metric === 'tvl' && config.mode !== 'protocol' ? validateCategoryChainFanOut(categories, chains) : null)
		if (validationError) throw new Error(validationError)
		return config.mode === 'protocol' ? await getChainSeries(config) : await getProtocolSeries(config)
	} catch (error) {
		recordRuntimeError(error, 'pageBuild')
		throw error
	}
}
