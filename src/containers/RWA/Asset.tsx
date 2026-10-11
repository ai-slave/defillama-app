import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { type CSSProperties, lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { YIELD_EARN_PRIVATE_API } from '~/containers/Yields/constants'
import type { EarnPageRow } from '~/containers/Yields/data/types'
import { resolveEarnColumnAccess } from '~/containers/Yields/Filters/columnOptions'
import { PaginatedYieldsPoolTable } from '~/containers/Yields/Tables/Pools'
import { useVerifiedAccess } from '~/containers/Yields/useVerifiedAccess'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { CHART_FILL, ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'
import { CopyHelper } from '~/ui/Copy'
import { HeroMetric } from '~/ui/HeroMetric'
import { Icon } from '~/ui/Icon'
import { KeyMetricsPanel } from '~/ui/KeyMetricsCard'
import { MetricRow, MetricSection, SubMetricRow, SubMetricSection } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { Tooltip } from '~/ui/Tooltip'
import { truncateAddress } from '~/utils'
import { handleSimpleFetchResponse } from '~/utils/async'
import { chainIconUrl } from '~/utils/icons'
import {
	formatUsd,
	formatPercent,
	USD_LOWERCASE_MILLIONS_OPTIONS,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS
} from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { IRWAAssetData, IRWAAssetFlowSummary } from './api.types'
import { definitions } from './definitions'
import {
	RWAFlowCoverageTag,
	RWAFlowSummaryTooltip,
	RWAFlowValueShimmer,
	RWAFlowValueUnavailable,
	RWAFlowVsPriceStrip
} from './FlowPanelParts'
import {
	buildRWAFlowChart,
	getRWAFlowModeQueryValue,
	getRWAFlowVisibleRange,
	getRWAFlowVsPriceSummary,
	parseRWAFlowQueryState,
	RWA_FLOW_GROUPING_OPTIONS,
	type RWAFlowChartSelection,
	type RWAFlowGrouping,
	type RWAFlowZoom
} from './flows'
import { useRWAAssetFlows, useRWAFlowSummary } from './flows.hooks'
import { getRwaPlatforms } from './grouping'
import { rwaSlug } from './rwaSlug'
import { RWASuspiciousWarning } from './SuspiciousWarning'
import { useNativeYieldHistory } from './useNativeYieldChart'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const RWAFlowsChart = lazy(() => import('./FlowsChart').then((module) => ({ default: module.RWAFlowsChart })))

type AssetChartMetric = 'marketData' | 'flows' | 'flowVsPrice'

const ASSET_CHART_METRIC_OPTIONS = [
	{ value: 'marketData' as const, label: 'Market data' },
	{
		value: 'flows' as const,
		label: definitions.flows.assetNetFlows.label,
		tooltip: definitions.flows.assetNetFlows.description
	},
	{
		value: 'flowVsPrice' as const,
		label: definitions.flows.flowVsPrice.label,
		tooltip: definitions.flows.flowVsPrice.description
	}
]

interface ClassificationItemProps {
	label: string
	value?: string | null
	positive?: boolean | null | undefined
	description?: string
}

function ClassificationItem({ label, value, positive, description }: ClassificationItemProps) {
	if (value == null && positive == null) return null

	const isBoolean = positive != null
	const displayValue = isBoolean ? (positive ? 'Yes' : 'No') : value

	return (
		<div
			className={`flex items-start justify-between gap-2 rounded-md border p-2 ${
				isBoolean
					? positive
						? 'border-success-muted bg-success-tint'
						: 'border-error-muted bg-error-tint'
					: 'border-subtle bg-surface'
			}`}
		>
			<p className="flex flex-col gap-1">
				<span className={`font-medium ${isBoolean ? (positive ? 'text-success' : 'text-error') : 'text-secondary'}`}>
					{label}
				</span>
				{description ? <span className="body-sm text-secondary">{description}</span> : null}
			</p>
			{isBoolean ? (
				<Icon
					name={positive ? 'check-circle' : 'x'}
					className={`size-5 shrink-0 ${positive ? 'text-success' : 'text-error'}`}
				/>
			) : (
				<span className="font-medium">{displayValue}</span>
			)}
		</div>
	)
}

// KYC items: true = warning (amber), false = green (no KYC required is good)
function KYCItem({ label, required, description }: { label: string; required: boolean | null; description?: string }) {
	if (required == null) return null

	return (
		<div
			className={`flex items-start justify-between gap-2 rounded-md border p-2 ${
				required ? 'border-warning-muted bg-warning-tint' : 'border-success-muted bg-success-tint'
			}`}
		>
			<p className="flex flex-col gap-1">
				<span className={`font-medium ${required ? 'text-warning' : 'text-success'}`}>{label}</span>
				{description ? <span className="body-sm text-secondary">{description}</span> : null}
			</p>
			<Icon
				name={required ? 'alert-triangle' : 'check-circle'}
				className={`size-5 shrink-0 ${required ? 'text-warning' : 'text-success'}`}
			/>
		</div>
	)
}

function SectionCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
	return (
		<Card as="section" padding="sm" className="flex flex-col gap-3">
			<h2 className="heading-xs">{title}</h2>
			{children}
		</Card>
	)
}

function AssetHeader({
	asset,
	displayName,
	headingAs: Tag = 'h1'
}: {
	asset: IRWAAssetData
	displayName: string
	headingAs?: 'h1' | 'div'
}) {
	return (
		<>
			<Tag className="flex flex-wrap items-center gap-2 heading-sm">
				{asset.logo ? <TokenLogo src={asset.logo} size={24} /> : null}
				<span>{displayName}</span>
				{asset.ticker ? <span className="font-normal text-tertiary">({asset.ticker})</span> : null}
				{asset.suspicious === true ? (
					<RWASuspiciousWarning {...(asset.suspiciousReason !== undefined ? { reason: asset.suspiciousReason } : {})} />
				) : null}
			</Tag>
			<HeroMetric
				label={definitions.onChainMcap.label}
				tooltip={definitions.onChainMcap.description}
				value={
					asset.onChainMcap?.total != null ? formatUsd(asset.onChainMcap.total, USD_LOWERCASE_MILLIONS_OPTIONS) : '-'
				}
				{...(asset.onChainMcap?.breakdown
					? {
							byChain: asset.onChainMcap.breakdown.map(([chain, v]) => [
								chain,
								formatUsd(v, USD_LOWERCASE_MILLIONS_OPTIONS)
							])
						}
					: {})}
			/>
		</>
	)
}

function AssetKeyMetrics({
	asset,
	flow7d,
	flow30d,
	isLoadingFlows,
	isFlowUnavailable
}: {
	asset: IRWAAssetData
	flow7d: IRWAAssetFlowSummary | undefined
	flow30d: IRWAAssetFlowSummary | undefined
	isLoadingFlows: boolean
	isFlowUnavailable: boolean
}) {
	const activeMcap = asset.activeMcap ?? null
	const defiActiveTvl = asset.defiActiveTvl ?? null

	return (
		<KeyMetricsPanel>
			{activeMcap?.breakdown != null && activeMcap.breakdown.length > 0 ? (
				<MetricSection
					label={definitions.activeMcap.label}
					tooltip={definitions.activeMcap.description}
					value={formatUsd(activeMcap.total, USD_LOWERCASE_MILLIONS_OPTIONS)}
				>
					{activeMcap.breakdown.map(([chain, value]) => (
						<SubMetricRow key={chain} label={chain} value={formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS)} />
					))}
				</MetricSection>
			) : (
				<MetricRow
					label={definitions.activeMcap.label}
					tooltip={definitions.activeMcap.description}
					value={activeMcap?.total != null ? formatUsd(activeMcap.total, USD_LOWERCASE_MILLIONS_OPTIONS) : '-'}
				/>
			)}
			{asset.defiActiveTvlByProtocolChain != null && asset.defiActiveTvlByProtocolChain.length > 0 ? (
				<MetricSection
					label={definitions.defiActiveTvl.label}
					tooltip={definitions.defiActiveTvl.description}
					value={formatUsd(defiActiveTvl?.total ?? 0, USD_LOWERCASE_MILLIONS_OPTIONS)}
				>
					{asset.defiActiveTvlByProtocolChain.map((row) => (
						<SubMetricSection
							key={row.protocol}
							label={row.protocol}
							value={formatUsd(row.total, USD_LOWERCASE_MILLIONS_OPTIONS)}
						>
							{row.byChain.map(([chain, value]) => (
								<SubMetricRow key={chain} label={chain} value={formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS)} />
							))}
						</SubMetricSection>
					))}
				</MetricSection>
			) : (
				<MetricRow
					label={definitions.defiActiveTvl.label}
					tooltip={definitions.defiActiveTvl.description}
					value={formatUsd(defiActiveTvl?.total ?? 0, USD_LOWERCASE_MILLIONS_OPTIONS)}
				/>
			)}
			<MetricRow
				label={definitions.flows.assetNetFlow7d.label}
				tooltip={<RWAFlowSummaryTooltip description={definitions.flows.assetNetFlow7d.description} summary={flow7d} />}
				value={
					isLoadingFlows ? (
						<RWAFlowValueShimmer />
					) : isFlowUnavailable ? (
						<RWAFlowValueUnavailable />
					) : flow7d?.flow == null ? (
						'-'
					) : (
						<Change value={flow7d.flow} unit="usd" />
					)
				}
			/>
			<MetricRow
				label={definitions.flows.assetNetFlow30d.label}
				tooltip={
					<RWAFlowSummaryTooltip description={definitions.flows.assetNetFlow30d.description} summary={flow30d} />
				}
				value={
					isLoadingFlows ? (
						<RWAFlowValueShimmer />
					) : isFlowUnavailable ? (
						<RWAFlowValueUnavailable />
					) : flow30d?.flow == null ? (
						'-'
					) : (
						<Change value={flow30d.flow} unit="usd" />
					)
				}
			/>
			{asset.price != null ? (
				<MetricRow
					label={`${asset.ticker ?? 'Token'} Price`}
					value={formatUsd(asset.price, USD_LOWERCASE_MILLIONS_OPTIONS)}
				/>
			) : null}
			<MetricRow label="Chains" value={asset.chain?.length ?? 0} />
			{asset.nativeYieldCurrent != null ? (
				<MetricRow
					label="Native Yield"
					value={`${formatPercent(asset.nativeYieldCurrent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)}`}
				/>
			) : null}
		</KeyMetricsPanel>
	)
}

