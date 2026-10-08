import { useMemo } from 'react'
import { useAppMetadata } from '../../../AppMetadataContext'
import { useProDashboardCatalog } from '../../../ProDashboardAPIContext'
import { CHAIN_CHART_TYPES, getProDashboardChartTypeConfig, PROTOCOL_CHART_TYPES } from '../../../types'
import type { ComparisonType, MetricWithAvailability } from '../types'

export function useMetricAvailability(
	selectedItems: Array<string>,
	comparisonType: ComparisonType | null
): Array<MetricWithAvailability> {
	const { availableChainChartTypes, availableProtocolChartTypes, chainsByName } = useAppMetadata()
	const { getProtocolInfo } = useProDashboardCatalog()

	return useMemo(() => {
		if (!comparisonType || selectedItems.length === 0) return []

		const buildAvailability = (metric: string, availableCount: number): MetricWithAvailability => {
			const isValid =
				selectedItems.length === 1
					? availableCount === 1
					: selectedItems.length === 2
						? availableCount === 2
						: availableCount >= 2
			const chartTypeInfo = getProDashboardChartTypeConfig(metric)
			return {
				metric,
				title: chartTypeInfo?.title || metric,
				chartType: chartTypeInfo?.chartType || 'line',
				availableCount,
				totalCount: selectedItems.length,
				isValid
			}
		}

		if (comparisonType === 'chains') {
			return CHAIN_CHART_TYPES.map((metric) => {
				let availableCount = 0
				for (const item of selectedItems) {
					const chainMeta = chainsByName.get(item)
					const hasGeckoId = !!chainMeta?.gecko_id
					const types = availableChainChartTypes(item, { hasGeckoId })
					if (types.includes(metric)) availableCount++
				}
				return buildAvailability(metric, availableCount)
			})
		}

		return PROTOCOL_CHART_TYPES.map((metric) => {
			let availableCount = 0
			for (const item of selectedItems) {
				const protocol = getProtocolInfo(item)
				const types = availableProtocolChartTypes(item, { hasGeckoId: !!protocol?.geckoId })
				if (types.includes(metric)) availableCount++
			}
			return buildAvailability(metric, availableCount)
		})
	}, [
		selectedItems,
		comparisonType,
		availableChainChartTypes,
		availableProtocolChartTypes,
		getProtocolInfo,
		chainsByName
	])
}
