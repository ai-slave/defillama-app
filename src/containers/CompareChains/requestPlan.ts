import type { IAdapterChart } from '~/containers/AdapterMetrics/api.types'

export const COMPARE_CHAIN_ADAPTER_METRICS = ['dexVolumeChart', 'chainFeesChart', 'chainRevenueChart'] as const

export type CompareChainAdapterMetric = (typeof COMPARE_CHAIN_ADAPTER_METRICS)[number]

export function getCompareChainAdapterMetrics(selectedCharts: readonly string[]): CompareChainAdapterMetric[] {
	return COMPARE_CHAIN_ADAPTER_METRICS.filter((metric) => selectedCharts.includes(metric))
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
	adapterMetrics: readonly CompareChainAdapterMetric[]
	metricData: ReadonlyArray<IAdapterChart | undefined>
}): T | null {
	if (!overview) return null

	const merged = { ...overview }
	for (let index = 0; index < adapterMetrics.length; index++) {
		const data = metricData[index]
		if (data) merged[adapterMetrics[index]] = data
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
	chains: readonly string[]
	adapterMetrics: readonly CompareChainAdapterMetric[]
	overviewErrors: ReadonlyArray<unknown>
	metricErrors: ReadonlyArray<unknown>
	metricLabels: Readonly<Record<CompareChainAdapterMetric, string>>
}): string[] {
	const failedSources = chains.flatMap((chain, index) => (overviewErrors[index] ? [chain] : []))
	for (let chainIndex = 0; chainIndex < chains.length; chainIndex++) {
		for (let metricIndex = 0; metricIndex < adapterMetrics.length; metricIndex++) {
			if (metricErrors[chainIndex * adapterMetrics.length + metricIndex]) {
				failedSources.push(`${chains[chainIndex]} - ${metricLabels[adapterMetrics[metricIndex]]}`)
			}
		}
	}
	return failedSources
}
