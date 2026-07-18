import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/types'
import { prepareChartCsv } from '~/components/ECharts/utils'
import { EmbedChart } from '~/components/EmbedChart'
import { serializeChainChartToMultiChart } from '~/containers/ProDashboard/utils/chartSerializer'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useIsClient } from '~/hooks/useIsClient'
import { Button, buttonStyles } from '~/ui/Button'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { FailedDataPopover } from '~/ui/FailedDataPopover'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import { metricChipStyles, metricOptionChipStyles } from '~/ui/MetricChip'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { pushShallowQuery } from '~/utils/routerQuery'
import { type ChainChartLabels, chainCharts, chainOverviewChartColors } from './constants'
import type { IChainOverviewData } from './types'

const ChainCoreChart: any = lazy(() => import('~/containers/ChainOverview/Chart'))

type ChainMetricOption = {
	id: ChainChartLabels
	label: string
	active: boolean
}

const getChainMetricLabel = (chart: ChainChartLabels, tokenSymbol?: string | null) =>
	chart.includes('Token') ? chart.replace('Token', tokenSymbol ? `$${tokenSymbol}` : 'Token') : chart

const chainChartCategories = {
	Core: ['TVL', 'Stablecoins Mcap', 'Bridged TVL', 'Net Inflows'],
	Revenue: ['Chain Fees', 'Chain Revenue', 'App Fees', 'App Revenue'],
	Volume: ['DEXs Volume', 'Perps Volume'],
	Token: ['Token Price', 'Token Mcap', 'Token Volume', 'Token Incentives'],
	Activity: ['Active Addresses', 'New Addresses', 'Transactions'],
	Fundraising: ['Raises'],
	Development: ['Core Developers', 'Devs Commits']
} as const satisfies Record<string, readonly ChainChartLabels[]>

type ChainChartCategory = keyof typeof chainChartCategories

const chainChartCategoryOrder: ChainChartCategory[] = [
	'Core',
	'Revenue',
	'Volume',
	'Token',
	'Activity',
	'Fundraising',
	'Development'
]

const getQueryValueOnRemove = (isDefaultEnabled: boolean): 'false' | undefined =>
	isDefaultEnabled ? 'false' : undefined

interface ChainChartPanelProps {
	charts: IChainOverviewData['charts']
	chainTokenInfo: IChainOverviewData['chainTokenInfo']
	metadata: IChainOverviewData['metadata']
	chain: string
	toggledCharts: ChainChartLabels[]
	denominations: string[]
	denomination: string
	hasBarChart: boolean
	groupBy: ChartTimeGroupingWithCumulative
	chainGeckoId: string | null
	finalCharts: any
	valueSymbol: string
	isFetchingChartData: boolean
	failedMetrics: ChainChartLabels[]
	darkMode: boolean
}

