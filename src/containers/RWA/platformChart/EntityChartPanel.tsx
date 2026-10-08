import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartMetricsDialog } from '~/components/ChartMetricsDialog'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { metricChipStyles } from '~/ui/MetricChip'
import { LoadingIndicator } from '~/ui/Status'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { parseRWAFlowGrouping, type RWAFlowGrouping } from '../flows'
import {
	getRwaEntityChartMetricsQuery,
	parseRwaEntityChartMetrics,
	RWA_ENTITY_CHART_METRICS_QUERY_KEY,
	RWA_ENTITY_CHART_PERIOD_QUERY_KEY,
	type RWAEntityChartCatalogue,
	type RWAEntityChartData
} from './entityChart'
import { buildRwaPlatformEntityCsvDataset } from './metrics'

// A chip leaves once its metric turns off, after the URL updates. Focus moves to the next chip, else the previous one,
// else the metrics button before the chips.
const focusNeighbourChipOnLeave = passFocusOnLeave((chip) => {
	const next = neighbourRowControl(chip, chip)
	return next?.querySelector<HTMLElement>('input') ?? next
})

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

/** The metrics and the period the address asks the entity chart for. */
export function useRwaEntityChartSelection<K extends string>(
	catalogue: RWAEntityChartCatalogue<K>
): { selected: Array<K>; period: RWAFlowGrouping } {
	const router = useRouter()
	const selected = useMemo(
		() => parseRwaEntityChartMetrics(catalogue, router.query[RWA_ENTITY_CHART_METRICS_QUERY_KEY]),
		[catalogue, router.query]
	)
	const period = parseRWAFlowGrouping(readSingleQueryValue(router.query[RWA_ENTITY_CHART_PERIOD_QUERY_KEY]))
	return { selected, period }
}

type RWAEntityChartPanelProps<K extends string> = RWAEntityChartData & {
	catalogue: RWAEntityChartCatalogue<K>
	selected: ReadonlyArray<K>
	filename: string
	title: string
}

/**
 * The Information view's chart of a platform or a venue: the entity as one series per metric, the protocol page's
 * Add Metrics dialog, chips and period control, the exports. The caller reads the selection and builds the series.
 */
export function RWAEntityChartPanel<K extends string>({
	catalogue,
	selected,
	chart,
	isLoading,
	error,
	filename,
	title
}: RWAEntityChartPanelProps<K>) {
	const router = useRouter()
	// The rendered chart, so the chips and the export describe what is on screen while a new period renders.
	const deferredChart = useDeferredValue(chart)
	const setSelected = (next: ReadonlyArray<K>) =>
		void pushShallowQuery(router, {
			[RWA_ENTITY_CHART_METRICS_QUERY_KEY]: getRwaEntityChartMetricsQuery(catalogue, next)
		})
	const toggle = (key: K) =>
		setSelected(selected.includes(key) ? selected.filter((entry) => entry !== key) : [...selected, key])
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const colorByName = new Map(deferredChart.series.map((entry) => [entry.name, entry.color]))

	return (
		<ChartPanel className="flex-1">
			<ChartPanelToolbar
				leading={
					<>
						<ChartMetricsDialog
							groups={catalogue.groups.map((group) => ({
								label: group,
								options: catalogue.metrics
									.filter((metric) => metric.group === group)
									.map((metric) => ({
										key: metric.key,
										label: metric.label,
										description: metric.description,
										color: colorByName.get(metric.label) ?? 'var(--text-tertiary)',
										active: selected.includes(metric.key)
									}))
							}))}
							onToggle={(option) => toggle(option.key)}
							clear={{
								kind: 'reset',
								atDefault: getRwaEntityChartMetricsQuery(catalogue, selected) === undefined,
								onReset: () => setSelected([])
							}}
						/>
						{catalogue.metrics
							.filter((metric) => selected.includes(metric.key))
							.map((metric) => (
								<label
									key={metric.key}
									ref={focusNeighbourChipOnLeave}
									className="relative flex cursor-pointer flex-nowrap items-center gap-1"
								>
									<input
										type="checkbox"
										value={metric.key}
										checked
										onChange={() => toggle(metric.key)}
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
				<ChartGroupingSelector
					value={chart.period}
					options={DWMC_GROUPING_OPTIONS_LOWERCASE}
					onValueChange={(next) =>
						void pushShallowQuery(router, { [RWA_ENTITY_CHART_PERIOD_QUERY_KEY]: next === 'daily' ? undefined : next })
					}
				/>
				<ChartCsvExportButton
					chartInstance={chartInstance}
					filename={filename}
					source={{
						type: 'dataset',
						prepare: () => buildRwaPlatformEntityCsvDataset(deferredChart.series, deferredChart.period)
					}}
				/>
				<ChartPngExportButton chartInstance={chartInstance} filename={filename} title={title} />
			</ChartPanelToolbar>
			{isLoading && deferredChart.series.every((series) => (series.data?.length ?? 0) === 0) ? (
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator />
				</ChartPanelBodyFallback>
			) : error ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-error">
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