function ContractItem({ address, explorerUrl }: { address: string; explorerUrl?: string }) {
	const truncatedAddress = truncateAddress(address)
	return (
		<div className="flex items-center">
			{explorerUrl ? (
				<a
					href={explorerUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 label-sm break-all hover:underline"
				>
					{truncatedAddress}
					<Icon name="external-link" className="size-3 shrink-0" />
				</a>
			) : (
				<p className="flex items-center gap-1 label-sm break-all">
					<span>{truncatedAddress}</span>
					<CopyHelper toCopy={address} className="size-3" />
				</p>
			)}
		</div>
	)
}

function ChainBadge({
	chain,
	isPrimary = false,
	showPrimaryStyle = true,
	contracts,
	contractUrls
}: {
	chain: string
	isPrimary?: boolean
	showPrimaryStyle?: boolean
	contracts?: Array<string>
	contractUrls?: Record<string, string>
}) {
	return (
		<Card padding="sm" className="flex items-start gap-1.5">
			<span className="flex h-lh shrink-0 items-center label-md">
				<img src={chainIconUrl(chain)} alt={chain} className="size-5 rounded-full" loading="lazy" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-center gap-1.5">
					<p className="label-md">{chain}</p>
					{isPrimary && showPrimaryStyle ? (
						<span className="rounded-full border border-brand bg-brand-muted px-1.5 py-0.5 label-sm text-link">
							Primary
						</span>
					) : null}
				</div>
				{contracts && contracts.length > 0 ? (
					<>
						{contracts.map((address) => {
							const explorerUrl = contractUrls?.[address]
							return (
								<ContractItem key={`${chain}-${address}`} address={address} {...(explorerUrl ? { explorerUrl } : {})} />
							)
						})}
					</>
				) : null}
			</div>
		</Card>
	)
}

const EMPTY_YIELD_POOLS: Array<EarnPageRow> = []

export function RWAAssetPage({
	asset,
	parentPlatformHref
}: {
	asset: IRWAAssetData
	parentPlatformHref: string | null
}) {
	const router = useRouter()
	const displayName = asset.assetName ?? asset.ticker ?? 'Unknown asset'
	const keyBase = asset.ticker ?? asset.assetName ?? 'asset'
	const categories = asset.category ?? []
	const assetClasses = asset.assetClass ?? []
	const chartTypeQuery = readSingleQueryValue(router.query.chartType)
	const flowModeQuery = readSingleQueryValue(router.query.flowMode)
	const flowQueryState = parseRWAFlowQueryState(chartTypeQuery, flowModeQuery, true)
	const chartMetric: AssetChartMetric =
		flowQueryState.view === 'flowVsPrice' ? 'flowVsPrice' : flowQueryState.view === 'netFlows' ? 'flows' : 'marketData'
	const flowGroupBy = flowQueryState.groupBy
	const isFlowChart = chartMetric !== 'marketData'
	const showMcapOverlay = readSingleQueryValue(router.query.flowOverlay) !== 'false'
	const attestationFrequency = asset.attestationFrequency ?? null
	const parentPlatforms = getRwaPlatforms(asset.parentPlatform)
	const hasParentPlatformName = asset.parentPlatform != null && asset.parentPlatform.trim().length > 0

	const { data: yieldHistory, isLoading: isLoadingYieldChart } = useNativeYieldHistory(asset.nativeYieldPoolId)
	const { chartInstance: nativeYieldChartInstance, handleChartReady: onNativeYieldChartReady } = useGetChartInstance()
	const { chartInstance: assetChartInstance, handleChartReady: onAssetChartReady } = useGetChartInstance()
	const { data: flowSummary, isLoading: isLoadingFlowSummary, isError: isFlowSummaryError } = useRWAFlowSummary()
	const assetFlowsQuery = useRWAAssetFlows(asset.id, isFlowChart)
	const assetFlows = assetFlowsQuery.data
	const [flowZoom, setFlowZoom] = useState<RWAFlowZoom | null>(null)

	const nativeYieldExportFilename = `${asset.ticker ?? asset.assetName ?? 'asset'}-native-yield`
	const nativeYieldExportTitle = `${asset.ticker ?? asset.assetName ?? 'Asset'} Native Yield`
	const assetChartLabel =
		chartMetric === 'flows' ? 'Net Flows' : chartMetric === 'flowVsPrice' ? 'Flow vs Price' : 'Market Data'
	const assetChartExportFilename = `${asset.ticker ?? asset.assetName ?? 'asset'}-${chartMetric === 'flows' ? 'flows' : chartMetric === 'flowVsPrice' ? 'flow-vs-price' : 'market-data'}`
	const assetChartExportTitle = `${asset.ticker ?? asset.assetName ?? 'Asset'} ${assetChartLabel}`
	const flowSummaryKey = asset.canonicalMarketId
	const flow7d = flowSummary?.windows['7d'].asset[flowSummaryKey]
	const flow30d = flowSummary?.windows['30d'].asset[flowSummaryKey]
	const flowCoverage = assetFlows?.coverage ?? flow30d?.coverage ?? null

	const nativeYieldDataset = useMemo(() => {
		const series = yieldHistory
		if (!series) return null
		const source: Array<[number, number]> = []
		for (const point of series) {
			const base = point.apy?.avg_1d?.base
			if (base == null || !point.date) continue
			const ts = new Date(point.date).getTime()
			// v2 history dates are ISO date strings; skip invalid parses before charting.
			if (!Number.isFinite(ts)) continue
			source.push([Math.floor(ts), Math.round(base * 100) / 100])
		}
		return source.length > 0 ? { source, dimensions: ['timestamp', 'Native Yield'] } : null
	}, [yieldHistory])

	// The page is static, so its rows are the public tier. A subscriber's measured rows are fetched
	// for the same pools, in the same order, so the APY cells and the Exit Status column fill in.
	const { authorizedFetch, hasAccess: paidYields, isDenied } = useVerifiedAccess()
	const { defaultColumns } = resolveEarnColumnAccess({
		hasAccess: paidYields,
		initialVerifiedAccess: false,
		isDenied
	})
	const publicPools = asset.yieldPools ?? EMPTY_YIELD_POOLS
	const { data: measuredPools } = useQuery({
		queryKey: ['rwa-yield-pools', 'measured', asset.slug, ...publicPools.map((pool) => pool.id)],
		queryFn: async () => {
			const params = new URLSearchParams({ pageSize: 'all', includeMemeTokens: 'true' })
			for (const pool of publicPools) params.append('id', pool.id)
			const res = await authorizedFetch(`${YIELD_EARN_PRIVATE_API}?${params.toString()}`)
			if (!res) throw new Error('Authentication required')
			const data = (await handleSimpleFetchResponse(res).then((r) => r.json())) as { rows: Array<EarnPageRow> }
			const byId = new Map(data.rows.map((row) => [row.id, row]))
			return publicPools.map((pool) => byId.get(pool.id) ?? pool)
		},
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: paidYields && publicPools.length > 0
	})
	const displayPools = (paidYields ? measuredPools : undefined) ?? publicPools

	const chartDimensions: ReadonlyArray<string> = asset.chartDataset?.dimensions ?? []
	const assetChartDataset = asset.chartDataset
	const timeSeriesCharts =
		chartDimensions.length > 0
			? BASE_TIME_SERIES_CHARTS.filter((chart) => chartDimensions.includes(String(chart.encode.y)))
			: BASE_TIME_SERIES_CHARTS
	const flowChart = useMemo(() => {
		if (!isFlowChart || !assetFlows) return null
		const selection: RWAFlowChartSelection =
			chartMetric === 'flowVsPrice'
				? { view: 'flowVsPrice', groupBy: flowGroupBy, mcapByTimestamp: null }
				: {
						view: 'netFlows',
						groupBy: flowGroupBy,
						overlays: showMcapOverlay ? [{ metric: 'onChainMcap', values: null }] : []
					}
		return buildRWAFlowChart({ points: assetFlows.data, selection })
	}, [assetFlows, chartMetric, flowGroupBy, isFlowChart, showMcapOverlay])
	const flowVisibleRange = flowChart ? getRWAFlowVisibleRange(flowChart, flowZoom, undefined) : null
	const flowVsPriceSummary = useMemo(
		() => (chartMetric === 'flowVsPrice' && flowChart ? getRWAFlowVsPriceSummary(flowChart, flowVisibleRange) : null),
		[chartMetric, flowChart, flowVisibleRange]
	)

	const attestationLinks = asset.attestationLinks ?? []

	return (
		<div className="flex flex-col gap-2">
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm" className="max-xl:hidden xl:min-h-[360px]">
					<AssetHeader asset={asset} displayName={displayName} headingAs="h1" />
					<AssetKeyMetrics
						asset={asset}
						flow7d={flow7d}
						flow30d={flow30d}
						isLoadingFlows={isLoadingFlowSummary}
						isFlowUnavailable={isFlowSummaryError && !flowSummary}
					/>
				</SummaryStatsCard>
				<div className="col-span-2 flex flex-col gap-2">
					<Card padding="sm" className="flex flex-col gap-6 xl:hidden">
						<AssetHeader asset={asset} displayName={displayName} headingAs="div" />
					</Card>
					<Panel>
						<ChartPanelToolbar>
							<SegmentedControl<AssetChartMetric>
								value={chartMetric}
								onValueChange={(nextMetric) => {
									void pushShallowQuery(router, {
										chartType: nextMetric === 'marketData' ? undefined : nextMetric,
										flowMode: nextMetric !== 'marketData' && flowGroupBy !== 'daily' ? flowGroupBy : undefined,
										flowOverlay: nextMetric === 'flows' && !showMcapOverlay ? 'false' : undefined
									})
								}}
								options={ASSET_CHART_METRIC_OPTIONS}
								label="Chart metric"
								variant="default"
								size="md"
								className="mr-auto"
							/>
							{isFlowChart ? (
								<SegmentedControl<RWAFlowGrouping>
									value={flowGroupBy}
									onValueChange={(nextGroupBy) => {
										void pushShallowQuery(router, {
											flowMode: getRWAFlowModeQueryValue(nextGroupBy, flowQueryState.view)
										})
									}}
									options={RWA_FLOW_GROUPING_OPTIONS}
									label="Flow period"
									variant="default"
									size="md"
								/>
							) : null}
							{chartMetric === 'flows' ? (
								<Switch
									label={definitions.flows.marketcapOverlay.label}
									help={definitions.flows.marketcapOverlay.description}
									value="marketcap"
									checked={showMcapOverlay}
									onChange={(event) => {
										void pushShallowQuery(router, { flowOverlay: event.currentTarget.checked ? undefined : 'false' })
									}}
								/>
							) : null}
							{isFlowChart && flowCoverage != null ? <RWAFlowCoverageTag coverage={flowCoverage} /> : null}
							<ChartExportButtons
								chartInstance={assetChartInstance}
								filename={assetChartExportFilename}
								title={assetChartExportTitle}
								csvSource={
									flowChart
										? { type: 'dataset', prepare: () => flowChart.dataset }
										: assetChartDataset
											? { type: 'dataset', prepare: () => assetChartDataset }
											: null
								}
							/>
						</ChartPanelToolbar>
						{chartMetric === 'flowVsPrice' && flowVsPriceSummary ? (
							<RWAFlowVsPriceStrip summary={flowVsPriceSummary} />
						) : null}
						{isFlowChart ? (
							queryReadFailed(assetFlowsQuery) ? (
								<SurfaceBodyStatus variant="error" retry={assetFlowsQuery}>
									Couldn&apos;t load flow data.
								</SurfaceBodyStatus>
							) : assetFlowsQuery.isLoading ? (
								<SurfaceBodyLoadingStatus label="Loading chart" />
							) : flowChart ? (
								<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
									<RWAFlowsChart
										chart={flowChart}
										onVisibleRangeChange={(range) => setFlowZoom({ source: flowChart.dataset.source, range })}
										onReady={onAssetChartReady}
									/>
								</Suspense>
							) : (
								<SurfaceBodyStatus variant="empty">No flow data available.</SurfaceBodyStatus>
							)
						) : assetChartDataset ? (
							<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
								<MultiSeriesChart
									charts={timeSeriesCharts}
									dataset={assetChartDataset}
									showLegend
									exportButtons="hidden"
									onReady={onAssetChartReady}
								/>
							</Suspense>
						) : (
							<SurfaceBodyStatus variant="empty">No market data available.</SurfaceBodyStatus>
						)}
					</Panel>
					<Card padding="sm" className="flex flex-col gap-6 xl:hidden">
						<AssetKeyMetrics
							asset={asset}
							flow7d={flow7d}
							flow30d={flow30d}
							isLoadingFlows={isLoadingFlowSummary}
							isFlowUnavailable={isFlowSummaryError && !flowSummary}
						/>
					</Card>
				</div>
			</SummaryCardGrid>

			<div className="grid gap-2 lg:grid-cols-2">
				{/* Left Column */}
				<div className="flex flex-col gap-2">
					{/* Token Properties */}
					<SectionCard title="Token Properties">
						<div className="grid grid-cols-2 gap-2">
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.category.description}
									className="cursor-help text-secondary underline decoration-dotted"
									tabIndex={0}
								>
									{definitions.category.label}
								</Tooltip>
								{categories.length > 0 ? (
									<span className="flex flex-wrap items-center gap-1 font-medium">
										{categories.map((category, idx) => (
											<span key={category} className="flex items-center gap-0.5">
												<BasicLink href={`/rwa/category/${rwaSlug(category)}`} className="text-link hover:underline">
													{category}
												</BasicLink>
												{definitions.category.values?.[category] ? (
													<QuestionHelper text={definitions.category.values[category]} />
												) : null}
												{idx < categories.length - 1 ? ',' : null}
											</span>
										))}
									</span>
								) : (
									<span className="font-medium">-</span>
								)}
							</Card>
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.assetClass.description}
									className="cursor-help text-secondary underline decoration-dotted"
									tabIndex={0}
								>
									{definitions.assetClass.label}
								</Tooltip>
								{assetClasses.length > 0 ? (
									<span className="flex flex-wrap items-center gap-1 font-medium">
										{assetClasses.map((ac, idx) => (
											<span key={ac} className="flex items-center gap-0.5">
												{ac}
												{asset.assetClassDescriptions?.[ac] ? (
													<QuestionHelper text={asset.assetClassDescriptions[ac]} />
												) : null}
												{idx < assetClasses.length - 1 ? ',' : null}
											</span>
										))}
									</span>
								) : (
									<span className="font-medium">-</span>
								)}
							</Card>
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.type.description}
									className="cursor-help text-secondary underline decoration-dotted"
									tabIndex={0}
								>
									{definitions.type.label}
								</Tooltip>
								<span className="font-medium">{asset.type || '-'}</span>
							</Card>
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.rwaClassification.description}
									className="cursor-help text-secondary underline decoration-dotted"
									tabIndex={0}
								>
									{definitions.rwaClassification.label}
								</Tooltip>
								<span className={`flex items-center gap-1 font-medium ${asset.trueRWA ? 'text-success' : ''}`}>
									{asset.rwaClassification || '-'}
									{asset.rwaClassificationDescription ? (
										<QuestionHelper text={asset.rwaClassificationDescription} />
									) : null}
								</span>
							</Card>
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.accessModel.description}
									className="cursor-help text-secondary underline decoration-dotted"
									tabIndex={0}
								>
									{definitions.accessModel.label}
								</Tooltip>
								<span className="flex items-center gap-1 font-medium">
									{asset.accessModel || '-'}
									{asset.accessModelDescription ? <QuestionHelper text={asset.accessModelDescription} /> : null}
								</span>
							</Card>
							{hasParentPlatformName ? (
								<Card padding="sm" className="flex flex-col gap-1">
									<span className="text-secondary">Parent Platform</span>
									<span className="flex flex-wrap items-center gap-x-1 font-medium">
										{parentPlatforms.map((platform, idx) => (
											<span key={platform} className="flex items-center gap-0.5">
												{parentPlatformHref ? (
													<BasicLink href={parentPlatformHref} className="text-link hover:underline">
														{platform}
													</BasicLink>
												) : (
													platform
												)}
												{idx < parentPlatforms.length - 1 ? ',' : null}
											</span>
										))}
									</span>
								</Card>
							) : null}
						</div>
					</SectionCard>

					{/* Classification Flags */}
					<SectionCard title="Classification">
						<div className="grid grid-cols-2 gap-2">
							<ClassificationItem
								label={definitions.redeemable.label}
								positive={asset.redeemable}
								description={definitions.redeemable.description}
							/>
							<KYCItem
								label={definitions.kycForMintRedeem.label}
								required={asset.kycForMintRedeem ?? null}
								description={definitions.kycForMintRedeem.description}
							/>
							<KYCItem
								label={definitions.kycAllowlistedWhitelistedToTransferHold.label}
								required={asset.kycAllowlistedWhitelistedToTransferHold ?? null}
								description={definitions.kycAllowlistedWhitelistedToTransferHold.description}
							/>
							<ClassificationItem
								label={definitions.transferable.label}
								positive={asset.transferable}
								description={definitions.transferable.description}
							/>
							<ClassificationItem
								label={definitions.selfCustody.label}
								positive={asset.selfCustody}
								description={definitions.selfCustody.description}
							/>
							<ClassificationItem
								label={definitions.cexListed.label}
								positive={asset.cexListed}
								description={definitions.cexListed.description}
							/>
							<ClassificationItem
								label={definitions.attestations.label}
								positive={asset.attestations}
								description={definitions.attestations.description}
							/>
						</div>
					</SectionCard>
				</div>

				{/* Right Column */}
				<div className="flex flex-col gap-2">
					{/* Asset Information */}
					<SectionCard title="Asset Information">
						<div className="flex flex-col gap-3">
							<p className="flex flex-col gap-1">
								<Tooltip
									content={definitions.issuer.description}
									className="cursor-help text-secondary underline decoration-dotted"
									tabIndex={0}
								>
									{definitions.issuer.label}
								</Tooltip>
								<span className="font-medium">{asset.issuer || '-'}</span>
							</p>
							{asset.isin ? (
								<p className="flex flex-col gap-1">
									<Tooltip
										content={definitions.isin.description}
										className="cursor-help text-secondary underline decoration-dotted"
										tabIndex={0}
									>
										{definitions.isin.label}
									</Tooltip>
									<span className="mono-md">{asset.isin}</span>
								</p>
							) : null}
							{asset.issuerRegistryInfo && asset.issuerRegistryInfo.length > 0 ? (
								<p className="flex flex-col gap-1">
									<Tooltip
										content={definitions.registryInformation.description}
										className="cursor-help text-secondary underline decoration-dotted"
										tabIndex={0}
									>
										{definitions.registryInformation.label}
									</Tooltip>
									<span className="font-medium">{asset.issuerRegistryInfo.join('; ')}</span>
								</p>
							) : null}
							{asset.issuerSourceLink ? (
								<p className="flex flex-col gap-1">
									<Tooltip
										content={definitions.source.description}
										className="cursor-help text-secondary underline decoration-dotted"
										tabIndex={0}
									>
										{definitions.source.label}
									</Tooltip>
									{asset.issuerSourceLink.map((link) => (
										<a
											key={link}
											href={link}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1 font-medium break-all text-link hover:underline"
										>
											<Icon name="external-link" className="size-4 shrink-0" />
											{link}
										</a>
									))}
								</p>
							) : null}
							<div className="flex flex-wrap gap-3">
								{asset.website ? (
									asset.website.length > 1 ? (
										<Menu
											name="Website"
											options={asset.website}
											isExternal
											getItemAttributes={(url) => ({
												'data-umami-event': 'rwa-asset-website-click',
												'data-umami-event-asset': displayName,
												'data-umami-event-placement': 'info',
												'data-umami-event-url': url
											})}
										/>
									) : (
										<ExternalLinkButton
											key={asset.website[0]}
											href={asset.website[0]}
											icon="globe"
											data-umami-event="rwa-asset-website-click"
											data-umami-event-asset={displayName}
											data-umami-event-placement="info"
											data-umami-event-url={asset.website[0]}
										>
											Website
										</ExternalLinkButton>
									)
								) : null}
								{asset.twitter ? (
									asset.twitter.length > 1 ? (
										<Menu name="Twitter" options={asset.twitter} isExternal />
									) : (
										<ExternalLinkButton key={asset.twitter[0]} href={asset.twitter[0]} icon="twitter">
											X/Twitter
										</ExternalLinkButton>
									)
								) : null}
								{asset.protocolLinks.map((protocol) => (
									<Button as={BasicLink} key={protocol.slug} href={`/protocol/${protocol.slug}`} size="md">
										<span>{protocol.name}</span>
									</Button>
								))}
								{asset.linkedin ? (
									<ExternalLinkButton href={asset.linkedin} icon="linkedin">
										LinkedIn
									</ExternalLinkButton>
								) : null}
								{asset.docs ? (
									<ExternalLinkButton href={asset.docs} icon="file-text">
										Docs
									</ExternalLinkButton>
								) : null}
								{asset.rwaGithub != null ? (
									<ExternalLinkButton href={asset.rwaGithub} icon="github">
										GitHub
									</ExternalLinkButton>
								) : null}
								{asset.discord != null ? (
									<ExternalLinkButton href={asset.discord} icon="discord">
										Discord
									</ExternalLinkButton>
								) : null}
								{asset.telegram != null ? (
									<ExternalLinkButton href={asset.telegram} icon="telegram">
										Telegram
									</ExternalLinkButton>
								) : null}
							</div>
						</div>
					</SectionCard>

					{/* Oracle Metadata */}
					{asset.oracleProvider != null || asset.oracleProofLink != null ? (
						<SectionCard title="Oracle">
							<p className="flex flex-wrap items-center gap-2">
								<span className="label-md text-secondary">Provider:</span>
								<span className="font-medium">{asset.oracleProvider ?? '-'}</span>
								{asset.oracleProofLink != null ? (
									<ExternalLinkButton href={asset.oracleProofLink}>View proof</ExternalLinkButton>
								) : null}
							</p>
						</SectionCard>
					) : null}

					{/* Attestations */}
					{attestationLinks.length > 0 || asset.dateOfLastAttestation != null || attestationFrequency != null ? (
						<SectionCard
							title={
								<Tooltip
									content={definitions.attestations.description}
									className="cursor-help underline decoration-dotted"
									tabIndex={0}
								>
									Attestations
								</Tooltip>
							}
						>
							<div className="flex flex-col gap-3">
								{asset.dateOfLastAttestation != null ? (
									<p className="flex flex-wrap items-center gap-2">
										<span className="label-md text-secondary">Date of Last Attestation:</span>
										<span className="font-medium">{asset.dateOfLastAttestation}</span>
									</p>
								) : null}
								{attestationFrequency != null ? (
									<p className="flex flex-wrap items-center gap-2">
										<span className="label-md text-secondary">Attestation Frequency:</span>
										<span className="font-medium">{attestationFrequency}</span>
									</p>
								) : null}
								{attestationLinks.length > 0 ? (
									<p className="flex flex-wrap items-center gap-2">
										<span className="label-md text-secondary">Reports:</span>
										{attestationLinks.length > 1 ? (
											<Menu name="View reports" options={attestationLinks} isExternal />
										) : (
											<ExternalLinkButton href={attestationLinks[0]}>View report</ExternalLinkButton>
										)}
									</p>
								) : null}
							</div>
						</SectionCard>
					) : null}
				</div>
			</div>

			{/* Description Notes */}
			{asset.descriptionNotes ? (
				<SectionCard title="Notes">
					<ul className="flex list-disc flex-col gap-2 pl-5 body-md text-primary">
						{asset.descriptionNotes.map((note, idx) => (
							// oxlint-disable-next-line react/no-array-index-key -- Notes are read-only prose without IDs; identical notes are valid.
							<li key={`${keyBase}-note-${idx}`}>{note}</li>
						))}
					</ul>
				</SectionCard>
			) : null}

			{asset.nativeYieldPoolId && (isLoadingYieldChart || nativeYieldDataset) ? (
				<Panel className="overflow-hidden">
					<div
						className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--series) to-transparent"
						style={{ '--series': NATIVE_YIELD_CHARTS[0].color } as CSSProperties}
					/>
					<ChartPanelToolbar
						className="items-start"
						leading={
							// A headline stat like the summary cards': a secondary label over the mono-xl value.
							asset.nativeYieldCurrent != null ? (
								<StatItem
									label="Native Yield"
									labelAs="h2"
									value={formatPercent(asset.nativeYieldCurrent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)}
								/>
							) : (
								<ChartPanelTitle headingAs="h2">Native Yield</ChartPanelTitle>
							)
						}
					>
						<ChartExportButtons
							chartInstance={nativeYieldChartInstance}
							filename={nativeYieldExportFilename}
							title={nativeYieldExportTitle}
							csvSource={nativeYieldDataset ? { type: 'dataset', prepare: () => nativeYieldDataset } : null}
						/>
					</ChartPanelToolbar>

					{isLoadingYieldChart ? (
						<SurfaceBodyLoadingStatus label="Loading chart" className="flex-1" />
					) : (
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="flex-1" />}>
							<MultiSeriesChart
								charts={NATIVE_YIELD_CHARTS}
								dataset={nativeYieldDataset ?? { source: [], dimensions: [] }}
								valueSymbol="%"
								showLegend
								exportButtons="hidden"
								onReady={onNativeYieldChartReady}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}

					{asset.issuer ? <p className="px-2 pb-2 body-sm text-secondary">Historical APY from {asset.issuer}</p> : null}
				</Panel>
			) : null}

			{displayPools.length > 0 ? (
				<SectionCard title={`DeFi Yield Opportunities (${displayPools.length})`}>
					<PaginatedYieldsPoolTable
						data={displayPools}
						initialPageSize={10}
						appearance="embedded"
						defaultColumns={defaultColumns}
					/>
				</SectionCard>
			) : null}

			{/* Chain Availability (moved to last) */}
			{asset.chain && asset.chain.length > 0 ? (
				<SectionCard title="Chains">
					<div className="mt-1 grid grid-cols-2 gap-1.5 xl:grid-cols-3 2xl:grid-cols-4">
						{asset.chain.map((chain) => (
							<ChainBadge
								key={chain}
								chain={chain}
								isPrimary={chain === asset.primaryChain}
								{...(asset.contracts?.[chain] ? { contracts: asset.contracts[chain] } : {})}
								{...(asset.contractUrls?.[chain] ? { contractUrls: asset.contractUrls[chain] } : {})}
							/>
						))}
					</div>
				</SectionCard>
			) : null}
		</div>
	)
}

const NATIVE_YIELD_CHARTS = [
	{
		type: 'line' as const,
		name: 'Native Yield',
		encode: { x: 'timestamp', y: 'Native Yield' },
		color: CHART_COLORS[6],
		valueSymbol: '%'
	}
]

const BASE_TIME_SERIES_CHARTS: Array<{
	type: 'line' | 'bar'
	name: string
	encode: { x: number | Array<number> | string | Array<string>; y: number | Array<number> | string | Array<string> }
	color?: string
}> = [
	{
		type: 'line',
		name: 'DeFi Active TVL',
		encode: { x: 'timestamp', y: 'DeFi Active TVL' },
		color: CHART_COLORS[0]
	},
	{
		type: 'line',
		name: 'Active AUM',
		encode: { x: 'timestamp', y: 'Active AUM' },
		color: CHART_COLORS[1]
	},
	{
		type: 'line',
		name: 'Onchain AUM',
		encode: { x: 'timestamp', y: 'Onchain AUM' },
		color: CHART_COLORS[2]
	}
]
