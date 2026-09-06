import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { prepareChartCsv } from '~/components/ECharts/shared/csv'
import { EmbedChart } from '~/components/EmbedChart'
import { serializeProtocolChartToMultiChart } from '~/containers/ProDashboard/utils/chartSerializer'
import { useDarkModeManager, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useIsClient } from '~/hooks/useIsClient'
import { Button, buttonStyles } from '~/ui/Button'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { FailedDataPopover } from '~/ui/FailedDataPopover'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { metricChipStyles, metricOptionChipStyles } from '~/ui/MetricChip'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { pushShallowQuery } from '~/utils/routerQuery'
import { resolveProtocolChartQuery } from './chartQuery'
import {
	protocolChartCategories,
	protocolChartCategoryOrder,
	protocolCharts,
	type ProtocolChartCategory,
	type ProtocolChartsLabels
} from './constants'
import type { IProtocolOverviewPageData } from './types'
import { useFetchProtocolChartData } from './useFetchProtocolChartData'

const getQueryValueOnRemove = (isDefaultEnabled: boolean): 'false' | null => (isDefaultEnabled ? 'false' : null)

const ProtocolChart = lazy(() => import('./Chart'))

type ProtocolMetricOption =
	| {
			id: ProtocolChartsLabels
			label: string
			active: boolean
			type: 'chart'
	  }
	| {
			id: 'events'
			label: string
			active: boolean
			type: 'events'
	  }

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
	const searchParams = useMemo(() => {
		const queryString = router.asPath.split('?')[1]?.split('#')[0] ?? ''
		return new URLSearchParams(queryString)
	}, [router.asPath])
	const [isThemeDark] = useDarkModeManager()
	const { chartInstance: overviewChartInstance, handleChartReady: handleOverviewChartReady } = useChartImageExport()
	const overviewImageFilename = slug(props.name)
	const overviewImageTitle = props.name
	const { toggledMetrics, hasAtLeastOneBarChart, toggledCharts, groupBy, defaultEnabledCharts, hasEvents } = useMemo(
		() =>
			resolveProtocolChartQuery({
				getQueryValue: (key) => {
					const values = searchParams.getAll(key)
					if (values.length === 0) return null
					if (values.length === 1) return values[0]
					return values
				},
				availableCharts: props.availableCharts,
				defaultToggledCharts: props.defaultToggledCharts,
				chartDenominations: props.chartDenominations,
				hallmarks: props.hallmarks,
				rangeHallmarks: props.rangeHallmarks,
				defaultChartView: props.defaultChartView
			}),
		[
			searchParams,
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
			gasUsedValueSymbol: valueSymbol
		}),
		[finalCharts, valueSymbol]
	)
	const deferredChartRenderModel = useDeferredValue(chartRenderModel)
	const loadingChartSet = useMemo(() => new Set(loadingCharts), [loadingCharts])

	const metricsDialogStore = Ariakit.useDialogStore()
	const [metricsSearchValue, setMetricsSearchValue] = useState('')
	const deferredMetricsSearchValue = useDeferredValue(metricsSearchValue)

	const prepareCsv = () => prepareChartCsv(finalCharts, `${props.name}.csv`)

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

	const allMetricOptions = useMemo<Array<ProtocolMetricOption>>(() => {
		const options: Array<ProtocolMetricOption> = props.availableCharts.map((chart) => ({
			id: chart,
			label: getProtocolMetricLabel(chart, props.token?.symbol),
			active: toggledMetrics[protocolCharts[chart]] === 'true',
			type: 'chart'
		}))

		if (hasEvents) {
			options.push({
				id: 'events',
				label: 'Events',
				active: toggledMetrics.events === 'true',
				type: 'events'
			})
		}

		return options
	}, [props.availableCharts, props.token?.symbol, toggledMetrics, hasEvents])

	const filteredMetricOptions = useMemo(() => {
		if (!deferredMetricsSearchValue) return allMetricOptions
		return matchSorter(allMetricOptions, deferredMetricsSearchValue, {
			keys: ['label', 'id'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [allMetricOptions, deferredMetricsSearchValue])

	const selectedOptions = useMemo(() => allMetricOptions.filter((o) => o.active), [allMetricOptions])

	const groupedFilteredOptions = useMemo(() => {
		const groups: Record<ProtocolChartCategory | 'Annotations' | 'Other', Array<ProtocolMetricOption>> = {
			Core: [],
			Token: [],
			Revenue: [],
			Volume: [],
			Liquidations: [],
			Bridge: [],
			Activity: [],
			Other: [],
			Annotations: []
		}
		const order: Array<ProtocolChartCategory | 'Annotations' | 'Other'> = [
			...protocolChartCategoryOrder,
			'Other',
			'Annotations'
		]
		for (const option of filteredMetricOptions) {
			if (option.type === 'events') {
				groups.Annotations.push(option)
				continue
			}
			const category = PROTOCOL_CATEGORY_BY_METRIC.get(option.id) ?? 'Other'
			groups[category].push(option)
		}

		return order
			.map((label) => {
				const options = groups[label]
				return {
					label,
					options,
					selectedCount: options.reduce((acc, option) => acc + (option.active ? 1 : 0), 0)
				}
			})
			.filter((group) => group.options.length > 0)
	}, [filteredMetricOptions])

	const getOptionColor = useCallback(
		(option: ProtocolMetricOption): string => {
			if (option.type === 'events') {
				return props.chartColors['Events'] ?? props.chartColors['TVL'] ?? '#9CA3AF'
			}
			return props.chartColors[option.id] ?? '#9CA3AF'
		},
		[props.chartColors]
	)

	const handleToggleMetric = useCallback(
		(option: ProtocolMetricOption) => {
			if (option.type === 'events') {
				void pushShallowQuery(router, {
					events: toggledMetrics.events === 'true' ? (getQueryValueOnRemove(true) ?? undefined) : 'true'
				})
				return
			}
			void pushShallowQuery(router, {
				[protocolCharts[option.id]]:
					toggledMetrics[protocolCharts[option.id]] === 'true'
						? (getQueryValueOnRemove(defaultEnabledCharts[option.id] === true) ?? undefined)
						: 'true'
			})
		},
		[router, toggledMetrics, defaultEnabledCharts]
	)

	const handleClearAll = useCallback(() => {
		const updates: Record<string, string | undefined> = {}
		for (const chart of props.availableCharts) {
			if (toggledMetrics[protocolCharts[chart]] === 'true') {
				updates[protocolCharts[chart]] = getQueryValueOnRemove(defaultEnabledCharts[chart] === true) ?? undefined
			}
		}
		if (hasEvents && toggledMetrics.events === 'true') {
			updates.events = getQueryValueOnRemove(true) ?? undefined
		}
		if (Object.keys(updates).length > 0) {
			void pushShallowQuery(router, updates)
		}
	}, [router, props.availableCharts, toggledMetrics, defaultEnabledCharts, hasEvents])

	return (
		<ChartPanel className="flex-1">
			<ChartPanelToolbar>
				{props.availableCharts.length > 0 ? (
					<Ariakit.DialogProvider store={metricsDialogStore}>
						<Ariakit.DialogDisclosure className={buttonStyles({ size: 'md' })}>
							<span>Add Metrics</span>
							<Icon name="plus" className="size-3.5" />
						</Ariakit.DialogDisclosure>
						<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:600px]`} unmountOnHide portal>
							<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
								<div className="flex items-baseline gap-2.5">
									<DialogHeading>Chart metrics</DialogHeading>
									<span className="body-sm text-tertiary">
										{selectedOptions.length}/{allMetricOptions.length}
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
										placeholder={`Search ${allMetricOptions.length} metrics…`}
										autoFocus
										value={metricsSearchValue}
										className="w-full pr-24 pl-8"
										onChange={(e) => setMetricsSearchValue(e.currentTarget.value)}
									/>
									{metricsSearchValue ? (
										<div className="absolute top-0 right-1.5 bottom-0 my-auto flex items-center gap-1">
											<span className="body-xs text-tertiary">
												{filteredMetricOptions.length} {filteredMetricOptions.length === 1 ? 'match' : 'matches'}
											</span>
											<button
												type="button"
												onClick={() => setMetricsSearchValue('')}
												className="flex size-5 items-center justify-center rounded-sm text-tertiary hover:bg-hover-row hover:text-primary"
											>
												<Icon name="x" className="size-3.5" />
												<span className="sr-only">Clear search</span>
											</button>
										</div>
									) : null}
								</label>
							</div>

							<div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
								{groupedFilteredOptions.map((group) => (
									<section key={`category-${group.label}`} className="flex flex-col gap-2">
										<div className="flex items-baseline gap-1.5">
											<span className="label-xs tracking-wide text-tertiary uppercase">{group.label}</span>
											<span className="body-xs text-tertiary/70">
												· {group.selectedCount}/{group.options.length}
											</span>
										</div>
										<div className="flex flex-wrap gap-1">
											{group.options.map((option) => {
												return (
													<button
														key={`option-${group.label}-${option.id}`}
														type="button"
														onClick={() => handleToggleMetric(option)}
														data-active={option.active}
														className={metricOptionChipStyles}
													>
														{option.active ? (
															<span
																aria-hidden
																className="size-1.5 rounded-full"
																style={{
																	backgroundColor: `color-mix(in oklch, ${getOptionColor(option)} 75%, var(--text-secondary))`
																}}
															/>
														) : (
															<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" />
														)}
														<span>{option.label}</span>
														{option.active ? (
															<Icon name="x" className="size-3 text-secondary group-hover:text-primary" />
														) : null}
													</button>
												)
											})}
										</div>
									</section>
								))}

								{groupedFilteredOptions.length === 0 ? (
									<div className="flex flex-col items-center gap-1 py-8 text-center">
										<p className="text-sm text-secondary">
											No metrics match{' '}
											<span className="font-medium text-primary">&ldquo;{deferredMetricsSearchValue}&rdquo;</span>
										</p>
										<button
											type="button"
											onClick={() => setMetricsSearchValue('')}
											className="text-xs text-tertiary underline-offset-2 hover:text-primary hover:underline"
										>
											Clear search
										</button>
									</div>
								) : null}
							</div>

							<div className="flex items-center justify-between gap-2 border-t border-subtle bg-overlay px-4 py-3">
								{selectedOptions.length > 0 ? (
									<Button type="button" variant="ghost" size="md" onClick={handleClearAll}>
										Clear all
									</Button>
								) : (
									<span className="text-xs text-tertiary">Pick metrics to plot</span>
								)}
								<Button type="button" variant="primary" size="md" onClick={() => metricsDialogStore.hide()}>
									Done
								</Button>
							</div>
						</Ariakit.Dialog>
					</Ariakit.DialogProvider>
				) : null}
				{toggledCharts.map((tchart) => (
					<label
						className="relative flex cursor-pointer flex-nowrap items-center gap-1 last-of-type:mr-auto"
						key={`add-or-remove-metric-${tchart}`}
					>
						<input
							type="checkbox"
							value={tchart}
							checked
							onChange={() => {
								void pushShallowQuery(router, {
									[protocolCharts[tchart]]: getQueryValueOnRemove(defaultEnabledCharts[tchart] === true) ?? undefined
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
					<label className="relative flex cursor-pointer flex-nowrap items-center gap-1 last-of-type:mr-auto">
						<input
							type="checkbox"
							value="events"
							checked
							onChange={() => {
								void pushShallowQuery(router, {
									events: toggledMetrics.events === 'true' ? (getQueryValueOnRemove(true) ?? undefined) : 'true'
								})
							}}
							className="peer absolute size-[1em] opacity-[0.00001]"
						/>
						<span
							className={metricChipStyles}
							style={{
								borderColor: props.chartColors['Events'] ?? props.chartColors['TVL'] ?? '#9CA3AF'
							}}
						>
							<span>Events</span>
							<Icon name="x" className="size-3.5" />
						</span>
					</label>
				) : null}
				<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
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
				</div>
			</ChartPanelToolbar>
			<ChartPanelBody>
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
						groupBy={groupBy}
						hallmarks={toggledMetrics.events === 'true' ? props.hallmarks : null}
						rangeHallmarks={toggledMetrics.events === 'true' ? props.rangeHallmarks : null}
						unlockTokenSymbol={props.token?.symbol}
						onReady={handleOverviewChartReady}
					/>
				</Suspense>
				{isClient ? (
					<FailedDataPopover
						items={failedMetrics}
						ariaLabel="Show failed metric APIs"
						getLabel={(metric) => metric.replace('Token', props.token?.symbol ? `$${props.token.symbol}` : 'Token')}
					/>
				) : null}
			</ChartPanelBody>
		</ChartPanel>
	)
}
