import { useRouter } from 'next/router'
import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { chartColor } from '~/constants/colors'
import { CHART_FILL, ChartPanelBody, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { ScopeNote, ignoredFiltersPhrase } from '~/ui/ScopeNote'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { formatUsd } from '~/utils/numberFormat'
import type { QueryRetry } from '~/utils/query'
import { pushShallowQuery } from '~/utils/routerQuery'
import { collectionHallmarks, hallmarkMetricsForKeys } from './chartHallmarks'
import { ChartRangeControl } from './ChartRangeControl'
import type { ExchangeOverviewChartModel } from './models'
import {
	DEFAULT_DIRECTORY_OVERVIEW_TAB,
	EXCHANGES_QUERY_KEYS,
	getDirectoryChartIgnoredFilters,
	getDirectoryOverviewTab,
	segmentQueryValue,
	type DirectoryOverviewTab,
	type ExchangeResearchRange
} from './queryState'
import { segmentToggle } from './segmentPresentation'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface SeriesSpec {
	/** One exact aggregate-series column per line; perpetual classes are never summed. */
	key: string
	label: string
	color: string
	type: 'bar' | 'line'
	right?: boolean
	stack?: string
}

const TAB_OPTIONS = [
	{ value: 'total', label: 'Total' },
	{ value: 'spot', ariaLabel: 'Spot', ...segmentToggle('spot') },
	{ value: 'linear_perp', ariaLabel: 'USD Perps', ...segmentToggle('linear_perp') },
	{ value: 'inverse_perp', ariaLabel: 'COIN Perps', ...segmentToggle('inverse_perp') }
] as const

const LINEAR_PERP_OI: SeriesSpec = {
	key: 'total_linear_perp_oi',
	label: 'USD perp OI',
	color: chartColor(3),
	type: 'line',
	right: true
}
const INVERSE_PERP_OI: SeriesSpec = {
	key: 'total_inverse_perp_oi',
	label: 'COIN perp OI',
	color: chartColor(4),
	type: 'line',
	right: true
}

const ACTIVE_LIQUIDITY: Record<'spot' | 'linear_perp', SeriesSpec> = {
	spot: {
		key: 'total_spot_active_liquidity',
		label: 'Spot liquidity',
		color: chartColor(0),
		type: 'line',
		right: true
	},
	linear_perp: {
		key: 'total_linear_perp_active_liquidity',
		label: 'Perp liquidity',
		color: chartColor(1),
		type: 'line',
		right: true
	}
}

// Volume stacks as bars; open interest and active liquidity are lines on the right
// axis. Liquidity shares this tab rather than getting its own: reported volume is read
// against the liquidity backing it, and splitting them made that comparison a click.
// COIN perps carry no liquidity line because no band is computed for them.
const TAB_SERIES: Record<DirectoryOverviewTab, Array<SeriesSpec>> = {
	total: [
		{ key: 'total_spot_volume', label: 'Spot volume', color: chartColor(0), type: 'bar', stack: 'volume' },
		{ key: 'total_linear_perp_volume', label: 'USD perp volume', color: chartColor(1), type: 'bar', stack: 'volume' },
		{ key: 'total_inverse_perp_volume', label: 'COIN perp volume', color: chartColor(2), type: 'bar', stack: 'volume' },
		LINEAR_PERP_OI,
		INVERSE_PERP_OI,
		ACTIVE_LIQUIDITY.spot,
		ACTIVE_LIQUIDITY.linear_perp
	],
	spot: [
		{ key: 'cex_spot_volume', label: 'CEX', color: chartColor(1), type: 'bar', stack: 'volume' },
		{ key: 'dex_spot_volume', label: 'DEX', color: chartColor(2), type: 'bar', stack: 'volume' },
		ACTIVE_LIQUIDITY.spot
	],
	linear_perp: [
		{ key: 'cex_linear_perp_volume', label: 'CEX', color: chartColor(1), type: 'bar', stack: 'volume' },
		{ key: 'dex_linear_perp_volume', label: 'DEX', color: chartColor(2), type: 'bar', stack: 'volume' },
		LINEAR_PERP_OI,
		ACTIVE_LIQUIDITY.linear_perp
	],
	inverse_perp: [
		{ key: 'cex_inverse_perp_volume', label: 'CEX', color: chartColor(1), type: 'bar', stack: 'volume' },
		{ key: 'dex_inverse_perp_volume', label: 'DEX', color: chartColor(2), type: 'bar', stack: 'volume' },
		INVERSE_PERP_OI
	]
}

const UTC_DAY = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })

