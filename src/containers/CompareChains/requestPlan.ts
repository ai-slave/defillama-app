import { fetchAdapterChainChartData, fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import type { IAdapterChart } from '~/containers/AdapterMetrics/api.types'

export const COMPARE_CHAIN_ADAPTER_METRICS = ['dexVolumeChart', 'chainFeesChart', 'chainRevenueChart'] as const

export type CompareChainAdapterMetric = (typeof COMPARE_CHAIN_ADAPTER_METRICS)[number]

export function getCompareChainAdapterMetrics(selectedCharts: ReadonlyArray<string>): Array<CompareChainAdapterMetric> {
	return COMPARE_CHAIN_ADAPTER_METRICS.filter((metric) => selectedCharts.includes(metric))
}

// DEX volume is a chain-level adapter; chain fees and revenue come from the chain's own protocol entry.
export function fetchCompareChainAdapterMetric(
	chain: string,
	metric: CompareChainAdapterMetric
): Promise<IAdapterChart> {
	switch (metric) {
		case 'dexVolumeChart':
			return fetchAdapterChainChartData({ adapterType: 'dexs', chain })
		case 'chainFeesChart':
			return fetchAdapterProtocolChartData({ adapterType: 'fees', protocol: chain })
		case 'chainRevenueChart':
			return fetchAdapterProtocolChartData({ adapterType: 'fees', protocol: chain, dataType: 'dailyRevenue' })
	}
}

export function buildCompareChainOverviewQueryKey(chain: string) {
	return ['compare-chains', 'overview', chain] as const
}

export function buildCompareChainAdapterQueryKey(chain: string, metric: CompareChainAdapterMetric) {
	return ['compare-chains', 'adapter', chain, metric] as const
}

export function hasPendingCompareChainSources(
	...sourceGroups: ReadonlyArray<ReadonlyArray<{ isLoading: boolean }>>
): boolean {
	for (const sources of sourceGroups) {
		if (sources.some((source) => source.isLoading)) return true
	}
	return false
}

export function mergeCompareChainSources<T extends Record<CompareChainAdapterMetric, IAdapterChart | null>>({
	overview,
	adapterMetrics,
	metricData
}: {
	overview: T | undefined
	adapterMetrics: ReadonlyArray<CompareChainAdapterMetric>
	metricData: ReadonlyArray<IAdapterChart | undefined>
}): T | null {
	if (!overview) return null

	const merged = { ...overview }
	for (let index = 0; index < adapterMetrics.length; index++) {
		const metric = adapterMetrics[index]
		if (metric === undefined) continue
		const data = metricData[index]
		if (data) merged[metric] = data
	}
	return merged
}

export function getCompareChainFailedSources({
	chains,
	adapterMetrics,
	overviewErrors,
	metricErrors,
	metricLabels
}: {
	chains: ReadonlyArray<string>
	adapterMetrics: ReadonlyArray<CompareChainAdapterMetric>
	overviewErrors: ReadonlyArray<unknown>
	metricErrors: ReadonlyArray<unknown>
	metricLabels: Readonly<Record<CompareChainAdapterMetric, string>>
}): Array<string> {
	const failedSources = chains.flatMap((chain, index) => (overviewErrors[index] ? [chain] : []))
	for (let chainIndex = 0; chainIndex < chains.length; chainIndex++) {
		const chain = chains[chainIndex]
		if (chain === undefined) continue
		for (let metricIndex = 0; metricIndex < adapterMetrics.length; metricIndex++) {
			const metric = adapterMetrics[metricIndex]
			if (metric === undefined) continue
			if (metricErrors[chainIndex * adapterMetrics.length + metricIndex]) {
				failedSources.push(`${chain} - ${metricLabels[metric]}`)
			}
		}
	}
	return failedSources
}
