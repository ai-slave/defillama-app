import { useMemo } from 'react'
import { mergeFailedReads } from '~/utils/query'
import type { IRWAAssetsOverview, RWAAssetChartTarget, RWAChartMetricKey } from '../api.types'
import { getRwaChartTotalLabel } from '../chartAggregation'
import { aggregateRWAFlowRows, type RWAFlowGrouping } from '../flows'
import { useRWAFlowSeries } from '../flows.hooks'
import { useRwaChartDataset } from '../hooks'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'
import { rwaSlug } from '../rwaSlug'
import type { RWAEntityChartData } from './entityChart'
import { buildRwaPlatformEntityChart, getRwaDatasetPoints, type RWAPlatformChartMetricKey } from './metrics'

const FLOW_METRICS: ReadonlyArray<RWAPlatformChartMetricKey> = ['netFlows', 'inflows', 'outflows', 'cumulativeNetFlows']
const PER_ASSET_METRICS: ReadonlyArray<RWAPlatformChartMetricKey> = ['liveAssets', 'topAssetShare']

/**
 * The datasets behind the entity chart. Active AUM and the per-asset counts read the fold the page ships; the other
 * totals and the platform flows load when a selected metric asks for them.
 */
export function usePlatformEntityChart({
	overview,
	meta,
	aggregateAssets,
	selected,
	period,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl,
	activeFilters
}: {
	overview: IRWAAssetsOverview
	meta: RWAPlatformMeta
	aggregateAssets: IRWAAssetsOverview['assets']
	selected: ReadonlyArray<RWAPlatformChartMetricKey>
	period: RWAFlowGrouping
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	activeFilters: boolean
}): RWAEntityChartData {
	const target: RWAAssetChartTarget = { kind: 'platform', slug: meta.slug || rwaSlug(meta.name) }
	const wantsFlows = FLOW_METRICS.some((key) => selected.includes(key))
	const wantsPerAsset = PER_ASSET_METRICS.some((key) => selected.includes(key))

	/* The page ships the per-asset active AUM fold; its Total serves the headline series and its columns the counts. */
	const initialByMetric = (metric: RWAChartMetricKey) =>
		overview.initialChartDatasets.find((initial) => initial.metric === metric)?.dataset ?? null
	const perAsset = useRwaChartDataset({
		selectedMetric: 'activeMcap',
		initialDataset: initialByMetric('activeMcap'),
		filteredAssets: aggregateAssets,
		mode: 'assetName',
		target,
		includeStablecoins,
		includeGovernance,
		useInitialDataset: initialByMetric('activeMcap') != null && !activeFilters,
		enabled: true
	})
	const onChain = useRwaChartDataset({
		selectedMetric: 'onChainMcap',
		initialDataset: initialByMetric('onChainMcap'),
		filteredAssets: aggregateAssets,
		mode: 'total',
		target,
		includeStablecoins,
		includeGovernance,
		useInitialDataset: initialByMetric('onChainMcap') != null && !activeFilters,
		enabled: selected.includes('onChainMcap') || selected.includes('activeShare')
	})
	const defi = useRwaChartDataset({
		selectedMetric: 'defiActiveTvl',
		initialDataset: initialByMetric('defiActiveTvl'),
		filteredAssets: aggregateAssets,
		mode: 'total',
		target,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		useInitialDataset: initialByMetric('defiActiveTvl') != null && !activeFilters,
		enabled: selected.includes('defiActiveTvl') || selected.includes('utilization')
	})
	const flowSeries = useRWAFlowSeries({
		scope: target,
		includeStablecoin: includeStablecoins,
		includeGovernance,
		enabled: wantsFlows
	})
	const flows = useMemo(
		() => (flowSeries.assetRows ? aggregateRWAFlowRows(flowSeries.assetRows, aggregateAssets) : null),
		[flowSeries.assetRows, aggregateAssets]
	)

	const chart = useMemo(
		() => ({
			...buildRwaPlatformEntityChart(selected, {
				activeMcap: getRwaDatasetPoints(perAsset.chartDataset, getRwaChartTotalLabel('activeMcap')),
				onChainMcap: getRwaDatasetPoints(onChain.chartDataset, getRwaChartTotalLabel('onChainMcap')),
				defiActiveTvl: getRwaDatasetPoints(defi.chartDataset, getRwaChartTotalLabel('defiActiveTvl')),
				perAsset: wantsPerAsset ? perAsset.chartDataset : null,
				flows,
				milestones: meta.milestones,
				period
			}),
			// Travels with the series, so a deferred render labels them by the period they were built with.
			period
		}),
		[
			selected,
			perAsset.chartDataset,
			onChain.chartDataset,
			defi.chartDataset,
			wantsPerAsset,
			flows,
			meta.milestones,
			period
		]
	)
	const isLoading =
		perAsset.isChartLoading ||
		(onChain.isChartLoading && (selected.includes('onChainMcap') || selected.includes('activeShare'))) ||
		(defi.isChartLoading && (selected.includes('defiActiveTvl') || selected.includes('utilization'))) ||
		(wantsFlows && flowSeries.isLoading)
	const failedRead = mergeFailedReads([perAsset.failedRead, onChain.failedRead, defi.failedRead, flowSeries.failedRead])

	return { chart, isLoading, failedRead }
}
