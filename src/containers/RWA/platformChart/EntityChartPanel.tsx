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
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { MetricChip } from '~/ui/MetricChip'
import { Panel } from '~/ui/Panel'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { parseRWAFlowGrouping, type RWAFlowGrouping } from '../flows'
import {
	getRwaEntityChartMetricsQuery,
	parseRwaEntityChartMetrics,
	RWA_ENTITY_CHART_METRICS_QUERY_KEY,
	RWA_ENTITY_CHART_PERIOD_QUERY_KEY,
	type RWAEntityChartCatalog,
	type RWAEntityChartData
} from './entityChart'
import { buildRwaPlatformEntityCsvDataset } from './metrics'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

/** The metrics and the period the address asks the entity chart for. */
export function useRwaEntityChartSelection<K extends string>(
	catalog: RWAEntityChartCatalog<K>
): { selected: Array<K>; period: RWAFlowGrouping } {
	const router = useRouter()
	const selected = useMemo(
		() => parseRwaEntityChartMetrics(catalog, router.query[RWA_ENTITY_CHART_METRICS_QUERY_KEY]),
		[catalog, router.query]
	)
	const period = parseRWAFlowGrouping(readSingleQueryValue(router.query[RWA_ENTITY_CHART_PERIOD_QUERY_KEY]))
	return { selected, period }
}

type RWAEntityChartPanelProps<K extends string> = RWAEntityChartData & {
	catalog: RWAEntityChartCatalog<K>
	selected: ReadonlyArray<K>
	filename: string
	title: string
}

/**
 * The Information view's chart of a platform or a venue: the entity as one series per metric, the protocol page's
 * Add Metrics dialog, chips and period control, the exports. The caller reads the selection and builds the series.
 */
export function RWAEntityChartPanel<K extends string>({
	catalog,
	selected,
	chart,
	isLoading,
	failedRead,
	filename,
	title
}: RWAEntityChartPanelProps<K>) {
	const router = useRouter()
	// The rendered chart, so the chips and the export describe what is on screen while a new period renders.
	const deferredChart = useDeferredValue(chart)
	const setSelected = (next: ReadonlyArray<K>) =>
		void pushShallowQuery(router, {
			[RWA_ENTITY_CHART_METRICS_QUERY_KEY]: getRwaEntityChartMetricsQuery(catalog, next)
		})
	const toggle = (key: K) =>
		setSelected(selected.includes(key) ? selected.filter((entry) => entry !== key) : [...selected, key])
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const colorByName = new Map(deferredChart.series.map((entry) => [entry.name, entry.color]))

	return (
		<Panel className="flex-1">
			<ChartPanelToolbar
				leading={
					<>
						<ChartMetricsDialog
							groups={catalog.groups.map((group) => ({
								label: group,
								options: catalog.metrics
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
								atDefault: getRwaEntityChartMetricsQuery(catalog, selected) === undefined,
								onReset: () => setSelected([])
							}}
						/>
						{catalog.metrics
							.filter((metric) => selected.includes(metric.key))
							.map((metric) => (
								<MetricChip
									key={metric.key}
									label={metric.label}
									color={colorByName.get(metric.label) ?? 'var(--text-tertiary)'}
									onRemove={() => toggle(metric.key)}
								/>
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
			{failedRead ? (
				<SurfaceBodyStatus variant="error" retry={failedRead}>
					Couldn&apos;t load chart data.
				</SurfaceBodyStatus>
			) : isLoading && deferredChart.series.every((series) => (series.data?.length ?? 0) === 0) ? (
				<SurfaceBodyLoadingStatus label="Loading chart" />
			) : (
				<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
					<MultiSeriesChart
						dataset={EMPTY_DATASET}
						charts={deferredChart.series}
						hallmarks={deferredChart.hallmarks}
						showLegend={deferredChart.series.length > 1}
						valueSymbol="$"
						groupBy={deferredChart.period}
						onReady={handleChartReady}
					/>
				</Suspense>
			)}
		</Panel>
	)
}
