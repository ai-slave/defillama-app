import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo } from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { type ChartMetricOption, ChartMetricsDialog } from '~/components/ChartMetricsDialog'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { prepareChartCsv } from '~/components/ECharts/shared/csv'
import { CumulativeUnavailableNotice } from '~/components/ECharts/shared/CumulativeUnavailableNotice'
import { EmbedChart } from '~/components/EmbedChart'
import { serializeChainChartToMultiChart } from '~/containers/ProDashboard/utils/chartSerializer'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useIsClient } from '~/hooks/useIsClient'
import {
	ChartPanel,
	ChartPanelBody,
	ChartPanelBodyFallback,
	ChartPanelBodyLoading,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { metricChipStyles } from '~/ui/MetricChip'
import { FailedDataNote } from '~/ui/ScopeNote'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { pushShallowQuery } from '~/utils/routerQuery'
import { getChainSeriesName } from './chartPresentation'
import { type ChainChartLabels, chainCharts, getChainChartColors } from './constants'
import type { ChainOverviewChartData, IChainOverviewData } from './types'

const ChainCoreChart = lazy(() => import('~/containers/ChainOverview/Chart'))

type ChainMetricOption = ChartMetricOption & { key: ChainChartLabels }

const getChainMetricLabel = (chart: ChainChartLabels, tokenSymbol?: string | null) =>
	chart.includes('Token') ? chart.replace('Token', tokenSymbol ? `$${tokenSymbol}` : 'Token') : chart

const chainChartCategories = {
	Core: ['TVL', 'Stablecoins Mcap', 'Bridged TVL', 'Net Inflows'],
	Revenue: ['Chain Fees', 'Chain Revenue', 'Holders Revenue', 'App Fees', 'App Revenue'],
	Volume: ['DEXs Volume', 'Perps Volume'],
	Token: ['Token Price', 'Token Mcap', 'Token Volume', 'Token Incentives'],
	Activity: ['Active Addresses', 'New Addresses', 'Transactions'],
	Fundraising: ['Raises'],
	Development: ['Core Developers', 'Devs Commits']
} as const satisfies Record<string, ReadonlyArray<ChainChartLabels>>

type ChainChartCategory = keyof typeof chainChartCategories

const chainChartCategoryOrder: Array<ChainChartCategory> = [
	'Core',
	'Revenue',
	'Volume',
	'Token',
	'Activity',
	'Fundraising',
	'Development'
]

const CHAIN_CATEGORY_BY_METRIC = new Map<ChainChartLabels, ChainChartCategory>()
for (const category of chainChartCategoryOrder) {
	for (const metric of chainChartCategories[category]) {
		CHAIN_CATEGORY_BY_METRIC.set(metric, category)
	}
}

const getQueryValueOnRemove = (isDefaultEnabled: boolean): 'false' | undefined =>
	isDefaultEnabled ? 'false' : undefined

// A removed chip hands focus to the next chip, else the previous one, which for the first chip is Add Metrics.
const focusNeighbourChipOnLeave = passFocusOnLeave((chip) => {
	const next = neighbourRowControl(chip, chip)
	return next?.querySelector<HTMLElement>('input') ?? next
})

interface ChainChartPanelProps {
	charts: IChainOverviewData['charts']
	chainTokenInfo: IChainOverviewData['chainTokenInfo']
	metadata: IChainOverviewData['metadata']
	chain: string
	toggledCharts: Array<ChainChartLabels>
	denominations: Array<string>
	denomination: string
	hasBarChart: boolean
	groupBy: ChartTimeGroupingWithCumulative
	chainGeckoId: string | null
	finalCharts: ChainOverviewChartData
	valueSymbol: string
	/** Labels of the metrics still loading; their chips show a spinner and the chart waits for all of them. */
	loadingCharts: Array<string>
	failedMetrics: Array<ChainChartLabels>
	/** A TVL setting is on but its series failed to load, so TVL shows the default. */
	tvlSettingsFailed: boolean
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
	loadingCharts,
	failedMetrics,
	tvlSettingsFailed,
	darkMode
}: ChainChartPanelProps) {
	const router = useRouter()
	const isClient = useIsClient()
	const chartColors = useMemo(() => getChainChartColors(toggledCharts), [toggledCharts])
	const chartRenderModel = useMemo(
		() => ({
			chartData: finalCharts,
			chartColors,
			valueSymbol,
			// Deferred together with the rows, so labels never pair old rows with a new grouping.
			groupBy
		}),
		[finalCharts, chartColors, valueSymbol, groupBy]
	)
	const deferredChartRenderModel = useDeferredValue(chartRenderModel)

	const { multiChart, unsupportedMetrics } = useMemo(() => {
		if (!metadata?.name) {
			const emptyUnsupportedMetrics: Array<ChainChartLabels> = []
			return { multiChart: null, unsupportedMetrics: emptyUnsupportedMetrics }
		}

		return serializeChainChartToMultiChart({
			chainName: metadata.name,
			geckoId: chainGeckoId,
			toggledMetrics: toggledCharts,
			chartColors,
			groupBy
		})
	}, [metadata.name, chainGeckoId, toggledCharts, chartColors, groupBy])

	const canAddToDashboard = metadata.name !== 'All' && multiChart && toggledCharts.length > 0 && denomination === 'USD'

	const prepareCsv = () => {
		const csvCharts: Record<string, Array<[number, number | null]>> = {}
		for (const [label, data] of Object.entries(chartRenderModel.chartData))
			csvCharts[getChainSeriesName(label, groupBy)] = data
		return prepareChartCsv(csvCharts, `${chain}.csv`, groupBy)
	}
	// The toggle stays on, so switching back from cumulative restores the series.
	const isActiveAddressesHidden = groupBy === 'cumulative' && toggledCharts.includes('Active Addresses')
	// Cumulative hides Active Addresses, so a chart picked down to it alone draws nothing to export or embed.
	const plotsSeries = toggledCharts.length > (isActiveAddressesHidden ? 1 : 0)

	const { chartInstance: chainChartInstance, handleChartReady } = useGetChartInstance()
	const imageExportFilename = slug(metadata.name)
	const imageExportTitle = metadata.name === 'All' ? 'All Chains' : metadata.name

	const updateGroupBy = (newGroupBy: LowercaseDwmcGrouping) => {
		void pushShallowQuery(router, { groupBy: newGroupBy })
	}

	const metricGroups = useMemo(() => {
		const byCategory = new Map<ChainChartCategory | 'Other', Array<ChainMetricOption>>()
		for (const category of chainChartCategoryOrder) byCategory.set(category, [])
		byCategory.set('Other', [])
		for (const chart of charts) {
			byCategory.get(CHAIN_CATEGORY_BY_METRIC.get(chart) ?? 'Other')!.push({
				key: chart,
				label: getChainMetricLabel(chart, chainTokenInfo?.token_symbol),
				color: chartColors[chart],
				active: toggledCharts.includes(chart)
			})
		}
		return Array.from(byCategory, ([label, options]) => ({ label, options }))
	}, [charts, chainTokenInfo?.token_symbol, toggledCharts, chartColors])

	const handleToggleMetric = useCallback(
		(option: ChainMetricOption) => {
			void pushShallowQuery(router, {
				[chainCharts[option.key]]: option.active ? getQueryValueOnRemove(charts[0] === option.key) : 'true'
			})
		},
		[router, charts]
	)

	const handleClearAll = useCallback(() => {
		const updates: Record<string, string | undefined> = {}
		for (const chart of toggledCharts) {
			updates[chainCharts[chart]] = getQueryValueOnRemove(charts[0] === chart)
		}
		// Clear all is disabled while nothing is picked, so updates is never empty here.
		void pushShallowQuery(router, updates)
	}, [router, charts, toggledCharts])

	const selectedChartLabel = (chart: ChainChartLabels) => getChainMetricLabel(chart, chainTokenInfo?.token_symbol)
	// The data request and the lazy chart chunk wait behind the same indicator.
	const chartLoading = <ChartPanelBodyLoading />

	return (
		<ChartPanel className="col-span-2">
			<ChartPanelToolbar
				leading={
					<>
						{charts.length > 0 ? (
							<ChartMetricsDialog
								groups={metricGroups}
								onToggle={handleToggleMetric}
								clear={{ kind: 'clear', onClear: handleClearAll }}
							/>
						) : null}
						{toggledCharts.map((tchart) => (
							<label
								className="relative flex cursor-pointer flex-nowrap items-center gap-1"
								key={`add-or-remove-metric-${chainCharts[tchart]}`}
								ref={focusNeighbourChipOnLeave}
							>
								<input
									type="checkbox"
									value={tchart}
									checked
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
										borderColor: chartColors[tchart]
									}}
								>
									<span>{selectedChartLabel(tchart)}</span>
									{loadingCharts.includes(tchart) ? (
										<span aria-label={`${tchart} is loading`} role="status">
											<LoadingSpinner size={14} />
										</span>
									) : (
										<Icon name="x" className="size-3.5" />
									)}
								</span>
							</label>
						))}
					</>
				}
			>
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
				{plotsSeries ? <EmbedChart /> : null}
				{canAddToDashboard ? (
					<AddToDashboardButton chartConfig={multiChart} unsupportedMetrics={unsupportedMetrics} smol />
				) : null}
				{plotsSeries ? (
					<ChartExportButtons
						chartInstance={chainChartInstance}
						csvSource={{ type: 'prepare-csv', prepare: prepareCsv }}
						filename={imageExportFilename}
						title={imageExportTitle}
						iconUrl={metadata.name !== 'All' ? chainIconUrl(metadata.name) : undefined}
					/>
				) : null}
			</ChartPanelToolbar>
			{isClient && loadingCharts.length === 0 ? (
				<FailedDataNote labels={failedMetrics.map(selectedChartLabel)} shows="The chart shows the other metrics." />
			) : null}
			{tvlSettingsFailed ? <FailedDataNote labels={['your TVL settings']} shows="TVL leaves them out." /> : null}

			<ChartPanelBody>
				{loadingCharts.length > 0 ? (
					chartLoading
				) : toggledCharts.length === 0 ? (
					<ChartPanelBodyFallback role="status" className="body-sm text-tertiary">
						{charts.length > 0 ? 'Pick metrics to plot' : 'No chart data for this chain'}
					</ChartPanelBodyFallback>
				) : isActiveAddressesHidden && toggledCharts.length === 1 ? (
					<CumulativeUnavailableNotice metric="Active Addresses" fill onShowDaily={() => updateGroupBy('daily')} />
				) : (
					<Suspense fallback={chartLoading}>
						{isActiveAddressesHidden ? (
							<CumulativeUnavailableNotice
								metric="Active Addresses"
								fill={false}
								onShowDaily={() => updateGroupBy('daily')}
							/>
						) : null}
						<ChainCoreChart
							chartData={deferredChartRenderModel.chartData}
							chartColors={deferredChartRenderModel.chartColors}
							valueSymbol={deferredChartRenderModel.valueSymbol}
							isThemeDark={darkMode}
							groupBy={deferredChartRenderModel.groupBy}
							onReady={handleChartReady}
						/>
					</Suspense>
				)}
			</ChartPanelBody>
		</ChartPanel>
	)
}
