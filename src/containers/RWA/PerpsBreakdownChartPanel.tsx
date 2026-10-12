import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Select } from '~/ui/Select'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { RWAOverviewDisplayRow } from './api.types'
import {
	getRwaChartViewOptions,
	getRwaPerpsChartMetricOptions,
	getRwaPerpsChartMetricQueryValue,
	getRwaPerpsChartMetricSpec,
	getRwaPerpsChartPlan,
	getRwaPerpsChartSource,
	getRwaPerpsGroupLabels,
	getRwaPerpsMetricLabel,
	parseRwaPerpsChartMetric,
	parseRwaPerpsChartView,
	type RWAPerpsChartMetric
} from './chartBreakdown'
import { toRwaMultiSeriesChartDataset, type RWAPositionalChartDataset } from './chartDataset'
import { getRwaRankedSeriesNames } from './chartFold'
import { buildRwaPerpsTimeSeriesChart } from './chartSeries'
import { getChartViewQueryValue } from './chartState'
import { parseRWAFlowGrouping, RWA_FLOW_GROUPING_OPTIONS, type RWAFlowGrouping } from './flows'
import type { RWAPageKind } from './layout/pageLayout'
import { useRwaPerpsHistoryDataset } from './perpsHistoryFold'
import {
	buildRwaPerpsRowSnapshot,
	buildRwaPerpsSnapshot,
	getRwaPerpsSnapshotLabel,
	getRwaPerpsSnapshotWindowDays
} from './perpsSnapshot'
import { readRwaSeriesPick, RWA_SERIES_PICK_CLEARED } from './seriesPick'
import { RWASeriesPicker } from './SeriesPicker'
import { RWASnapshotChartPanel } from './SnapshotChartPanel'
import { getRwaCsvFileName } from './table/csv'
import type { RWAGroupBy } from './table/groupBy'
import { useRwaPerpsChartDataset, type RwaPerpsChartScope } from './usePerpsChartDataset'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const EMPTY_DATASET: RWAPositionalChartDataset = { dimensions: ['timestamp'], source: [] }
/** The volume period lives under the flows key, so one link format serves every RWA chart period. */
const PERIOD_QUERY_KEY = 'flowMode'

export type RWAPerpsBreakdownChartPanelProps = {
	/** The markets the page covers: all, an asset group, an underlying or a venue. */
	scope: RwaPerpsChartScope
	groupBy: RWAGroupBy
	includeCex: boolean
	/** The page's markets after its filters: the fold and the pie, treemap and bar views read them. */
	markets: ReadonlyArray<RWAOverviewDisplayRow>
	/** A filter other than Venue Type narrows the markets, so the chart folds the per-market history over them. */
	isFiltered: boolean
	/** Names the png export, such as "trade[XYZ]" or "RWA Perps". */
	title: string
	pageKind: RWAPageKind
	/** The page's slug for the export file name; null on the overview. */
	slug: string | null
}

/**
 * The perps chart of every Perps page: the scope's markets split by the Group by (one series per market under None,
 * the picked members and Others), open interest and markets as lines with a Total, volume as stacked bars by period.
 * Unfiltered it reads the server split; under a filter, or when an underlying's page groups its markets, it folds the
 * per-market history over the page's markets. Share draws each row as percent; pie, treemap and bar draw one value
 * per group, from the page's rows when they carry the window.
 */
