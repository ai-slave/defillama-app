import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo } from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { type ChartMetricOption, ChartMetricsDialog } from '~/components/ChartMetricsDialog'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { prepareChartCsv } from '~/components/ECharts/shared/csv'
import { CumulativeUnavailableNotice } from '~/components/ECharts/shared/CumulativeUnavailableNotice'
import { EmbedChart } from '~/components/EmbedChart'
import { OTHERS_COLOR } from '~/constants/colors'
import { serializeProtocolChartToMultiChart } from '~/containers/ProDashboard/utils/chartSerializer'
import { useDarkModeManager, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useIsClient } from '~/hooks/useIsClient'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { metricChipStyles } from '~/ui/MetricChip'
import { FailedDataNote } from '~/ui/ScopeNote'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { pushShallowQuery, readyAsPath } from '~/utils/routerQuery'
import { getProtocolSeriesName } from './chartPresentation'
import { readAsPathQuery, resolveProtocolChartQuery } from './chartQuery'
import {
	protocolChartCategories,
	protocolChartCategoryOrder,
	protocolCharts,
	type ProtocolChartCategory,
	type ProtocolChartsLabels
} from './constants'
import type { IProtocolOverviewPageData } from './types'
import { useFetchProtocolChartData } from './useFetchProtocolChartData'

const getQueryValueOnRemove = (isDefaultEnabled: boolean) => (isDefaultEnabled ? 'false' : undefined)

// A removed chip hands focus to the next chip, else the previous one, which for the first chip is Add Metrics.
const focusNeighbourChipOnLeave = passFocusOnLeave((chip) => {
	const next = neighbourRowControl(chip, chip)
	return next?.querySelector<HTMLElement>('input') ?? next
})

const ProtocolChart = lazy(() => import('./Chart'))

type ProtocolMetricOption = ChartMetricOption &
	({ key: ProtocolChartsLabels; type: 'chart' } | { key: 'events'; type: 'events' })

const PROTOCOL_CATEGORY_BY_METRIC = new Map<ProtocolChartsLabels, ProtocolChartCategory>()
for (const category of protocolChartCategoryOrder) {
	for (const metric of protocolChartCategories[category]) {
		PROTOCOL_CATEGORY_BY_METRIC.set(metric, category)
	}
}

const getProtocolMetricLabel = (chart: ProtocolChartsLabels, tokenSymbol?: string | null) =>
	chart.replace('Token', tokenSymbol ? `$${tokenSymbol}` : 'Token')

