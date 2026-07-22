import { useRouter } from 'next/router'
import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { formattedNum } from '~/utils'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ExchangeOverviewChartModel } from './models'
import {
	DEFAULT_DIRECTORY_OVERVIEW_TAB,
	EXCHANGES_QUERY_KEYS,
	getDirectoryOverviewTab,
	type DirectoryOverviewTab
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
	{ value: 'linear_perp', label: <SegmentToggleLabel segment="linear_perp" />, ariaLabel: 'Linear Perps' },
	{ value: 'inverse_perp', label: <SegmentToggleLabel segment="inverse_perp" />, ariaLabel: 'Inverse Perps' }
] as const

const LINEAR_PERP_OI: SeriesSpec = {
	key: 'total_linear_perp_oi',
	label: 'Linear perp OI',
	color: '#e48b52',
	type: 'line',
	right: true
}
const INVERSE_PERP_OI: SeriesSpec = {
	key: 'total_inverse_perp_oi',
	label: 'Inverse perp OI',
	color: '#d76184',
	type: 'line',
	right: true
}

// Volume series stack as bars; open interest is a line on the right axis.
const TAB_SERIES: Record<DirectoryOverviewTab, SeriesSpec[]> = {
	total: [
		{ key: 'total_spot_volume', label: 'Spot volume', color: '#5c9cf5', type: 'bar', stack: 'volume' },
		{ key: 'total_linear_perp_volume', label: 'Linear perp volume', color: '#9b7cf7', type: 'bar', stack: 'volume' },
		{ key: 'total_inverse_perp_volume', label: 'Inverse perp volume', color: '#33b38f', type: 'bar', stack: 'volume' },
		LINEAR_PERP_OI,
		INVERSE_PERP_OI
	],
	spot: [
		{ key: 'cex_spot_volume', label: 'CEX', color: '#9b7cf7', type: 'bar', stack: 'volume' },
		{ key: 'dex_spot_volume', label: 'DEX', color: '#33b38f', type: 'bar', stack: 'volume' }
	],
	linear_perp: [
		{ key: 'cex_linear_perp_volume', label: 'CEX', color: '#9b7cf7', type: 'bar', stack: 'volume' },
		{ key: 'dex_linear_perp_volume', label: 'DEX', color: '#33b38f', type: 'bar', stack: 'volume' },
		LINEAR_PERP_OI
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
		if (last < 0) return `${spec.label}: no data.`
		return `${spec.label}: ${formattedNum(values[last] as number, true)} on ${UTC_DAY.format(new Date(chart.days[last] * 1000))}.`
	})
	return `Exchange trading activity. ${parts.join(' ')}`
}

type DirectoryChartProps =
	| { chart: ExchangeOverviewChartModel; status?: never; showGlobalDataNotice: boolean }
	| { chart: null; status: 'loading' | 'error'; showGlobalDataNotice: boolean }

export function DirectoryChart({ chart, status, showGlobalDataNotice }: DirectoryChartProps) {
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
	const chartModel = React.useMemo(
		() =>
			chart
				? buildAlignedCartesianChartModel(
						chart.days,
						resolved.map(({ spec, values }) => ({
							name: spec.label,
							type: spec.type,
							color: spec.color,
							stack: spec.type === 'bar' ? spec.stack : undefined,
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
				{showGlobalDataNotice ? <p>Totals and chart show global data</p> : null}
				{/* Reserve the timestamp line while data loads so only the 360px chart body swaps. */}
				<p aria-hidden={chart ? undefined : true} className={`ml-auto ${chart ? '' : 'invisible'}`.trim()}>
					{chart ? `Last updated ${UTC_TIMESTAMP.format(new Date(chart.lastUpdated))}` : 'Last updated'}
				</p>
			</div>
		</ChartPanel>
	)
}
