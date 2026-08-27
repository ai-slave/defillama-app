import { useRouter } from 'next/router'
import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { collectionHallmarks, hallmarkMetricsForKeys } from './chartHallmarks'
import { ChartRangeControl } from './ChartRangeControl'
import type { ExchangeOverviewChartModel } from './models'
import {
	DEFAULT_DIRECTORY_OVERVIEW_TAB,
	EXCHANGES_QUERY_KEYS,
	getDirectoryOverviewTab,
	type DirectoryOverviewTab,
	type ExchangeResearchRange
} from './queryState'
import { SegmentToggleLabel } from './segmentPresentation'

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
	{ value: 'spot', label: <SegmentToggleLabel segment="spot" />, ariaLabel: 'Spot' },
	{ value: 'linear_perp', label: <SegmentToggleLabel segment="linear_perp" />, ariaLabel: 'USD Perps' },
	{ value: 'inverse_perp', label: <SegmentToggleLabel segment="inverse_perp" />, ariaLabel: 'COIN Perps' }
] as const

const LINEAR_PERP_OI: SeriesSpec = {
	key: 'total_linear_perp_oi',
	label: 'USD perp OI',
	color: '#e48b52',
	type: 'line',
	right: true
}
const INVERSE_PERP_OI: SeriesSpec = {
	key: 'total_inverse_perp_oi',
	label: 'COIN perp OI',
	color: '#d76184',
	type: 'line',
	right: true
}

const LIQUIDITY_COLORS = { spot: '#5c9cf5', perp: '#9b7cf7', cex: '#9b7cf7', dex: '#33b38f' }

const ACTIVE_LIQUIDITY: Record<'spot' | 'linear_perp', SeriesSpec> = {
	spot: {
		key: 'total_spot_active_liquidity',
		label: 'Spot liquidity',
		color: LIQUIDITY_COLORS.spot,
		type: 'line',
		right: true
	},
	linear_perp: {
		key: 'total_linear_perp_active_liquidity',
		label: 'Perp liquidity',
		color: LIQUIDITY_COLORS.perp,
		type: 'line',
		right: true
	}
}

// Volume stacks as bars; open interest and active liquidity are lines on the right
// axis. Liquidity shares this tab rather than getting its own: reported volume is read
// against the liquidity backing it, and splitting them made that comparison a click.
// COIN perps carry no liquidity line because no band is computed for them.
const TAB_SERIES: Record<DirectoryOverviewTab, SeriesSpec[]> = {
	total: [
		{ key: 'total_spot_volume', label: 'Spot volume', color: '#5c9cf5', type: 'bar', stack: 'volume' },
		{ key: 'total_linear_perp_volume', label: 'USD perp volume', color: '#9b7cf7', type: 'bar', stack: 'volume' },
		{ key: 'total_inverse_perp_volume', label: 'COIN perp volume', color: '#33b38f', type: 'bar', stack: 'volume' },
		LINEAR_PERP_OI,
		INVERSE_PERP_OI,
		ACTIVE_LIQUIDITY.spot,
		ACTIVE_LIQUIDITY.linear_perp
	],
	spot: [
		{ key: 'cex_spot_volume', label: 'CEX', color: '#9b7cf7', type: 'bar', stack: 'volume' },
		{ key: 'dex_spot_volume', label: 'DEX', color: '#33b38f', type: 'bar', stack: 'volume' },
		ACTIVE_LIQUIDITY.spot
	],
	linear_perp: [
		{ key: 'cex_linear_perp_volume', label: 'CEX', color: '#9b7cf7', type: 'bar', stack: 'volume' },
		{ key: 'dex_linear_perp_volume', label: 'DEX', color: '#33b38f', type: 'bar', stack: 'volume' },
		LINEAR_PERP_OI,
		ACTIVE_LIQUIDITY.linear_perp
	],
	inverse_perp: [
		{ key: 'cex_inverse_perp_volume', label: 'CEX', color: '#9b7cf7', type: 'bar', stack: 'volume' },
		{ key: 'dex_inverse_perp_volume', label: 'DEX', color: '#33b38f', type: 'bar', stack: 'volume' },
		INVERSE_PERP_OI
	]
}