interface ResolvedSeries {
	spec: SeriesSpec
	values: Array<number | null>
}

function overviewAriaLabel(chart: ExchangeOverviewChartModel, resolved: Array<ResolvedSeries>): string {
	const parts = resolved.map(({ spec, values }) => {
		const last = values.findLastIndex((value) => value != null)
		const value = values[last]
		const day = chart.days[last]
		if (value == null || day === undefined) return `${spec.label}: no data.`
		return `${spec.label}: ${formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} on ${UTC_DAY.format(new Date(day * 1000))}.`
	})
	return `Exchange trading activity. ${parts.join(' ')}`
}

type DirectoryChartProps = { range: ExchangeResearchRange; country: string | null } & (
	| { chart: ExchangeOverviewChartModel; failedRead?: never }
	// The read that failed, for the chart's Try again; null while the chart loads.
	| { chart: null; failedRead: QueryRetry | null }
)

// Liquidity and Volume are daily histories; Order book is the current book by
// distance from mid. The captions below carry that difference so the labels stay short.
export function DirectoryChart({ chart, range, failedRead, country }: DirectoryChartProps) {
	const router = useRouter()
	const tab = getDirectoryOverviewTab(router.query)
	const ignoredFilters = getDirectoryChartIgnoredFilters(router.query, country)
	const resolved = React.useMemo(
		() =>
			chart
				? TAB_SERIES[tab].flatMap((spec) => {
						const values = chart.series[spec.key]
						return values ? [{ spec, values }] : []
					})
				: [],
		[tab, chart]
	)
	const hallmarks = React.useMemo(
		() => collectionHallmarks(hallmarkMetricsForKeys(resolved.map(({ spec }) => spec.key))),
		[resolved]
	)
	const chartModel = React.useMemo(
		() =>
			chart
				? buildAlignedCartesianChartModel(
						chart.days,
						resolved.map(({ spec, values }) => ({
							name: spec.label,
							type: spec.type,
							color: spec.color,
							...(spec.type === 'bar' && spec.stack ? { stack: spec.stack } : null),
							yAxisIndex: spec.right ? 1 : 0,
							values
						}))
					)
				: buildAlignedCartesianChartModel([], []),
		[resolved, chart]
	)

	return (
		<Panel>
			<ChartPanelToolbar>
				<h2 className="mr-auto heading-xs">Trading activity</h2>
				<ChartRangeControl range={range} />
				<SegmentedControl<DirectoryOverviewTab>
					value={tab}
					onValueChange={(nextTab) => {
						void pushShallowQuery(router, {
							[EXCHANGES_QUERY_KEYS.directoryChart]:
								nextTab === DEFAULT_DIRECTORY_OVERVIEW_TAB ? undefined : segmentQueryValue(nextTab)
						})
					}}
					options={TAB_OPTIONS}
					label="Chart view"
					variant="default"
					size="md"
				/>
			</ChartPanelToolbar>
			{ignoredFilters.length > 0 ? (
				<ScopeNote>
					The totals and this chart ignore {ignoredFiltersPhrase(ignoredFilters)} and show every exchange.
				</ScopeNote>
			) : null}
			{/* Toolbar plus a 320px body matches the 360px summary card beside the chart. */}
			{chart ? (
				/* key forces a fresh chart per tab so series/axes are replaced, not merged. */
				<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[320px]" />}>
					<ChartPanelBody className="min-h-[320px]" role="img" aria-label={overviewAriaLabel(chart, resolved)}>
						<MultiSeriesChart
							key={tab}
							dataset={chartModel.dataset}
							charts={chartModel.charts}
							valueSymbol="$"
							containerClassName={`${CHART_FILL} min-h-[320px]`}
							showLegend
							exportButtons="hidden"
							hallmarks={hallmarks}
						/>
					</ChartPanelBody>
				</React.Suspense>
			) : failedRead ? (
				<SurfaceBodyStatus variant="error" retry={failedRead} style={{ minHeight: '320px' }}>
					Couldn&apos;t load the exchange overview.
				</SurfaceBodyStatus>
			) : (
				<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[320px]" />
			)}
			{/* The blurb and the last-updated stamp were dropped to keep the table above the fold. */}
		</Panel>
	)
}
