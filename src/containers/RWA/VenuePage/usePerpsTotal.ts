import { useMemo } from 'react'
import { getRwaPerpsChartMetricSpec, type RWAPerpsChartMetric } from '../chartBreakdown'
import { ensureRwaTotalSeries } from '../chartFold'
import { getRwaDatasetPoints } from '../platformChart/metrics'
import { useRwaPerpsChartDataset, type RwaPerpsChartScope } from '../usePerpsChartDataset'

const EMPTY_POINTS: Array<[number, number]> = []

/**
 * One total per day of the scope's asset class split, the smallest split every scope serves: its Total line read the
 * way the platform chart reads its own, so a day without a value is unknown, not zero. Loaded only when enabled.
 */
export function useRwaPerpsTotal(scope: RwaPerpsChartScope, metric: RWAPerpsChartMetric, enabled: boolean) {
	const { chartDataset, isChartLoading, chartError } = useRwaPerpsChartDataset({
		source: { kind: 'split', breakdown: 'assetClass' },
		metric,
		// A venue scope always counts CEX markets: the route rejects a CEX venue without the flag.
		includeCex: true,
		scope,
		enabled
	})
	const points = useMemo(() => {
		if (!enabled) return EMPTY_POINTS
		const { totalLabel } = getRwaPerpsChartMetricSpec(metric)
		const out: Array<[number, number]> = []
		for (const [timestamp, value] of getRwaDatasetPoints(ensureRwaTotalSeries(chartDataset, totalLabel), totalLabel)) {
			if (value != null) out.push([timestamp, value])
		}
		return out
	}, [chartDataset, enabled, metric])
	return { points, isLoading: isChartLoading, error: chartError }
}
