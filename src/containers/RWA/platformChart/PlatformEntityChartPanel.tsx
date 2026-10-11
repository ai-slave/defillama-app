import type { IRWAAssetsOverview } from '../api.types'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'
import { rwaSlug } from '../rwaSlug'
import { RWAEntityChartPanel, useRwaEntityChartSelection } from './EntityChartPanel'
import { RWA_PLATFORM_CHART } from './metrics'
import { usePlatformEntityChart } from './usePlatformEntityChart'

export type RWAPlatformEntityChartPanelProps = {
	overview: IRWAAssetsOverview
	meta: RWAPlatformMeta
	aggregateAssets: IRWAAssetsOverview['assets']
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	/** A scope flag or a filter differs from the page defaults, so the build-time dataset does not apply. */
	activeFilters: boolean
}

/**
 * The platform's Information chart: one series per metric over the twelve the page folds. The Group by never
 * touches it.
 */
export function RWAPlatformEntityChartPanel({
	overview,
	meta,
	aggregateAssets,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl,
	activeFilters
}: RWAPlatformEntityChartPanelProps) {
	const { selected, period } = useRwaEntityChartSelection(RWA_PLATFORM_CHART)
	const data = usePlatformEntityChart({
		overview,
		meta,
		aggregateAssets,
		selected,
		period,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		activeFilters
	})
	return (
		<RWAEntityChartPanel
			catalog={RWA_PLATFORM_CHART}
			selected={selected}
			{...data}
			filename={`rwa-platform-${meta.slug || rwaSlug(meta.name)}-chart`}
			title={meta.name}
		/>
	)
}
