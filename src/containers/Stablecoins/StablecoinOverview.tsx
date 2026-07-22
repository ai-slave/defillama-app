import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Menu } from '~/components/Menu'
import { Select } from '~/components/Select/Select'
import { LinkPreviewCard } from '~/components/SEO'
import { TokenLogo } from '~/components/TokenLogo'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import type { StablecoinAssetChartConfig } from '~/containers/ProDashboard/types'
import {
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
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
	parseStablecoinChartState,
	parseStablecoinVolumeGroupBy,
	type StablecoinChartType as StablecoinChartCategory,
	type StablecoinChartView
} from '~/containers/Stablecoins/chartState'
import { useCalcCirculating, useGroupBridgeData } from '~/containers/Stablecoins/hooks'
import { useStablecoinChartSeriesData, useStablecoinVolumeChartData } from '~/containers/Stablecoins/queries.client'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Checkbox } from '~/ui/Checkbox'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { capitalizeFirstLetter, formattedNum, slug } from '~/utils'
import { peggedAssetIconUrl } from '~/utils/icons'
import { isTruthyQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { StablecoinByChainUsageTable } from './StablecoinUsageByChainTable'
import type { PeggedAssetPageProps } from './types'
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
const UNRELEASED_QUERY_KEY = 'unreleased'
const INFO_ACTION_STYLES = buttonStyles({ size: 'md' })

export default function PeggedContainer(props: PeggedAssetPageProps) {
	return (
		<>
			<LinkPreviewCard
				stablePage={true}
				cardName={props.peggedAssetData.name}
				token={props.peggedAssetData.name}
				logo={peggedAssetIconUrl(props.peggedAssetData.name)}
				tvl={formattedNum(props.mcap, true)?.toString()}
			/>
			<PeggedAssetInfo {...props} />
		</>
	)
}

export const PeggedAssetInfo = ({
	chainsUnique: _chainsUnique,
	chainCirculatings,
	peggedAssetData,
	defaultChartData,
	totalCirculating,
	unreleased,
	mcap,
	bridgeInfo,
	blockExplorerUrl,
	blockExplorerName
}: PeggedAssetPageProps) => {
	const router = useRouter()
	let {
		name,
		onCoinGecko,
		gecko_id,
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
	const volumeGroupBy = React.useMemo(() => parseStablecoinVolumeGroupBy(router.query.groupBy), [router.query.groupBy])
	const chartTypeOptions = React.useMemo(() => getStablecoinChartTypeOptions(ASSET_CHART_MODE), [])
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
			const view = nextChartView as StablecoinChartView
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

	// Static pages do not receive query parameters during SSR, so defer this URL-driven state until after hydration.
	const [includeUnreleased, setIncludeUnreleased] = React.useState(false)
	React.useEffect(() => {
		if (router.isReady) setIncludeUnreleased(isTruthyQueryParam(router.query[UNRELEASED_QUERY_KEY]))
	}, [router.isReady, router.query])
	const onUnreleasedToggle = React.useCallback(() => {
		const nextValue = !includeUnreleased
		setIncludeUnreleased(nextValue)
		const nextQuery: Record<string, string | string[]> = {}
		for (const key in router.query) {
			const value = router.query[key]
			if (typeof value === 'undefined' || key === UNRELEASED_QUERY_KEY) continue
			if (typeof value === 'string' || Array.isArray(value)) nextQuery[key] = value
		}
		if (nextValue) nextQuery[UNRELEASED_QUERY_KEY] = 'true'
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true, scroll: false })
	}, [includeUnreleased, router])

	const chainTotals = useCalcCirculating(chainCirculatings, includeUnreleased)

	const chainsCirculatingValues = React.useMemo(() => {
		return preparePieChartData({ data: chainTotals, sliceIdentifier: 'name', sliceValue: 'circulating', limit: 10 })
	}, [chainTotals])

	const displayedTotalCirculating = React.useMemo(() => {
		if (!includeUnreleased) return totalCirculating
		let total = 0
		let hasValue = false
		for (const chain of chainTotals) {
			const value = Number(chain.circulating ?? 0)
			if (!Number.isFinite(value)) continue
			total += value
			hasValue = true
		}
		return hasValue ? total : totalCirculating
	}, [chainTotals, includeUnreleased, totalCirculating])

	const displayedMarketCap = React.useMemo(() => {
		if (!includeUnreleased) return mcap
		const baseMcap = typeof mcap === 'number' && Number.isFinite(mcap) ? mcap : null
		const unreleasedSupply = typeof unreleased === 'number' && Number.isFinite(unreleased) ? unreleased : null
		const tokenPrice = typeof price === 'number' && Number.isFinite(price) ? price : null
		if (baseMcap == null) return null
		if (unreleasedSupply == null || tokenPrice == null) return baseMcap
		return baseMcap + unreleasedSupply * tokenPrice
	}, [includeUnreleased, mcap, unreleased, price])

	const groupedChains = useGroupBridgeData(chainTotals, bridgeInfo)

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
		enabled: chartType === 'volume' && volumeToken != null
	})
	const usesDefaultChartData = selectedSeriesChart === 'totalCirc' && !includeUnreleased
	const chartSeriesQuery = useStablecoinChartSeriesData({
		scope: 'asset',
		stablecoin: slug(name),
		chart: selectedSeriesChart,
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
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
	const selectedVolumeChartData = React.useDeferredValue(groupedVolumeChartData)
	const isSelectedChartLoading =
		!usesDefaultChartData &&
		selectedChartData == null &&
		(chartSeriesQuery.isLoading || chartSeriesQuery.isFetching || chartSeriesQuery.data != null)
	const isSelectedChartError = !isSelectedChartLoading && !usesDefaultChartData && chartSeriesQuery.error != null
	const isVolumeChartLoading =
		selectedVolumeChartData == null &&
		(volumeChartQuery.isLoading || volumeChartQuery.isFetching || volumeChartQuery.data != null)
	const showDefaultLegend = chartType === 'marketCap' && (chartView === 'breakdown' || chartView === 'dominance')

	const hasInfo =
		description || pegMechanism || mintRedeemDescription || (auditLinks != null && auditLinks.length > 0) || url

	return (
		<>
			<SummaryCardGrid>
				{/* Stats card — variant 3 stat stack; body is intentionally not StatItem */}
				<SummaryStatsCard>
					<h1 className="flex flex-wrap items-center gap-2 text-xl">
						<TokenLogo name={name} kind="pegged" alt={`Logo of ${name}`} size={24} />
						<span className="font-bold">{name}</span>
						{symbol && symbol !== '-' ? <span className="font-normal">({symbol})</span> : null}
						{peggedAssetData.deprecated ? <DeprecatedProtocolMarker size={18} /> : null}
						{url ? (
							<span className="-m-2 ml-auto flex items-center justify-end gap-1">
								<WebsiteGlobeLink
									url={url}
									name={name}
									event="stablecoin-website-click"
									eventData={{ stablecoin: name }}
								/>
							</span>
						) : null}
					</h1>

					<p className="flex flex-col">
						<span className="label-md text-secondary">Market Cap</span>
						<span className="min-h-8 mono-xl">{formattedNum(displayedMarketCap ?? '0', true)}</span>
					</p>

					<div className="flex flex-col">
						<p className="flex flex-wrap justify-between gap-4 border-b border-subtle py-1 first:pt-0 last:border-none last:pb-0">
							<span className="label-md text-secondary">Price</span>
							<span className="mono-md">{price === null ? '-' : formattedNum(price, true)}</span>
						</p>
						{displayedTotalCirculating != null ? (
							<p className="flex flex-wrap justify-between gap-4 border-b border-subtle py-1 first:pt-0 last:border-none last:pb-0">
								<span className="label-md text-secondary">Total Circulating</span>
								<span className="mono-md">{formattedNum(displayedTotalCirculating)}</span>
							</p>
						) : null}
						{unreleased != null && unreleased > 0 ? (
							<div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle py-1 first:pt-0 last:border-none last:pb-0">
								<Checkbox
									variant="inline"
									checked={includeUnreleased}
									onChange={onUnreleasedToggle}
									value={UNRELEASED_QUERY_KEY}
								>
									<span className="flex items-center gap-1">
										<span>{capitalizeFirstLetter(UNRELEASED_QUERY_KEY)}</span>
										<QuestionHelper text="Use this option to choose whether to include coins that have been minted but have never been circulating." />
									</span>
								</Checkbox>
								<span className="mono-md">{formattedNum(unreleased)}</span>
							</div>
						) : null}
					</div>
				</SummaryStatsCard>

				{/* Chart */}
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar className="justify-end">
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
							allValues={chartViewOptions}
							selectedValues={chartView}
							setSelectedValues={onChartViewChange}
							label={getStablecoinChartViewLabel(chartView)}
							labelType="none"
							variant="filter"
							size="md"
						/>
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
						/>
					</ChartPanelToolbar>
					{chartType === 'marketCap' && chartView === 'pie' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback className="w-full" />}>
							<PieChart chartData={chainsCirculatingValues} onReady={handleChartReady} />
						</React.Suspense>
					) : chartType === 'volume' ? (
						<SelectedAssetChart
							data={selectedVolumeChartData}
							isLoading={isVolumeChartLoading}
							isError={!isVolumeChartLoading && volumeChartQuery.error != null}
							hideDefaultLegend={chartView !== 'byChain'}
							groupBy={volumeGroupBy}
							onReady={handleChartReady}
						/>
					) : (
						<SelectedAssetChart
							data={selectedChartData}
							isLoading={isSelectedChartLoading}
							isError={isSelectedChartError}
							hideDefaultLegend={!showDefaultLegend}
							onReady={handleChartReady}
						/>
					)}
				</ChartPanel>

				{/* Additional info cards */}
				{hasInfo ? (
					<div className="col-span-full">
						<Card as="section" padding="sm" className="flex flex-col gap-3 body-md">
							<h2 className="heading-xs">Stablecoin Information</h2>
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
									<Menu name="Yes" options={auditLinks} isExternal className={INFO_ACTION_STYLES} />
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
										Twitter
									</ExternalLinkButton>
								) : null}
								{blockExplorerUrl ? (
									<ExternalLinkButton href={blockExplorerUrl}>{blockExplorerName}</ExternalLinkButton>
								) : null}
								{onCoinGecko === 'true' && gecko_id ? (
									<ExternalLinkButton href={`https://www.coingecko.com/en/coins/${gecko_id}`}>
										CoinGecko
									</ExternalLinkButton>
								) : null}
								{gecko_id ? (
									<ExternalLinkButton
										href={`https://github.com/DefiLlama/peggedassets-server/tree/master/src/adapters/peggedAssets/${gecko_id}`}
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
	isError,
	hideDefaultLegend,
	groupBy,
	onReady
}: {
	data: StablecoinChartSeriesPayload | null
	isLoading: boolean
	isError: boolean
	hideDefaultLegend: boolean
	groupBy?: LowercaseDwmcGrouping
	onReady: (instance: echarts.ECharts | null) => void
}) {
	if (isLoading) {
		return (
			<ChartPanelBodyFallback role="status" aria-live="polite" className="w-full body-sm text-tertiary">
				Loading chart...
			</ChartPanelBodyFallback>
		)
	}
	if (isError || !data) {
		return (
			<ChartPanelBodyFallback role="alert" className="w-full body-sm text-data-down">
				Chart unavailable
			</ChartPanelBodyFallback>
		)
	}
	if (data.charts.length === 0 || data.dataset.source.length === 0) {
		return (
			<ChartPanelBodyFallback role="status" aria-live="polite" className="w-full body-sm text-tertiary">
				Chart unavailable
			</ChartPanelBodyFallback>
		)
	}
	return (
		<React.Suspense fallback={<ChartPanelBodyFallback className="w-full" />}>
			<MultiSeriesChart
				dataset={data.dataset}
				charts={data.charts}
				stacked={data.stacked}
				expandTo100Percent={data.expandTo100Percent}
				valueSymbol={data.valueSymbol}
				showTotalInTooltip={data.showTotalInTooltip}
				hideDefaultLegend={hideDefaultLegend}
				groupBy={groupBy}
				onReady={onReady}
			/>
		</React.Suspense>
	)
}
