import type { RWAChartDataset } from '~/containers/RWA/chartDataset'
import { setRWAPerpsChartScope } from './api'
import { getDefaultRWAPerpsChartBreakdown, type RWAPerpsChartDefaults, type RWAPerpsChartState } from './chartState'
import type {
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsMarketBreakdownRequest,
	IRWAPerpsOverviewBreakdownRequest,
	RWAPerpsChartMode,
	RWAPerpsMarketBreakdownTarget
} from './types'

export const FOREX_ASSET_CLASS = 'Forex Perps'

export type RWAPerpsTimeSeriesRequest =
	| ({ source: 'market-breakdown' } & IRWAPerpsMarketBreakdownRequest)
	| ({ source: 'contract-breakdown' } & IRWAPerpsContractBreakdownRequest)
	| ({ source: 'overview-breakdown' } & IRWAPerpsOverviewBreakdownRequest)

/**
 * Which history the dashboard chart shows and whether it must fetch it.
 *
 * Asset pages and user-filtered rows need per-market history (projected onto the visible rows); every
 * other page uses its aggregate. An asset-class page, or the overview with Forex left out, scopes the
 * request by asset class. The server-preloaded dataset stands in for the fetch only in the default
 * state it was built for: default metric and breakdown, no Forex opt-in, and the page's default CEX scope.
 */
export function planRWAPerpsTimeSeriesQuery({
	mode,
	scopeName,
	chartState,
	chartDefaults,
	assetClassFilter,
	showForexToggle,
	includeForex,
	includeCex,
	includeCexByDefault,
	hasActiveMarketFilters,
	hasIncludedRows,
	initialChartDataset
}: {
	mode: RWAPerpsChartMode
	/** The venue, asset group, or asset the page is scoped to; ignored on the overview. */
	scopeName: string
	chartState: RWAPerpsChartState
	chartDefaults: RWAPerpsChartDefaults
	assetClassFilter: string | undefined
	showForexToggle: boolean
	includeForex: boolean
	includeCex: boolean
	includeCexByDefault: boolean
	hasActiveMarketFilters: boolean
	hasIncludedRows: boolean
	initialChartDataset: RWAChartDataset
}): { request: RWAPerpsTimeSeriesRequest; useInitialDataset: boolean; enabled: boolean } {
	const classTarget: RWAPerpsMarketBreakdownTarget | null = assetClassFilter
		? { kind: 'assetClass', slug: assetClassFilter }
		: showForexToggle && !includeForex
			? { kind: 'excludeAssetClass', slug: FOREX_ASSET_CLASS }
			: null
	const aggregateTarget: RWAPerpsMarketBreakdownTarget =
		mode === 'venue'
			? { kind: 'venue', slug: scopeName }
			: mode === 'assetGroup'
				? { kind: 'assetGroup', slug: scopeName }
				: { kind: 'all' }
	const pageTarget: RWAPerpsMarketBreakdownTarget =
		mode === 'asset' ? { kind: 'baseAsset', slug: scopeName } : aggregateTarget

	let request: RWAPerpsTimeSeriesRequest
	if (mode === 'asset' || hasActiveMarketFilters) {
		request = { source: 'market-breakdown', key: chartState.metric, target: classTarget ?? pageTarget, includeCex }
	} else if (chartState.breakdown === 'contract') {
		request = {
			source: 'contract-breakdown',
			key: chartState.metric,
			target: classTarget ?? aggregateTarget,
			includeCex
		}
	} else {
		request = {
			source: 'overview-breakdown',
			key: chartState.metric,
			breakdown: chartState.breakdown,
			target: classTarget ?? aggregateTarget,
			includeCex
		}
	}

	const isDefaultTimeSeriesState =
		chartState.view === 'timeSeries' &&
		chartState.metric === 'openInterest' &&
		chartState.breakdown === getDefaultRWAPerpsChartBreakdown(mode, 'timeSeries', chartDefaults)
	const hasPreloadedDataset =
		initialChartDataset.source.length > 0 ||
		initialChartDataset.dimensions.some((dimension) => dimension !== 'timestamp')
	const canUseInitialDataset =
		(request.source !== 'market-breakdown' || mode === 'asset') &&
		(!showForexToggle || !includeForex) &&
		includeCex === includeCexByDefault
	const useInitialDataset = isDefaultTimeSeriesState && hasPreloadedDataset && canUseInitialDataset

	return {
		request,
		useInitialDataset,
		enabled: chartState.view === 'timeSeries' && !useInitialDataset && hasIncludedRows
	}
}

/** The app API route that serves a time-series request, with the request's metric, grouping, and scope. */
export function rwaPerpsTimeSeriesUrl(request: RWAPerpsTimeSeriesRequest): string {
	const searchParams =
		request.source === 'overview-breakdown'
			? new URLSearchParams({ breakdown: request.breakdown, key: request.key })
			: new URLSearchParams({ key: request.key })
	setRWAPerpsChartScope(searchParams, request)
	return `/api/public/rwa/perps/${request.source}?${searchParams.toString()}`
}