export function ChainChartPanel({
	charts,
	chainTokenInfo,
	metadata,
	chain,
	toggledCharts,
	denominations,
	denomination,
	hasBarChart,
	groupBy,
	chainGeckoId,
	finalCharts,
	valueSymbol,
	isFetchingChartData,
	failedMetrics,
	darkMode
}: ChainChartPanelProps) {
	const router = useRouter()
	const isClient = useIsClient()
	const chartRenderModel = useMemo(
		() => ({
			chartData: finalCharts,
			valueSymbol
		}),
		[finalCharts, valueSymbol]
	)
	const deferredChartRenderModel = useDeferredValue(chartRenderModel)

	const { multiChart, unsupportedMetrics } = useMemo(() => {
		if (!metadata?.name) {
			return { multiChart: null, unsupportedMetrics: [] as ChainChartLabels[] }
		}

		return serializeChainChartToMultiChart({
			chainName: metadata.name,
			geckoId: chainGeckoId,
			toggledMetrics: toggledCharts,
			chartColors: chainOverviewChartColors,
			groupBy
		})
	}, [metadata.name, chainGeckoId, toggledCharts, groupBy])

	const canAddToDashboard = metadata.name !== 'All' && multiChart && toggledCharts.length > 0 && denomination === 'USD'

	const metricsDialogStore = Ariakit.useDialogStore()
	const [metricsSearchValue, setMetricsSearchValue] = useState('')
	const deferredMetricsSearchValue = useDeferredValue(metricsSearchValue)
	const prepareCsv = () => prepareChartCsv(chartRenderModel.chartData, `${chain}.csv`)

	const { chartInstance: chainChartInstance, handleChartReady } = useChartImageExport()
	const imageExportFilename = slug(metadata.name)
	const imageExportTitle = metadata.name === 'All' ? 'All Chains' : metadata.name

	const updateGroupBy = (newGroupBy: LowercaseDwmcGrouping) => {
		void pushShallowQuery(router, { groupBy: newGroupBy })
	}

	const allMetricOptions = useMemo<ChainMetricOption[]>(() => {
		return charts.map((chart) => ({
			id: chart,
			label: getChainMetricLabel(chart, chainTokenInfo?.token_symbol),
			active: toggledCharts.includes(chart)
		}))
	}, [charts, chainTokenInfo?.token_symbol, toggledCharts])

	const filteredMetricOptions = useMemo(() => {
		if (!deferredMetricsSearchValue) return allMetricOptions
		return matchSorter(allMetricOptions, deferredMetricsSearchValue, {
			keys: ['label', 'id'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [allMetricOptions, deferredMetricsSearchValue])

	const selectedOptions = useMemo(() => allMetricOptions.filter((option) => option.active), [allMetricOptions])

	const categoryByMetric = useMemo(() => {
		const map = new Map<ChainChartLabels, ChainChartCategory>()
		for (const category of chainChartCategoryOrder) {
			for (const metric of chainChartCategories[category]) {
				map.set(metric, category)
			}
		}
		return map
	}, [])

	const groupedFilteredOptions = useMemo(() => {
		const groups = new Map<ChainChartCategory | 'Other', ChainMetricOption[]>()
		const order: Array<ChainChartCategory | 'Other'> = [...chainChartCategoryOrder, 'Other']
		for (const key of order) groups.set(key, [])

		for (const option of filteredMetricOptions) {
			const category = categoryByMetric.get(option.id) ?? 'Other'
			groups.get(category)!.push(option)
		}

		return order
			.map((label) => {
				const options = groups.get(label) ?? []
				return {
					label,
					options,
					selectedCount: options.reduce((acc, option) => acc + (option.active ? 1 : 0), 0)
				}
			})
			.filter((group) => group.options.length > 0)
	}, [filteredMetricOptions, categoryByMetric])

	const getOptionColor = useCallback((option: ChainMetricOption): string => {
		return chainOverviewChartColors[option.id] ?? '#9CA3AF'
	}, [])

	const handleToggleMetric = useCallback(
		(option: ChainMetricOption) => {
			void pushShallowQuery(router, {
				[chainCharts[option.id]]: option.active ? getQueryValueOnRemove(charts[0] === option.id) : 'true'
			})
		},
		[router, charts]
	)

	const handleClearAll = useCallback(() => {
		const updates: Record<string, string | undefined> = {}
		for (const chart of toggledCharts) {
			updates[chainCharts[chart]] = getQueryValueOnRemove(charts[0] === chart)
		}
		if (Object.keys(updates).length > 0) {
			void pushShallowQuery(router, updates)
		}
	}, [router, charts, toggledCharts])

	const selectedChartLabel = (chart: ChainChartLabels) => getChainMetricLabel(chart, chainTokenInfo?.token_symbol)

	return (
		<ChartPanel className="col-span-2">
			<ChartPanelToolbar>
				{charts.length > 0 ? (
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
										placeholder={`Search ${allMetricOptions.length} metrics...`}
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
									<section key={`chain-chart-category-${group.label}`} className="flex flex-col gap-2">
										<div className="flex items-baseline gap-1.5">
											<span className="label-xs tracking-[0.08em] text-tertiary uppercase">{group.label}</span>
											<span className="body-xs text-tertiary/70">
												{group.selectedCount}/{group.options.length}
											</span>
										</div>
										<div className="flex flex-wrap gap-1">
											{group.options.map((option) => {
												const dotColor = option.active
													? `color-mix(in oklch, ${getOptionColor(option)} 75%, var(--text-secondary))`
													: null
												return (
													<button
														key={`chain-chart-option-${group.label}-${option.id}`}
														type="button"
														onClick={() => handleToggleMetric(option)}
														data-active={option.active}
														className={metricOptionChipStyles}
													>
														{option.active ? (
															<span
																aria-hidden
																className="size-1.5 rounded-full"
																style={{ backgroundColor: dotColor! }}
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
											No metrics match <span className="font-medium text-primary">"{deferredMetricsSearchValue}"</span>
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

							<div className="flex items-center justify-between gap-2 border-t border-subtle px-4 py-3">
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
						key={`add-or-remove-metric-${chainCharts[tchart]}`}
					>
						<input
							type="checkbox"
							value={tchart}
							checked={true}
							onChange={() => {
								void pushShallowQuery(router, {
									[chainCharts[tchart]]: getQueryValueOnRemove(charts[0] === tchart)
								})
							}}
							className="peer absolute size-[1em] opacity-[0.00001]"
						/>
						<span
							className={metricChipStyles}
							style={{
								borderColor: chainOverviewChartColors[tchart]
							}}
						>
							<span>{selectedChartLabel(tchart)}</span>
							<Icon name="x" className="size-3.5" />
						</span>
					</label>
				))}

				<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
					{denominations.length > 1 ? (
						<SegmentedControl
							value={denomination}
							onValueChange={(denom) => void pushShallowQuery(router, { currency: denom })}
							options={denominations.map((denom) => ({ value: denom, label: denom }))}
							label="Currency"
							variant="default"
							size="md"
						/>
					) : null}

					{hasBarChart ? (
						<ChartGroupingSelector
							value={groupBy}
							onValueChange={updateGroupBy}
							options={DWMC_GROUPING_OPTIONS_LOWERCASE}
						/>
					) : null}
					<EmbedChart />
					{canAddToDashboard ? (
						<AddToDashboardButton chartConfig={multiChart} unsupportedMetrics={unsupportedMetrics} smol />
					) : null}
					<ChartExportButtons
						chartInstance={chainChartInstance}
						prepareCsvDirect={prepareCsv}
						filename={imageExportFilename}
						title={imageExportTitle}
						iconUrl={metadata.name !== 'All' ? chainIconUrl(metadata.name) : undefined}
					/>
				</div>
			</ChartPanelToolbar>

			<ChartPanelBody>
				{isFetchingChartData ? (
					<ChartPanelBodyFallback role="status" aria-live="polite">
						<LoadingIndicator />
					</ChartPanelBodyFallback>
				) : (
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<ChainCoreChart
							chartData={deferredChartRenderModel.chartData}
							valueSymbol={deferredChartRenderModel.valueSymbol}
							isThemeDark={darkMode}
							groupBy={groupBy}
							onReady={handleChartReady}
						/>
					</Suspense>
				)}
				{isClient && !isFetchingChartData ? (
					<FailedDataPopover
						items={failedMetrics}
						ariaLabel="Show failed metric APIs"
						getLabel={(metric) => selectedChartLabel(metric)}
					/>
				) : null}
			</ChartPanelBody>
		</ChartPanel>
	)
}
