import * as Ariakit from '@ariakit/react'
import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { Button, buttonStyles } from '~/ui/Button'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import { LoadingDots } from '~/ui/Loaders'
import { metricChipStyles, metricOptionChipStyles } from '~/ui/MetricChip'
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

	const { chartInstance, handleChartReady } = useChartImageExport()
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
				onClear={() => setSelected([])}
				onPeriodChange={(next) =>
					void pushShallowQuery(router, { [RWA_PLATFORM_CHART_PERIOD_QUERY_KEY]: next === 'daily' ? undefined : next })
				}
			/>
			{isLoading && deferredChart.series.every((series) => (series.data?.length ?? 0) === 0) ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
					Loading
					<LoadingDots />
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
	onClear,
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
	onClear: () => void
	onPeriodChange: (period: RWAPlatformChartPeriod) => void
}) {
	const colorByName = new Map(chart.series.map((entry) => [entry.name, entry.color]))
	return (
		<ChartPanelToolbar>
			<MetricsDialog selected={selected} onToggle={onToggle} onClear={onClear} />
			{RWA_PLATFORM_CHART_METRICS.filter((metric) => selected.includes(metric.key)).map((metric) => (
				<label
					key={metric.key}
					className="relative flex cursor-pointer flex-nowrap items-center gap-1 last-of-type:mr-auto"
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
			<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
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
			</div>
		</ChartPanelToolbar>
	)
}

/** The protocol page's Chart metrics dialog over the platform's catalogue: grouped chips, a search, clear all, done. */
function MetricsDialog({
	selected,
	onToggle,
	onClear
}: {
	selected: ReadonlyArray<RWAPlatformChartMetricKey>
	onToggle: (key: RWAPlatformChartMetricKey) => void
	onClear: () => void
}) {
	const store = Ariakit.useDialogStore()
	const [search, setSearch] = useState('')
	const matches = RWA_PLATFORM_CHART_METRICS.filter((metric) =>
		metric.label.toLowerCase().includes(search.trim().toLowerCase())
	)
	return (
		<Ariakit.DialogProvider store={store}>
			<Ariakit.DialogDisclosure className={buttonStyles({ size: 'md' })}>
				<span>Add Metrics</span>
				<Icon name="plus" className="size-3.5" />
			</Ariakit.DialogDisclosure>
			<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:600px]`} unmountOnHide portal>
				<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<div className="flex items-baseline gap-2.5">
						<DialogHeading>Chart metrics</DialogHeading>
						<span className="body-sm text-tertiary">
							{selected.length}/{RWA_PLATFORM_CHART_METRICS.length}
						</span>
					</div>
					<DialogCloseButton className="-mr-1" />
				</div>
				<div className="border-b border-subtle px-4 py-3">
					<label className="relative block">
						<span className="sr-only">Search metrics</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<Input
							type="text"
							name="search"
							inputMode="search"
							placeholder={`Search ${RWA_PLATFORM_CHART_METRICS.length} metrics...`}
							autoFocus
							value={search}
							className="w-full pl-8"
							onChange={(event) => setSearch(event.currentTarget.value)}
						/>
					</label>
				</div>
				<div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
					{GROUP_ORDER.map((group) => {
						const options = matches.filter((metric) => metric.group === group)
						if (options.length === 0) return null
						return (
							<section key={group} className="flex flex-col gap-2">
								<div className="flex items-baseline gap-1.5">
									<span className="label-xs tracking-wide text-tertiary uppercase">{group}</span>
									<span className="body-xs text-tertiary/70">
										&middot; {options.filter((metric) => selected.includes(metric.key)).length}/{options.length}
									</span>
								</div>
								<div className="flex flex-wrap gap-1">
									{options.map((metric) => {
										const active = selected.includes(metric.key)
										return (
											<button
												key={metric.key}
												type="button"
												title={metric.description}
												onClick={() => onToggle(metric.key)}
												data-active={active}
												className={metricOptionChipStyles}
											>
												{active ? (
													<span aria-hidden className="size-1.5 rounded-full bg-brand" />
												) : (
													<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" />
												)}
												<span>{metric.label}</span>
												{active ? <Icon name="x" className="size-3 text-secondary group-hover:text-primary" /> : null}
											</button>
										)
									})}
								</div>
							</section>
						)
					})}
				</div>
				<div className="flex items-center justify-between gap-2 border-t border-subtle bg-overlay px-4 py-3">
					<Button type="button" variant="ghost" size="md" onClick={onClear}>
						Reset
					</Button>
					<Button type="button" variant="primary" size="md" onClick={() => store.hide()}>
						Done
					</Button>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
