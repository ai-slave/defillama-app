import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartMetricsDialog } from '~/components/ChartMetricsDialog'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { metricChipStyles } from '~/ui/MetricChip'
import { LoadingIndicator } from '~/ui/Status'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { IRWAAssetsOverview } from '../api.types'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'
import { rwaSlug } from '../rwaSlug'
import {
	buildRwaPlatformEntityCsvDataset,
	getRwaPlatformChartMetricsQuery,
	parseRwaPlatformChartMetrics,
	RWA_PLATFORM_CHART_METRICS,
	RWA_PLATFORM_CHART_METRICS_QUERY_KEY,
	type RWAPlatformChartGroup,
	type RWAPlatformChartMetricKey,
	type RWAPlatformChartPeriod
} from './metrics'
import { usePlatformEntityChart, type RWAPlatformEntityChartData } from './usePlatformEntityChart'

// A chip leaves once its metric turns off, after the URL updates. Focus moves to the next chip, else the previous one,
// else the metrics button before the chips.
const focusNeighbourChipOnLeave = passFocusOnLeave((chip) => {
	const next = neighbourRowControl(chip, chip)
	return next?.querySelector<HTMLElement>('input') ?? next
})

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

export const RWA_PLATFORM_CHART_PERIOD_QUERY_KEY = 'chartPeriod'
const PERIODS: ReadonlyArray<RWAPlatformChartPeriod> = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
const GROUP_ORDER: ReadonlyArray<RWAPlatformChartGroup> = ['Core', 'Flows', 'Ratios', 'Assets', 'Annotations']
const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

function parsePeriod(value: string | undefined): RWAPlatformChartPeriod {
	return PERIODS.find((period) => period === value) ?? 'daily'
}

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
 * The Information view's chart: the platform as one series per metric, Add Metrics over the twelve series the page
 * folds, the protocol page's chips and period control. The Group by never touches it.
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
	const router = useRouter()
	const selected = useMemo(
		() => parseRwaPlatformChartMetrics(router.query[RWA_PLATFORM_CHART_METRICS_QUERY_KEY]),
		[router.query]
	)
	const period = parsePeriod(readSingleQueryValue(router.query[RWA_PLATFORM_CHART_PERIOD_QUERY_KEY]))
	const { chart, isLoading, error } = usePlatformEntityChart({
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
	const deferredChart = useDeferredValue(chart)
	const setSelected = (next: ReadonlyArray<RWAPlatformChartMetricKey>) =>
		void pushShallowQuery(router, { [RWA_PLATFORM_CHART_METRICS_QUERY_KEY]: getRwaPlatformChartMetricsQuery(next) })
	const toggle = (key: RWAPlatformChartMetricKey) =>
		setSelected(selected.includes(key) ? selected.filter((entry) => entry !== key) : [...selected, key])

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const filename = `rwa-platform-${meta.slug || rwaSlug(meta.name)}-chart`

	return (
		<ChartPanel className="flex-1">
			<EntityChartToolbar
				selected={selected}
				period={period}
				chart={deferredChart}
				filename={filename}
				title={meta.name}
				chartInstance={chartInstance}
				onToggle={toggle}
				onReset={() => setSelected([])}
				onPeriodChange={(next) =>
					void pushShallowQuery(router, { [RWA_PLATFORM_CHART_PERIOD_QUERY_KEY]: next === 'daily' ? undefined : next })
				}
			/>
			{isLoading && deferredChart.series.every((series) => (series.data?.length ?? 0) === 0) ? (
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator />
				</ChartPanelBodyFallback>
			) : error ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
					{error}
				</ChartPanelBodyFallback>
			) : (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={EMPTY_DATASET}
						charts={deferredChart.series}
						hallmarks={deferredChart.hallmarks}
						hallmarksInMs
						containerClassName="flex-1 min-h-[360px]"
						hideDefaultLegend={deferredChart.series.length < 2}
						valueSymbol="$"
						groupBy={deferredChart.period}
						onReady={handleChartReady}
					/>
				</Suspense>
			)}
		</ChartPanel>
	)
}

/** The chips for the selected metrics, the period control and the exports. */
function EntityChartToolbar({
	selected,
	period,
	chart,
	filename,
	title,
	chartInstance,
	onToggle,
	onReset,
	onPeriodChange
}: {
	selected: ReadonlyArray<RWAPlatformChartMetricKey>
	period: RWAPlatformChartPeriod
	/** The rendered chart, so the chips and the export describe what is on screen while a new period renders. */
	chart: RWAPlatformEntityChartData['chart']
	filename: string
	title: string
	chartInstance: () => echarts.ECharts | null
	onToggle: (key: RWAPlatformChartMetricKey) => void
	onReset: () => void
	onPeriodChange: (period: RWAPlatformChartPeriod) => void
}) {
	const colorByName = new Map(chart.series.map((entry) => [entry.name, entry.color]))
	return (
		<ChartPanelToolbar
			leading={
				<>
					<ChartMetricsDialog
						groups={GROUP_ORDER.map((group) => ({
							label: group,
							options: RWA_PLATFORM_CHART_METRICS.filter((metric) => metric.group === group).map((metric) => ({
								key: metric.key,
								label: metric.label,
								description: metric.description,
								color: colorByName.get(metric.label) ?? 'var(--text-tertiary)',
								active: selected.includes(metric.key)
							}))
						}))}
						onToggle={(option) => onToggle(option.key)}
						clear={{
							kind: 'reset',
							atDefault: getRwaPlatformChartMetricsQuery(selected) === undefined,
							onReset
						}}
					/>
					{RWA_PLATFORM_CHART_METRICS.filter((metric) => selected.includes(metric.key)).map((metric) => (
						<label
							key={metric.key}
							ref={focusNeighbourChipOnLeave}
							className="relative flex cursor-pointer flex-nowrap items-center gap-1"
						>
							<input
								type="checkbox"
								value={metric.key}
								checked
								onChange={() => onToggle(metric.key)}
								className="peer absolute size-[1em] opacity-[0.00001]"
							/>
							<span
								className={metricChipStyles}
								style={{ borderColor: colorByName.get(metric.label) ?? 'var(--text-tertiary)' }}
							>
								<span>{metric.label}</span>
								<Icon name="x" className="size-3.5" />
							</span>
						</label>
					))}
				</>
			}
		>
			<ChartGroupingSelector value={period} options={DWM_GROUPING_OPTIONS_LOWERCASE} onValueChange={onPeriodChange} />
			<ChartCsvExportButton
				chartInstance={chartInstance}
				filename={filename}
				source={{
					type: 'dataset',
					prepare: () => buildRwaPlatformEntityCsvDataset(chart.series, chart.period)
				}}
			/>
			<ChartPngExportButton chartInstance={chartInstance} filename={filename} title={title} />
		</ChartPanelToolbar>
	)
}
