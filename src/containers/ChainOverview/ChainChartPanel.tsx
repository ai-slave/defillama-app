import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard'
import { ChartPngExportButton } from '~/components/ButtonStyled/ChartPngExportButton'
import { CSVDownloadButton } from '~/components/ButtonStyled/CsvButton'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/types'
import { prepareChartCsv } from '~/components/ECharts/utils'
import { EmbedChart } from '~/components/EmbedChart'
import { Icon } from '~/components/Icon'
import { LoadingDots } from '~/components/Loaders'
import { serializeChainChartToMultiChart } from '~/containers/ProDashboard/utils/chartSerializer'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useIsClient } from '~/hooks/useIsClient'
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
		<div className="col-span-2 flex flex-col rounded-md border border-(--cards-border) bg-(--cards-bg)">
			<div className="flex flex-wrap items-center justify-start gap-2 p-2 pb-0">
				{charts.length > 0 ? (
					<Ariakit.DialogProvider store={metricsDialogStore}>
						<Ariakit.DialogDisclosure className="flex shrink-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-(--cards-border) bg-white px-2 py-1 font-normal hover:bg-(--link-hover-bg) focus-visible:bg-(--link-hover-bg) dark:bg-[#181A1C]">
							<span>Add Metrics</span>
							<Icon name="plus" className="size-3.5" />
						</Ariakit.DialogDisclosure>
						<Ariakit.Dialog
							className="fixed inset-(--inset) top-0 right-0 bottom-0 left-0 z-50 m-auto mb-0 flex max-h-[85dvh] min-h-[40dvh] w-full max-w-full flex-col overflow-hidden rounded-t-xl border border-[color-mix(in_oklch,black_8%,transparent)] bg-(--cards-bg) pb-[max(0px,env(safe-area-inset-bottom))] shadow-[0_24px_64px_-16px_rgb(0_0_0/0.45),0_0_0_1px_color-mix(in_oklch,black_4%,transparent)] max-sm:drawer sm:mb-auto sm:h-fit sm:max-h-[min(720px,calc(100%-32px))] sm:min-h-[initial] sm:max-w-[min(calc(100%-32px),600px)] sm:rounded-xl sm:pb-0 dark:border-[color-mix(in_oklch,white_9%,transparent)] dark:shadow-[0_24px_64px_-16px_rgb(0_0_0/0.6),0_0_0_1px_color-mix(in_oklch,white_3%,transparent)_inset]"
							unmountOnHide
						>
							<div className="flex items-center justify-between gap-3 border-b border-(--cards-border) px-4 py-3">
								<div className="flex items-baseline gap-2.5">
									<Ariakit.DialogHeading className="text-[15px] font-semibold tracking-tight text-(--text-primary)">
										Chart metrics
									</Ariakit.DialogHeading>
									<span className="text-xs text-(--text-tertiary) tabular-nums">
										{selectedOptions.length}/{allMetricOptions.length}
									</span>
								</div>
								<Ariakit.DialogDismiss className="-mr-1 rounded-md p-1.5 text-(--text-tertiary) hover:bg-(--link-hover-bg) hover:text-(--text-primary) focus-visible:bg-(--link-hover-bg)">
									<Icon name="x" className="size-4" />
									<span className="sr-only">Close</span>
								</Ariakit.DialogDismiss>
							</div>

							<div className="border-b border-(--cards-border) px-4 py-3">
								<label className="relative block">
									<span className="sr-only">Search metrics</span>
									<Icon
										name="search"
										height={16}
										width={16}
										className="pointer-events-none absolute top-0 bottom-0 left-2.5 my-auto text-(--text-tertiary)"
									/>
									<input
										type="text"
										name="search"
										inputMode="search"
										placeholder={`Search ${allMetricOptions.length} metrics...`}
										autoFocus
										value={metricsSearchValue}
										className="min-h-9 w-full rounded-md border border-(--cards-border) bg-(--bg-input) py-1.5 pr-24 pl-8 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-(--old-blue) focus:outline-none"
										onChange={(e) => setMetricsSearchValue(e.currentTarget.value)}
									/>
									{metricsSearchValue ? (
										<div className="absolute top-0 right-1.5 bottom-0 my-auto flex items-center gap-1">
											<span className="text-[11px] text-(--text-tertiary) tabular-nums">
												{filteredMetricOptions.length} {filteredMetricOptions.length === 1 ? 'match' : 'matches'}
											</span>
											<button
												type="button"
												onClick={() => setMetricsSearchValue('')}
												className="flex size-5 items-center justify-center rounded text-(--text-tertiary) hover:bg-(--link-hover-bg) hover:text-(--text-primary)"
											>
												<Icon name="x" className="size-3.5" />
												<span className="sr-only">Clear search</span>
											</button>
										</div>
									) : null}
								</label>
							</div>

							<div className="flex thin-scrollbar flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
								{groupedFilteredOptions.map((group) => (
									<section key={`chain-chart-category-${group.label}`} className="flex flex-col gap-2">
										<div className="flex items-baseline gap-1.5">
											<span className="text-[10px] font-medium tracking-[0.08em] text-(--text-tertiary) uppercase">
												{group.label}
											</span>
											<span className="text-[10px] text-(--text-tertiary)/70 tabular-nums">
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
														className="group flex items-center gap-1.5 rounded-full border border-(--cards-border) bg-transparent px-2.5 py-1 text-xs text-(--text-primary) transition-[background-color,border-color,color] duration-150 ease-out hover:border-(--old-blue) hover:bg-(--link-hover-bg) focus-visible:border-(--old-blue) focus-visible:bg-(--link-hover-bg) data-[active=true]:border-[color-mix(in_oklch,var(--old-blue)_45%,transparent)] data-[active=true]:bg-[color-mix(in_oklch,var(--old-blue)_14%,transparent)]"
													>
														{option.active ? (
															<span
																aria-hidden
																className="size-1.5 rounded-full"
																style={{ backgroundColor: dotColor! }}
															/>
														) : (
															<Icon
																name="plus"
																className="size-3 text-(--text-tertiary) group-hover:text-(--old-blue)"
															/>
														)}
														<span>{option.label}</span>
														{option.active ? (
															<Icon name="x" className="size-3 opacity-50 group-hover:opacity-100" />
														) : null}
													</button>
												)
											})}
										</div>
									</section>
								))}

								{groupedFilteredOptions.length === 0 ? (
									<div className="flex flex-col items-center gap-1 py-8 text-center">
										<p className="text-sm text-(--text-secondary)">
											No metrics match{' '}
											<span className="font-medium text-(--text-primary)">"{deferredMetricsSearchValue}"</span>
										</p>
										<button
											type="button"
											onClick={() => setMetricsSearchValue('')}
											className="text-xs text-(--text-tertiary) underline-offset-2 hover:text-(--text-primary) hover:underline"
										>
											Clear search
										</button>
									</div>
								) : null}
							</div>

							<div className="flex items-center justify-between gap-2 border-t border-(--cards-border) bg-(--cards-bg) px-4 py-3">
								{selectedOptions.length > 0 ? (
									<button
										type="button"
										onClick={handleClearAll}
										className="text-xs text-(--text-tertiary) underline-offset-2 hover:text-(--text-primary) hover:underline"
									>
										Clear all
									</button>
								) : (
									<span className="text-xs text-(--text-tertiary)">Pick metrics to plot</span>
								)}
								<button
									type="button"
									onClick={() => metricsDialogStore.hide()}
									className="rounded-md bg-(--old-blue) px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 focus-visible:brightness-110"
								>
									Done
								</button>
							</div>
						</Ariakit.Dialog>
					</Ariakit.DialogProvider>
				) : null}
				{toggledCharts.map((tchart) => (
					<label
						className="relative flex cursor-pointer flex-nowrap items-center gap-1 text-sm last-of-type:mr-auto"
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
							className="flex items-center gap-1 rounded-full border-2 border-(--old-blue) px-2 py-1 text-xs hover:bg-(--bg-input) focus-visible:bg-(--bg-input)"
							style={{
								borderColor: chainOverviewChartColors[tchart]
							}}
						>
							<span>{selectedChartLabel(tchart)}</span>
							<Icon name="x" className="size-3.5" />
						</span>
					</label>
				))}

				<div className="ml-auto flex flex-wrap justify-end gap-1">
					{denominations.length > 1 ? (
						<div className="flex w-fit flex-nowrap items-center overflow-x-auto rounded-md border border-(--form-control-border) text-(--text-form)">
							{denominations.map((denom) => (
								<button
									key={`denom-${denom}`}
									className="shrink-0 px-2 py-1 text-sm whitespace-nowrap hover:bg-(--link-hover-bg) focus-visible:bg-(--link-hover-bg) data-[active=true]:font-medium data-[active=true]:text-(--link-text)"
									data-active={denomination === denom}
									onClick={() => {
										void pushShallowQuery(router, { currency: denom })
									}}
								>
									{denom}
								</button>
							))}
						</div>
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
					<CSVDownloadButton prepareCsv={prepareCsv} smol />
					<ChartPngExportButton
						chartInstance={chainChartInstance}
						filename={imageExportFilename}
						title={imageExportTitle}
						iconUrl={metadata.name !== 'All' ? chainIconUrl(metadata.name) : undefined}
					/>
				</div>
			</div>

			<div className="relative flex min-h-[360px] flex-col">
				{isFetchingChartData ? (
					<div className="m-auto flex min-h-[360px] items-center justify-center">
						<p className="flex items-center gap-1">
							Loading
							<LoadingDots />
						</p>
					</div>
				) : (
					<Suspense fallback={<div className="m-auto flex min-h-[360px] items-center justify-center" />}>
						<ChainCoreChart
							chartData={deferredChartRenderModel.chartData}
							valueSymbol={deferredChartRenderModel.valueSymbol}
							isThemeDark={darkMode}
							groupBy={groupBy}
							onReady={handleChartReady}
						/>
					</Suspense>
				)}
				{isClient && !isFetchingChartData && failedMetrics.length > 0 ? (
					<Ariakit.PopoverProvider>
						<Ariakit.PopoverDisclosure className="absolute right-2 bottom-2 z-10 flex items-center justify-center rounded-full border border-(--cards-border) bg-(--bg-main) p-1.5 text-(--error) hover:bg-(--link-hover-bg) focus-visible:bg-(--link-hover-bg)">
							<Icon name="alert-triangle" className="size-3.5" />
							<span className="sr-only">Show failed metric APIs</span>
						</Ariakit.PopoverDisclosure>
						<Ariakit.Popover
							unmountOnHide
							hideOnInteractOutside
							gutter={6}
							className="z-10 mr-1 flex max-h-[calc(100dvh-80px)] w-[min(calc(100vw-16px),300px)] flex-col gap-1 overflow-auto overscroll-contain rounded-md border border-[hsl(204,20%,88%)] bg-(--bg-main) p-2 text-xs dark:border-[hsl(204,3%,32%)]"
						>
							<p className="font-medium text-(--error)">Failed to load data for:</p>
							<ul className="pl-4">
								{failedMetrics.map((metric) => (
									<li key={metric} className="list-disc">
										{selectedChartLabel(metric)}
									</li>
								))}
							</ul>
						</Ariakit.Popover>
					</Ariakit.PopoverProvider>
				) : null}
			</div>
		</div>
	)
}
