import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Menu } from '~/components/Menu'
import { useSelectionIntent } from '~/components/Select/localSelection'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { LinkPreviewCard } from '~/components/SEO'
import { TokenLogo } from '~/components/TokenLogo'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import type { StablecoinAssetChartConfig } from '~/containers/ProDashboard/types'
import {
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
	getStablecoinRuntimeSeries,
	type StablecoinChartSeriesPayload
} from '~/containers/Stablecoins/chartSeries'
import {
	getStablecoinAssetDashboardChartType,
	getStablecoinAssetSeriesChart,
	getStablecoinAssetVolumeChartKind,
	getStablecoinChartTypeOptions,
	getStablecoinChartTypeQueryValue,
	getStablecoinChartViewLabel,
	getStablecoinChartViewOptions,
	getStablecoinChartViewQueryValue,
	getStablecoinSeriesSelectorLabel,
	parseStablecoinChartState,
	parseStablecoinChartView,
	parseStablecoinVolumeGroupBy,
	type StablecoinChartType as StablecoinChartCategory
} from '~/containers/Stablecoins/chartState'
import { calcCirculating, groupBridgeData } from '~/containers/Stablecoins/hooks'
import { useStablecoinChartSeriesData, useStablecoinVolumeChartData } from '~/containers/Stablecoins/queries.client'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { Checkbox } from '~/ui/Checkbox'
import { EntityTitleRow } from '~/ui/EntityTitleRow'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { capitalizeFirstLetter, slug } from '~/utils'
import { peggedAssetIconUrl } from '~/utils/icons'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { queryReadFailed, type QueryRetry } from '~/utils/query'
import { isTruthyQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { fetchStablecoinSeriesCsvDataset, fetchStablecoinVolumeCsvDataset } from './csvDataset'
import {
	buildStablecoinMarketCapCsvDataset,
	buildStablecoinMarketCapPresentation,
	prepareStablecoinMarketCapSeries
} from './marketCapPresentation'
import { StablecoinByChainUsageTable } from './StablecoinUsageByChainTable'
import type { PeggedAssetPageProps } from './types'
import { useStablecoinChartSelection } from './useStablecoinChartSelection'
import { groupStablecoinVolumeChartPayload } from './volumeChart'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const risksHelperTexts: Record<string, string> = {
	algorithmic:
		'Algorithmic assets have their pegs maintained by mechanisms that influence supply and demand. They may be partially collateralized or over-collateralized, but usually do not have a redemption mechanism for their reserve assets. Risks of algorithmic assets include smart contract risk, price collapse due to bank run or other mechanism failure, and de-pegging.',
	'fiat-backed':
		'Fiat-backed assets are backed 1:1 by a reserve of fiat assets controlled by the issuer. Risks of fiat-backed assets include counterparty risk against the issuer, asset freezing and regulations, and risk of insufficient backing.',
	'crypto-backed':
		'Crypto-backed assets are backed by cryptoassets locked in a smart contract as collateral. Risks of crypto-backed assets include smart contract risk, collateral volatility and liquidation, and de-pegging.'
}

const ASSET_CHART_MODE = { page: 'asset' } as const
const ASSET_CHART_TYPE_OPTIONS = getStablecoinChartTypeOptions(ASSET_CHART_MODE)
const UNRELEASED_QUERY_KEY = 'unreleased'
const EMPTY_SERIES: Array<string> = []
const EMPTY_RUNTIME_SERIES = {
	selectableSeries: EMPTY_SERIES,
	defaultSeries: EMPTY_SERIES,
	renderedSelectableSeries: EMPTY_SERIES,
	fixedRemainderSeries: EMPTY_SERIES,
	alwaysVisibleSeries: EMPTY_SERIES
}

export default function PeggedContainer(props: PeggedAssetPageProps) {
	const previewTvl = formatUsd(props.mcap, {
		compact: true,
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})?.toString()

	return (
		<>
			<LinkPreviewCard
				stablePage
				cardName={props.peggedAssetData.name}
				token={props.peggedAssetData.name}
				logo={peggedAssetIconUrl(props.peggedAssetData.name)}
				{...(previewTvl === undefined ? {} : { tvl: previewTvl })}
			/>
			<PeggedAssetInfo {...props} />
		</>
	)
}

type PeggedAssetInfoProps = PeggedAssetPageProps & {
	stablecoinOptions?: ReadonlyArray<{ id: string; name: string; symbol: string }>
	onStablecoinChange?: (id: string) => void
}

const getStablecoinOptionLabel = ({ name, symbol }: { name: string; symbol: string }) =>
	symbol && symbol !== '-' && symbol !== name ? `${name} (${symbol})` : name

export function PeggedAssetInfo({
	chainsUnique: _chainsUnique,
	chainCirculatings,
	peggedAssetData,
	defaultChartData,
	totalCirculating,
	unreleased,
	mcap,
	bridgeInfo,
	blockExplorerUrl,
	blockExplorerName,
	stablecoinOptions,
	onStablecoinChange
}: PeggedAssetInfoProps) {
	const router = useRouter()
	const lifecycleStatus = peggedAssetData.deadFrom
		? `Ended on ${peggedAssetData.deadFrom}`
		: peggedAssetData.delisted
			? 'Delisted stablecoin'
			: peggedAssetData.deprecated
				? 'Deprecated stablecoin'
				: null
	let {
		name,
		onCoinGecko,
		gecko_id,
		module,
		symbol,
		description,
		mintRedeemDescription,
		url,
		pegMechanism,
		twitter,
		auditLinks,
		price
	} = peggedAssetData

	const chartState = parseStablecoinChartState(router.query, ASSET_CHART_MODE)
	const chartType = chartState.type
	const chartView = chartState.view
	const seriesSelectorLabel =
		getStablecoinSeriesSelectorLabel(ASSET_CHART_MODE, chartType, chartView) ??
		(chartType === 'marketCap' && chartView === 'pie' ? 'Chain' : null)
	const { intent: selectionIntent, setIntent: setSelectionIntent } = useSelectionIntent(
		`asset-${slug(name)}-${chartType}-${seriesSelectorLabel ?? 'none'}`
	)
	const volumeGroupBy = parseStablecoinVolumeGroupBy(router.query.groupBy)
	const chartTypeOptions = ASSET_CHART_TYPE_OPTIONS
	const chartViewOptions = React.useMemo(() => getStablecoinChartViewOptions(chartState), [chartState])
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const onChartTypeChange = React.useCallback(
		(nextChartType: StablecoinChartCategory) => {
			handleChartReady(null)
			void pushShallowQuery(router, {
				chartType: getStablecoinChartTypeQueryValue(ASSET_CHART_MODE, nextChartType),
				chartView: undefined
			})
		},
		[handleChartReady, router]
	)
	const onChartViewChange = React.useCallback(
		(nextChartView: string) => {
			const view = parseStablecoinChartView(nextChartView)
			if (!view) return
			handleChartReady(null)
			void pushShallowQuery(router, {
				chartView: getStablecoinChartViewQueryValue(ASSET_CHART_MODE, chartType, view)
			})
		},
		[chartType, handleChartReady, router]
	)
	const onVolumeGroupByChange = React.useCallback(
		(nextGroupBy: LowercaseDwmcGrouping) => {
			void pushShallowQuery(router, { groupBy: nextGroupBy === 'daily' ? undefined : nextGroupBy })
		},
		[router]
	)

	// A static page's query holds only route params until hydration, so the server and hydration renders exclude it.
	const includeUnreleased = isTruthyQueryParam(router.query[UNRELEASED_QUERY_KEY])
	const onUnreleasedToggle = React.useCallback(() => {
		const nextValue = !includeUnreleased
		const nextQuery: Record<string, string | Array<string>> = {}
		for (const key in router.query) {
			const value = router.query[key]
			if (value === undefined || key === UNRELEASED_QUERY_KEY) continue
			if (typeof value === 'string' || Array.isArray(value)) nextQuery[key] = value
		}
		if (nextValue) nextQuery[UNRELEASED_QUERY_KEY] = 'true'
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true, scroll: false })
	}, [includeUnreleased, router])

	const chainTotals = calcCirculating(chainCirculatings, includeUnreleased)

	const marketCapSeries = React.useMemo(
		() =>
			chartType === 'marketCap' && chartView === 'pie'
				? prepareStablecoinMarketCapSeries({
						rows: chainTotals,
						view: 'pie',
						getName: (row) => row.name,
						getValue: (row) => row.circulating ?? 0
					})
				: null,
		[chainTotals, chartType, chartView]
	)

	const displayedTotalCirculating = React.useMemo(() => {
		if (!includeUnreleased) return totalCirculating
		return totalCirculating == null || unreleased == null ? null : totalCirculating + unreleased
	}, [includeUnreleased, totalCirculating, unreleased])

	const displayedMarketCap = React.useMemo(() => {
		if (!includeUnreleased) return mcap
		if (mcap == null || unreleased == null || price == null) return null
		return mcap + unreleased * price
	}, [includeUnreleased, mcap, unreleased, price])

	const groupedChains = groupBridgeData(chainTotals, bridgeInfo)

	const getImageExportTitle = () => {
		if (chartType === 'marketCap') {
			return chartView === 'total' ? name : `${name} Circulating Supply`
		}
		if (chartType === 'volume') {
			return chartView === 'total' ? name : `${name} Volume`
		}

		return name
	}

	const getImageExportFilename = () => {
		const chartSlug = `${chartType}-${chartView}`.toLowerCase()
		return `${slug(name)}-${chartSlug}`
	}

	const dashboardChartConfig: StablecoinAssetChartConfig = React.useMemo(
		() => ({
			id: `stablecoin-asset-${slug(name)}-${getStablecoinAssetDashboardChartType(chartView)}`,
			kind: 'stablecoin-asset',
			stablecoin: name,
			stablecoinId: slug(name),
			chartType: getStablecoinAssetDashboardChartType(chartView),
			colSpan: 1
		}),
		[name, chartView]
	)

	const selectedSeriesChart = getStablecoinAssetSeriesChart(chartType, chartView)
	const volumeChartKind = getStablecoinAssetVolumeChartKind(chartType, chartView)
	const volumeToken = symbol && symbol !== '-' ? symbol : null
	const volumeChartQuery = useStablecoinVolumeChartData({
		scope: 'token',
		token: volumeToken,
		chart: volumeChartKind,
		selectionIntent,
		enabled: chartType === 'volume' && volumeToken != null
	})
	const usesDefaultChartData = selectedSeriesChart === 'totalCirc' && !includeUnreleased
	const chartSeriesQuery = useStablecoinChartSeriesData({
		scope: 'asset',
		stablecoin: slug(name),
		chart: selectedSeriesChart,
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
		selectionIntent,
		includeUnreleased,
		enabled: selectedSeriesChart != null && !usesDefaultChartData
	})
	const selectedChartData = React.useDeferredValue(
		usesDefaultChartData ? defaultChartData : (chartSeriesQuery.data ?? null)
	)
	const groupedVolumeChartData = React.useMemo(
		() => (volumeChartQuery.data ? groupStablecoinVolumeChartPayload(volumeChartQuery.data, volumeGroupBy) : null),
		[volumeChartQuery.data, volumeGroupBy]
	)
	// Deferred with its grouping, so labels never pair old rows with a new grouping.
	const volumeChartSnapshot = React.useMemo(
		() => ({ data: groupedVolumeChartData, groupBy: volumeGroupBy }),
		[groupedVolumeChartData, volumeGroupBy]
	)
	const deferredVolumeChart = React.useDeferredValue(volumeChartSnapshot)
	const selectedVolumeChartData = deferredVolumeChart.data
	const isSelectedChartLoading =
		!usesDefaultChartData &&
		selectedChartData == null &&
		(chartSeriesQuery.isLoading || chartSeriesQuery.isFetching || chartSeriesQuery.data != null)
	const isVolumeChartLoading =
		selectedVolumeChartData == null &&
		(volumeChartQuery.isLoading || volumeChartQuery.isFetching || volumeChartQuery.data != null)
	const showDefaultLegend = chartType === 'marketCap' && (chartView === 'breakdown' || chartView === 'dominance')
	const selectedPayload = chartType === 'volume' ? selectedVolumeChartData : selectedChartData
	const runtimeSeries = React.useMemo(
		() =>
			seriesSelectorLabel && !marketCapSeries && selectedPayload
				? getStablecoinRuntimeSeries(selectedPayload)
				: EMPTY_RUNTIME_SERIES,
		[marketCapSeries, selectedPayload, seriesSelectorLabel]
	)
	const { activeSeries, selectableSeries, renderedCharts, setSelectedSeries } = useStablecoinChartSelection({
		marketCapSeries,
		runtimeSeries,
		selectionIntent,
		setSelectionIntent
	})
	const marketCapPresentation = React.useMemo(
		() =>
			marketCapSeries
				? buildStablecoinMarketCapPresentation({ series: marketCapSeries, selectedSeries: renderedCharts })
				: null,
		[marketCapSeries, renderedCharts]
	)
	const selectedChartsWithHelpers = React.useMemo(
		() => new Set([...renderedCharts, ...runtimeSeries.alwaysVisibleSeries]),
		[renderedCharts, runtimeSeries.alwaysVisibleSeries]
	)
	const activeSelectedCharts =
		seriesSelectorLabel && selectableSeries.length > 1 ? selectedChartsWithHelpers : undefined
	const csvSource: ChartCsvSource | null = marketCapSeries
		? {
				type: 'dataset',
				prepare: () => buildStablecoinMarketCapCsvDataset({ series: marketCapSeries, selectedSeries: renderedCharts })
			}
		: activeSelectedCharts && volumeChartKind != null
			? {
					type: 'dataset',
					prepare: () =>
						fetchStablecoinVolumeCsvDataset(
							{ scope: 'token', token: volumeToken, chart: volumeChartKind, selectionIntent },
							volumeGroupBy
						)
				}
			: activeSelectedCharts && selectedSeriesChart != null
				? {
						type: 'dataset',
						prepare: () =>
							fetchStablecoinSeriesCsvDataset(
								{
									scope: 'asset',
									stablecoin: slug(name),
									chart: selectedSeriesChart,
									selectionIntent,
									includeUnreleased
								},
								null
							)
					}
				: selectedPayload
					? { type: 'dataset', prepare: () => selectedPayload.dataset }
					: null

	const hasInfo =
		description || pegMechanism || mintRedeemDescription || (auditLinks != null && auditLinks.length > 0) || url
	const showStablecoinMenu = stablecoinOptions != null && stablecoinOptions.length > 1 && onStablecoinChange != null

	return (
		<>
			<SummaryCardGrid>
				{/* Stats card — variant 3 stat stack; body is intentionally not StatItem */}
				<SummaryStatsCard>
					<EntityTitleRow
						logo={<TokenLogo name={name} kind="pegged" alt={`Logo of ${name}`} size={24} />}
						actions={
							url ? (
								<WebsiteGlobeLink
									url={url}
									name={name}
									event="stablecoin-website-click"
									eventData={{ stablecoin: name }}
								/>
							) : null
						}
					>
						{showStablecoinMenu ? (
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="label-xs text-tertiary">Stablecoin</span>
								<Menu
									name={getStablecoinOptionLabel({ name, symbol })}
									options={stablecoinOptions.map(getStablecoinOptionLabel)}
									onItemClick={(selectedLabel) => {
										const selectedOption = stablecoinOptions.find(
											(option) => getStablecoinOptionLabel(option) === selectedLabel
										)
										if (selectedOption) onStablecoinChange(selectedOption.id)
									}}
									render={
										<button
											type="button"
											className="-ml-1 flex w-fit items-center gap-1 rounded-md px-1 py-0.5 font-bold text-primary hover:bg-hover-row focus-visible:bg-hover-row"
										/>
									}
								/>
							</span>
						) : (
							name
						)}
						{!showStablecoinMenu && symbol && symbol !== '-' ? <span className="font-normal">({symbol})</span> : null}
						{lifecycleStatus ? <DeprecatedProtocolMarker size="size-4.5" content={lifecycleStatus} /> : null}
					</EntityTitleRow>

					<p className="flex flex-col">
						<span className="label-md text-secondary">Market cap</span>
						<span className="min-h-8 mono-xl">
							{displayedMarketCap == null
								? 'N/A'
								: formatUsd(displayedMarketCap, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
						</span>
					</p>

					<div className="flex flex-col">
						<p className="flex flex-wrap justify-between gap-4 border-b border-subtle py-1 first:pt-0 last:border-none last:pb-0">
							<span className="label-md text-secondary">Price</span>
							<span className="mono-md">
								{price === null
									? '-'
									: formatUsd(price, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							</span>
						</p>
						{displayedTotalCirculating != null ? (
							<p className="flex flex-wrap justify-between gap-4 border-b border-subtle py-1 first:pt-0 last:border-none last:pb-0">
								<span className="label-md text-secondary">Total Circulating</span>
								<span className="mono-md">
									{formatCompactNumber(displayedTotalCirculating, {
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</p>
						) : null}
						{unreleased != null && unreleased > 0 ? (
							<div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle py-1 first:pt-0 last:border-none last:pb-0">
								<span className="flex items-center gap-1">
									<Checkbox
										variant="inline"
										checked={includeUnreleased}
										onChange={onUnreleasedToggle}
										value={UNRELEASED_QUERY_KEY}
									>
										{capitalizeFirstLetter(UNRELEASED_QUERY_KEY)}
									</Checkbox>
									<QuestionHelper text="Use this option to choose whether to include coins that have been minted but have never been circulating." />
								</span>
								<span className="mono-md">
									{formatCompactNumber(unreleased, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
								</span>
							</div>
						) : null}
					</div>
				</SummaryStatsCard>

				{/* Chart */}
				<Panel className="col-span-2">
					<ChartPanelToolbar>
						<SegmentedControl
							value={chartType}
							onValueChange={onChartTypeChange}
							options={chartTypeOptions.map(({ key, name: optionName }) => ({ value: key, label: optionName }))}
							label="Chart type"
							variant="default"
							size="md"
							className="mr-auto"
						/>
						<Select
							heading="Chart view"
							allValues={chartViewOptions}
							selectedValues={chartView}
							setSelectedValues={onChartViewChange}
							label={getStablecoinChartViewLabel(chartView)}
							labelType="none"
							variant="filter"
							size="md"
						/>
						{seriesSelectorLabel && selectableSeries.length > 1 ? (
							<SelectWithCombobox
								allValues={selectableSeries}
								selectedValues={activeSeries}
								setSelectedValues={setSelectedSeries}
								label={seriesSelectorLabel}
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
						{chartType === 'volume' ? null : <AddToDashboardButton chartConfig={dashboardChartConfig} smol />}
						{chartType === 'volume' ? (
							<ChartGroupingSelector
								value={volumeGroupBy}
								options={DWMC_GROUPING_OPTIONS_LOWERCASE}
								onValueChange={onVolumeGroupByChange}
							/>
						) : null}
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename={getImageExportFilename()}
							title={getImageExportTitle()}
							iconUrl={peggedAssetIconUrl(name)}
							csvSource={csvSource}
						/>
					</ChartPanelToolbar>
					{chartType === 'marketCap' && chartView === 'pie' ? (
						<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="w-full" />}>
							<PieChart
								chartData={marketCapPresentation?.kind === 'pie' ? marketCapPresentation.chartData : []}
								{...(marketCapPresentation?.kind === 'pie' ? { stackColors: marketCapPresentation.stackColors } : {})}
								valueSymbol={symbol}
								onReady={handleChartReady}
							/>
						</React.Suspense>
					) : chartType === 'volume' ? (
						<SelectedAssetChart
							data={selectedVolumeChartData}
							isLoading={isVolumeChartLoading}
							failedRead={queryReadFailed(volumeChartQuery) ? volumeChartQuery : null}
							showLegend={chartView === 'byChain'}
							{...(activeSelectedCharts === undefined ? {} : { selectedCharts: activeSelectedCharts })}
							groupBy={deferredVolumeChart.groupBy}
							onReady={handleChartReady}
						/>
					) : (
						<SelectedAssetChart
							data={selectedChartData}
							isLoading={isSelectedChartLoading}
							failedRead={!usesDefaultChartData && queryReadFailed(chartSeriesQuery) ? chartSeriesQuery : null}
							showLegend={showDefaultLegend}
							{...(activeSelectedCharts === undefined ? {} : { selectedCharts: activeSelectedCharts })}
							onReady={handleChartReady}
						/>
					)}
				</Panel>

				{/* Additional info cards */}
				{hasInfo ? (
					<div className="col-span-full">
						<Card as="section" padding="sm" className="flex flex-col gap-3 body-md">
							<h2 className="heading-xs">Stablecoin information</h2>
							{description ? <p className="body-md">{description}</p> : null}
							{pegMechanism ? (
								<p className="flex flex-wrap items-center gap-2">
									<span className="label-md text-secondary">Category:</span>
									<span className="inline-flex items-center gap-1 label-md text-primary">
										{pegMechanism}
										<QuestionHelper text={risksHelperTexts[pegMechanism] || 'No additional info available'} />
									</span>
								</p>
							) : null}
							{mintRedeemDescription ? (
								<>
									<p className="label-md text-secondary">Minting and Redemption</p>
									<p className="body-md text-primary">{mintRedeemDescription}</p>
								</>
							) : null}
							<p className="flex items-center gap-1">
								<span className="flex flex-nowrap items-center gap-1 label-md text-secondary">
									<span>Audits</span>
									<QuestionHelper text="Audits are not a security guarantee" />
									<span>:</span>
								</span>
								{auditLinks != null && auditLinks.length > 0 ? (
									<Menu name="Yes" options={auditLinks} isExternal />
								) : (
									<span>No</span>
								)}
							</p>
							<div className="flex flex-wrap gap-3">
								{url ? (
									<ExternalLinkButton
										href={url}
										icon="globe"
										data-umami-event="stablecoin-website-click"
										data-umami-event-stablecoin={name}
										data-umami-event-placement="info"
										data-umami-event-url={url}
									>
										Website
									</ExternalLinkButton>
								) : null}
								{twitter ? (
									<ExternalLinkButton href={twitter} icon="twitter">
										X/Twitter
									</ExternalLinkButton>
								) : null}
								{blockExplorerUrl ? (
									<ExternalLinkButton href={blockExplorerUrl}>{blockExplorerName}</ExternalLinkButton>
								) : null}
								{onCoinGecko && gecko_id ? (
									<ExternalLinkButton href={`https://www.coingecko.com/en/coins/${gecko_id}`}>
										CoinGecko
									</ExternalLinkButton>
								) : null}
								{module ? (
									<ExternalLinkButton
										href={`https://github.com/DefiLlama/peggedassets-server/tree/master/src/adapters/peggedAssets/${module}`}
										icon="github"
									>
										Check the code
									</ExternalLinkButton>
								) : null}
							</div>
						</Card>
					</div>
				) : null}
			</SummaryCardGrid>

			<StablecoinByChainUsageTable data={groupedChains} />
		</>
	)
}

function SelectedAssetChart({
	data,
	isLoading,
	failedRead,
	showLegend,
	selectedCharts,
	groupBy,
	onReady
}: {
	data: StablecoinChartSeriesPayload | null
	isLoading: boolean
	failedRead: QueryRetry | null
	showLegend: boolean
	selectedCharts?: Set<string>
	groupBy?: LowercaseDwmcGrouping
	onReady: (instance: echarts.ECharts | null) => void
}) {
	if (failedRead) {
		return (
			<SurfaceBodyStatus variant="error" retry={failedRead}>
				Couldn&apos;t load chart data.
			</SurfaceBodyStatus>
		)
	}
	if (isLoading) {
		return <SurfaceBodyLoadingStatus label="Loading chart" className="w-full" />
	}
	if (!data || data.charts.length === 0 || data.dataset.source.length === 0) {
		return (
			<SurfaceBodyStatus variant="empty" className="w-full">
				Chart unavailable.
			</SurfaceBodyStatus>
		)
	}
	return (
		<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="w-full" />}>
			<MultiSeriesChart
				dataset={data.dataset}
				charts={data.charts}
				{...(selectedCharts === undefined ? {} : { selectedCharts })}
				stacked={data.stacked}
				{...(data.expandTo100Percent === undefined ? {} : { expandTo100Percent: data.expandTo100Percent })}
				valueSymbol={data.valueSymbol}
				showTotalInTooltip={data.showTotalInTooltip}
				showLegend={showLegend}
				{...(groupBy === undefined ? {} : { groupBy })}
				onReady={onReady}
			/>
		</React.Suspense>
	)
}