export function ProtocolChartPanel(props: IProtocolOverviewPageData) {
	const router = useRouter()
	const path = readyAsPath(router)
	const getQueryValue = useMemo(() => readAsPathQuery(path), [path])
	const [isThemeDark] = useDarkModeManager()
	const { chartInstance: overviewChartInstance, handleChartReady: handleOverviewChartReady } = useGetChartInstance()
	const overviewImageFilename = slug(props.name)
	const overviewImageTitle = props.name
	const { toggledMetrics, hasAtLeastOneBarChart, toggledCharts, groupBy, defaultEnabledCharts, hasEvents } = useMemo(
		() =>
			resolveProtocolChartQuery({
				getQueryValue,
				availableCharts: props.availableCharts,
				defaultToggledCharts: props.defaultToggledCharts,
				chartDenominations: props.chartDenominations,
				hallmarks: props.hallmarks,
				rangeHallmarks: props.rangeHallmarks,
				defaultChartView: props.defaultChartView
			}),
		[
			getQueryValue,
			props.availableCharts,
			props.defaultToggledCharts,
			props.chartDenominations,
			props.hallmarks,
			props.rangeHallmarks,
			props.defaultChartView
		]
	)

	const [tvlSettings] = useLocalStorageSettingsManager('tvl')

	const { finalCharts, valueSymbol, loadingCharts, failedMetrics } = useFetchProtocolChartData({
		...props,
		toggledMetrics,
		groupBy,
		tvlSettings
	})
	const chartRenderModel = useMemo(
		() => ({
			chartData: finalCharts,
			valueSymbol,
			gasUsedValueSymbol: valueSymbol,
			// Deferred together with the rows, so labels never pair old rows with a new grouping.
			groupBy
		}),
		[finalCharts, valueSymbol, groupBy]
	)
	const deferredChartRenderModel = useDeferredValue(chartRenderModel)
	const loadingChartSet = useMemo(() => new Set(loadingCharts), [loadingCharts])

	const prepareCsv = () => {
		const csvCharts: Record<string, Array<[number, number | null]>> = {}
		for (const [label, data] of Object.entries(finalCharts)) csvCharts[getProtocolSeriesName(label, groupBy)] = data
		return prepareChartCsv(csvCharts, `${props.name}.csv`, groupBy)
	}
	// The toggle stays on, so switching back from cumulative restores the series.
	const isActiveAddressesHidden = groupBy === 'cumulative' && toggledCharts.includes('Active Addresses')
	const showDaily = () => void pushShallowQuery(router, { groupBy: 'daily' })

	const { multiChart, unsupportedMetrics } = useMemo(() => {
		return serializeProtocolChartToMultiChart({
			protocolId: slug(props.name),
			protocolName: props.name,
			geckoId: props.geckoId,
			toggledMetrics: toggledCharts,
			chartColors: props.chartColors,
			groupBy
		})
	}, [props.name, props.geckoId, toggledCharts, props.chartColors, groupBy])

	const isClient = useIsClient()
	const shouldShowEnabledEventsChip = toggledMetrics.events === 'true'

	const metricGroups = useMemo(() => {
		const byCategory = new Map<ProtocolChartCategory | 'Other' | 'Annotations', Array<ProtocolMetricOption>>()
		for (const category of protocolChartCategoryOrder) byCategory.set(category, [])
		byCategory.set('Other', [])
		for (const chart of props.availableCharts) {
			byCategory.get(PROTOCOL_CATEGORY_BY_METRIC.get(chart) ?? 'Other')!.push({
				key: chart,
				label: getProtocolMetricLabel(chart, props.token?.symbol),
				color: props.chartColors[chart] ?? OTHERS_COLOR,
				active: toggledMetrics[protocolCharts[chart]] === 'true',
				type: 'chart'
			})
		}
		if (hasEvents) {
			byCategory.set('Annotations', [
				{
					key: 'events',
					label: 'Events',
					// Matches the rail's default grey marker; a series colour would point at a line the toggle doesn't draw.
					color: OTHERS_COLOR,
					active: toggledMetrics.events === 'true',
					type: 'events'
				}
			])
		}
		return Array.from(byCategory, ([label, options]) => ({ label, options }))
	}, [props.availableCharts, props.token?.symbol, props.chartColors, toggledMetrics, hasEvents])

	const handleToggleMetric = useCallback(
		(option: ProtocolMetricOption) => {
			if (option.type === 'events') {
				void pushShallowQuery(router, {
					events: toggledMetrics.events === 'true' ? getQueryValueOnRemove(true) : 'true'
				})
				return
			}
			void pushShallowQuery(router, {
				[protocolCharts[option.key]]:
					toggledMetrics[protocolCharts[option.key]] === 'true'
						? getQueryValueOnRemove(defaultEnabledCharts[option.key] === true)
						: 'true'
			})
		},
		[router, toggledMetrics, defaultEnabledCharts]
	)

	const handleClearAll = useCallback(() => {
		const updates: Record<string, string | undefined> = {}
		for (const chart of props.availableCharts) {
			if (toggledMetrics[protocolCharts[chart]] === 'true') {
				updates[protocolCharts[chart]] = getQueryValueOnRemove(defaultEnabledCharts[chart] === true)
			}
		}
		if (hasEvents && toggledMetrics.events === 'true') {
			updates.events = getQueryValueOnRemove(true)
		}
		// Clear all is disabled while nothing is picked, so updates is never empty here.
		void pushShallowQuery(router, updates)
	}, [router, props.availableCharts, toggledMetrics, defaultEnabledCharts, hasEvents])

	return (
		<ChartPanel className="flex-1">
			<ChartPanelToolbar
				leading={
					<>
						{props.availableCharts.length > 0 ? (
							<ChartMetricsDialog
								groups={metricGroups}
								onToggle={handleToggleMetric}
								clear={{ kind: 'clear', onClear: handleClearAll }}
							/>
						) : null}
						{toggledCharts.map((tchart) => (
							<label
								className="relative flex cursor-pointer flex-nowrap items-center gap-1"
								key={`add-or-remove-metric-${tchart}`}
								ref={focusNeighbourChipOnLeave}
							>
								<input
									type="checkbox"
									value={tchart}
									checked
									onChange={() => {
										void pushShallowQuery(router, {
											[protocolCharts[tchart]]: getQueryValueOnRemove(defaultEnabledCharts[tchart] === true)
										})
									}}
									className="peer absolute size-[1em] opacity-[0.00001]"
								/>
								<span
									className={metricChipStyles}
									style={{
										borderColor: props.chartColors[tchart]
									}}
								>
									<span>{tchart.replace('Token', props.token?.symbol ? `$${props.token.symbol}` : 'Token')}</span>
									{loadingChartSet.has(tchart) ? (
										<span aria-label={`${tchart} is loading`} role="status">
											<LoadingSpinner size={14} />
										</span>
									) : (
										<Icon name="x" className="size-3.5" />
									)}
								</span>
							</label>
						))}
						{shouldShowEnabledEventsChip ? (
							<label
								className="relative flex cursor-pointer flex-nowrap items-center gap-1"
								ref={focusNeighbourChipOnLeave}
							>
								<input
									type="checkbox"
									value="events"
									checked
									onChange={() => {
										void pushShallowQuery(router, {
											events: getQueryValueOnRemove(true)
										})
									}}
									className="peer absolute size-[1em] opacity-[0.00001]"
								/>
								<span
									className={metricChipStyles}
									style={{
										borderColor: OTHERS_COLOR
									}}
								>
									<span>Events</span>
									<Icon name="x" className="size-3.5" />
								</span>
							</label>
						) : null}
					</>
				}
			>
				{props.chartDenominations?.length ? (
					<SegmentedControl
						value={toggledMetrics.denomination ?? 'USD'}
						onValueChange={(symbol) =>
							void pushShallowQuery(router, { denomination: symbol === 'USD' ? undefined : symbol })
						}
						options={props.chartDenominations.map((denom) => ({ value: denom.symbol, label: denom.symbol }))}
						label="Denomination"
						variant="default"
						size="md"
					/>
				) : null}
				{hasAtLeastOneBarChart ? (
					<ChartGroupingSelector
						value={groupBy}
						onValueChange={(dataInterval) => {
							void pushShallowQuery(router, {
								groupBy: dataInterval
							})
						}}
						options={DWMC_GROUPING_OPTIONS_LOWERCASE}
					/>
				) : null}
				<EmbedChart />
				<AddToDashboardButton chartConfig={multiChart} unsupportedMetrics={unsupportedMetrics} smol />
				<ChartExportButtons
					chartInstance={overviewChartInstance}
					csvSource={{ type: 'prepare-csv', prepare: prepareCsv }}
					filename={overviewImageFilename}
					title={overviewImageTitle}
					iconUrl={tokenIconUrl(props.name)}
				/>
			</ChartPanelToolbar>
			{isClient ? (
				<FailedDataNote
					labels={failedMetrics.map((metric) =>
						metric.replace('Token', props.token?.symbol ? `$${props.token.symbol}` : 'Token')
					)}
					shows="The chart shows the other metrics."
				/>
			) : null}
			<ChartPanelBody>
				{isActiveAddressesHidden ? (
					<CumulativeUnavailableNotice
						metric="Active Addresses"
						fill={toggledCharts.length === 1}
						onShowDaily={showDaily}
					/>
				) : null}
				{isActiveAddressesHidden && toggledCharts.length === 1 ? null : (
					<Suspense
						fallback={
							<ChartPanelBodyFallback role="status" aria-live="polite">
								<LoadingIndicator />
							</ChartPanelBodyFallback>
						}
					>
						<ProtocolChart
							chartData={deferredChartRenderModel.chartData}
							chartColors={props.chartColors}
							isThemeDark={isThemeDark}
							valueSymbol={deferredChartRenderModel.valueSymbol}
							gasUsedValueSymbol={deferredChartRenderModel.gasUsedValueSymbol}
							groupBy={deferredChartRenderModel.groupBy}
							hallmarks={toggledMetrics.events === 'true' ? props.hallmarks : null}
							rangeHallmarks={toggledMetrics.events === 'true' ? props.rangeHallmarks : null}
							unlockTokenSymbol={props.token?.symbol}
							onReady={handleOverviewChartReady}
						/>
					</Suspense>
				)}
			</ChartPanelBody>
		</ChartPanel>
	)
}