const UTC_DAY = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })
const UTC_TIMESTAMP = new Intl.DateTimeFormat('en', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'UTC',
	timeZoneName: 'short'
})

interface ResolvedSeries {
	spec: SeriesSpec
	values: Array<number | null>
}

function overviewAriaLabel(chart: ExchangeOverviewChartModel, resolved: ResolvedSeries[]): string {
	const parts = resolved.map(({ spec, values }) => {
		const last = values.findLastIndex((value) => value != null)
		const value = values[last]
		const day = chart.days[last]
		if (value == null || day === undefined) return `${spec.label}: no data.`
		return `${spec.label}: ${formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} on ${UTC_DAY.format(new Date(day * 1000))}.`
	})
	return `Exchange trading activity. ${parts.join(' ')}`
}

type DirectoryChartProps = { range: ExchangeResearchRange } & (
	| { chart: ExchangeOverviewChartModel; status?: never; showGlobalDataNotice: boolean }
	| { chart: null; status: 'loading' | 'error'; showGlobalDataNotice: boolean }
)

// Liquidity and Volume are daily histories; Order book is the current book by
// distance from mid. The captions below carry that difference so the labels stay short.
export function DirectoryChart({ chart, range, status, showGlobalDataNotice }: DirectoryChartProps) {
	const router = useRouter()
	const tab = getDirectoryOverviewTab(router.query)
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
		<ChartPanel>
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">Trading activity</h2>
				<ChartRangeControl range={range} />
				<SegmentedControl<DirectoryOverviewTab>
					value={tab}
					onValueChange={(nextTab) => {
						void pushShallowQuery(router, {
							[EXCHANGES_QUERY_KEYS.directoryChart]: nextTab === DEFAULT_DIRECTORY_OVERVIEW_TAB ? undefined : nextTab
						})
					}}
					options={TAB_OPTIONS}
					label="Chart view"
					variant="default"
					size="md"
				/>
			</ChartPanelToolbar>
			{chart ? (
				/* key forces a fresh chart per tab so series/axes are replaced, not merged. */
				<React.Suspense
					fallback={
						<ChartPanelBodyFallback>
							<LoadingIndicator />
						</ChartPanelBodyFallback>
					}
				>
					<ChartPanelBody role="img" aria-label={overviewAriaLabel(chart, resolved)}>
						<MultiSeriesChart
							key={tab}
							dataset={chartModel.dataset}
							charts={chartModel.charts}
							valueSymbol="$"
							height="360px"
							hideDefaultLegend={false}
							exportButtons="hidden"
							hallmarks={hallmarks}
						/>
					</ChartPanelBody>
				</React.Suspense>
			) : (
				<ChartPanelBodyFallback
					role={status === 'error' ? 'alert' : 'status'}
					aria-live={status === 'error' ? undefined : 'polite'}
					className={status === 'error' ? 'body-sm text-data-down' : undefined}
				>
					{status === 'error' ? 'Failed to load the exchange overview.' : <LoadingIndicator />}
				</ChartPanelBodyFallback>
			)}
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pt-0 pb-2 body-sm text-tertiary">
				<p>Daily volume, open positions and the liquidity backing them, summed across venues.</p>
				{showGlobalDataNotice ? <p>Totals and chart show global data</p> : null}
				{/* Reserve the timestamp line while data loads so only the 360px chart body swaps. */}
				<p aria-hidden={chart ? undefined : true} className={`ml-auto ${chart ? '' : 'invisible'}`.trim()}>
					{chart ? `Last updated ${UTC_TIMESTAMP.format(new Date(chart.lastUpdated))}` : 'Last updated'}
				</p>
			</div>
		</ChartPanel>
	)
}