export function RWAPerpsBreakdownChartPanel({
	scope,
	groupBy,
	includeCex,
	markets,
	isFiltered,
	title,
	pageKind,
	slug
}: RWAPerpsBreakdownChartPanelProps) {
	const router = useRouter()
	const metric: RWAPerpsChartMetric = parseRwaPerpsChartMetric(readSingleQueryValue(router.query.chartType))
	const period = parseRWAFlowGrouping(readSingleQueryValue(router.query[PERIOD_QUERY_KEY]))
	const isVolume = metric === 'volume'
	const view = parseRwaPerpsChartView(metric, readSingleQueryValue(router.query.chartView))
	const viewOptions = getRwaChartViewOptions(metric)
	const isTimeSeries = view === 'timeSeries' || view === 'share'
	const { valueSymbol } = getRwaPerpsChartMetricSpec(metric)
	const plan = getRwaPerpsChartPlan({ scope, groupBy, isFiltered })
	const groupLabels = getRwaPerpsGroupLabels(groupBy)
	const rowSnapshot = isTimeSeries ? null : buildRwaPerpsRowSnapshot(markets, { metric, period, groupBy, includeCex })
	/* The pie, treemap and bar views read the rows when they carry the window; otherwise the history loads. */
	const needsHistory = isTimeSeries || rowSnapshot == null
	const split = useRwaPerpsChartDataset({
		source: getRwaPerpsChartSource(groupBy),
		metric,
		includeCex,
		scope,
		enabled: needsHistory && plan === 'split'
	})
	const fold = useRwaPerpsHistoryDataset({
		scope,
		metric,
		groupBy,
		marketIds: null,
		rows: markets,
		includeCex,
		enabled: needsHistory && plan === 'fold'
	})
	const isLoading = split.isChartLoading || fold.isLoading
	// The plan reads one of the two, so at most one has a failed read.
	const failedRead = split.failedRead ?? fold.failedRead

	// The React Compiler memoizes this; a manual useMemo could not be preserved over the router reads.
	const chart = (() => {
		const dataset =
			plan === 'fold' ? (fold.dataset ? toRwaMultiSeriesChartDataset(fold.dataset) : EMPTY_DATASET) : split.chartDataset
		const pickOptions = getRwaRankedSeriesNames(dataset)
		const picked = readRwaSeriesPick(router.query, pickOptions)
		return {
			...buildRwaPerpsTimeSeriesChart({
				dataset,
				metric,
				view: view === 'share' ? 'share' : 'timeSeries',
				period,
				picked
			}),
			slices:
				rowSnapshot ??
				(isTimeSeries ? [] : buildRwaPerpsSnapshot(dataset, getRwaPerpsSnapshotWindowDays(metric, period))),
			isEmpty: pickOptions.length === 0 || picked.length === 0,
			isShare: view === 'share',
			isVolume,
			period,
			pickOptions,
			picked
		}
	})()
	const deferredChart = useDeferredValue(chart)

	const chartExport = useGetChartInstance()
	const metricLabel = getRwaPerpsMetricLabel(metric)
	const filename = getRwaCsvFileName(pageKind, slug, 'chart').replace(/\.csv$/, '')
	const snapshotLabel = getRwaPerpsSnapshotLabel(metric, period)

	const metricSwitch = (
		<SegmentedControl<RWAPerpsChartMetric>
			value={metric}
			onValueChange={(key) =>
				void pushShallowQuery(router, { chartType: getRwaPerpsChartMetricQueryValue(key), ...RWA_SERIES_PICK_CLEARED })
			}
			options={getRwaPerpsChartMetricOptions().map(({ key, label }) => ({ value: key, label }))}
			label="Chart type"
			variant="default"
			size="md"
			className="max-w-full overflow-x-auto"
		/>
	)
	const periodSwitch = isVolume ? (
		<SegmentedControl<RWAFlowGrouping>
			value={period}
			onValueChange={(next) =>
				void pushShallowQuery(router, { [PERIOD_QUERY_KEY]: next === 'daily' ? undefined : next })
			}
			options={RWA_FLOW_GROUPING_OPTIONS}
			label="Volume period"
			variant="default"
			size="md"
		/>
	) : null
	const viewSwitch = (
		<Select
			heading="Chart view"
			allValues={viewOptions}
			selectedValues={view}
			setSelectedValues={(value: string) => {
				const next = viewOptions.find((option) => option.key === value)?.key ?? view
				void pushShallowQuery(router, { chartView: getChartViewQueryValue(next) })
			}}
			label={viewOptions.find(({ key }) => key === view)?.name ?? 'Time Series Chart'}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)

	if (!isTimeSeries) {
		return (
			<RWASnapshotChartPanel
				view={view}
				slices={chart.slices}
				valueSymbol={valueSymbol}
				valueLabel={snapshotLabel}
				groupLabel={groupLabels.one}
				exportTitle={`${title} ${snapshotLabel}`}
				filename={filename}
				isLoading={isLoading}
				failedRead={failedRead}
				leading={metricSwitch}
				controls={
					<>
						{periodSwitch}
						{viewSwitch}
					</>
				}
			/>
		)
	}

	const plotsSeries = !failedRead && !isLoading && !deferredChart.isEmpty
	return (
		<Panel className="flex flex-1 flex-col">
			<ChartPanelToolbar leading={metricSwitch}>
				{periodSwitch}
				{viewSwitch}
				<RWASeriesPicker label={groupLabels.many} options={chart.pickOptions} picked={chart.picked} />
				{plotsSeries ? (
					<>
						<ChartCsvExportButton
							chart={chartExport}
							filename={filename}
							source={{ type: 'dataset', prepare: deferredChart.csv }}
						/>
						<ChartPngExportButton chart={chartExport} filename={filename} title={`${title} ${metricLabel}`} />
					</>
				) : null}
			</ChartPanelToolbar>
			{failedRead ? (
				<SurfaceBodyStatus variant="error" retry={failedRead}>
					Couldn&apos;t load chart data.
				</SurfaceBodyStatus>
			) : isLoading ? (
				<SurfaceBodyLoadingStatus label="Loading chart" />
			) : deferredChart.isEmpty ? (
				<SurfaceBodyStatus variant="empty">No data for this view.</SurfaceBodyStatus>
			) : (
				<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
					<MultiSeriesChart
						exportButtons={chartExport}
						dataset={deferredChart.dataset}
						charts={deferredChart.charts}
						showLegend
						showTotalInTooltip={deferredChart.isVolume && !deferredChart.isShare}
						expandTo100Percent={deferredChart.isShare}
						valueSymbol={valueSymbol}
						{...(deferredChart.isVolume ? { groupBy: deferredChart.period } : {})}
					/>
				</Suspense>
			)}
		</Panel>
	)
}
