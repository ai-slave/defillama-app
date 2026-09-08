import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { PaginatedYieldsPoolTable } from '~/containers/Yields/Tables/Pools'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { CopyHelper } from '~/ui/Copy'
import { HeroMetric } from '~/ui/HeroMetric'
import { Icon } from '~/ui/Icon'
import { KeyMetricsHeader } from '~/ui/KeyMetricsCard'
import { LoadingDots } from '~/ui/Loaders'
import { MetricRow, MetricSection, SubMetricRow, SubMetricSection } from '~/ui/MetricPrimitives'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Switch } from '~/ui/Switch'
import { Tooltip } from '~/ui/Tooltip'
import { truncateAddress } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
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
	formatSignedRWAFlow,
	getRWAFlowModeQueryValue,
	getRWAFlowTextClass,
	getRWAFlowVsPriceSummary,
	parseRWAFlowQueryState,
	RWA_FLOW_GROUPING_OPTIONS,
	type RWAFlowChartSelection,
	type RWAFlowGrouping,
	type RWAFlowVisibleRange
} from './flows'
import { useRWAAssetFlows, useRWAFlowSummary } from './flows.hooks'
import { getRwaPlatforms } from './grouping'
import { rwaSlug } from './rwaSlug'
import { RWASuspiciousWarning } from './SuspiciousWarning'
import { useNativeYieldHistory } from './useNativeYieldChart'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const RWAFlowsChart = lazy(() => import('./FlowsChart').then((module) => ({ default: module.RWAFlowsChart })))
const assetHeaderLinkButtonStyles = buttonStyles({ variant: 'secondary', size: 'md' })
const formatCompactUsd = (value: number) =>
	formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })

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
						? 'border-success/30 bg-success/10'
						: 'border-red-600/30 bg-red-600/10'
					: 'border-subtle bg-surface'
			}`}
		>
			<p className="flex flex-col gap-1">
				<span
					className={`font-medium ${
						isBoolean ? (positive ? 'text-success' : 'text-error dark:text-error') : 'text-secondary'
					}`}
				>
					{label}
				</span>
				{description ? <span className="body-sm text-secondary">{description}</span> : null}
			</p>
			{isBoolean ? (
				<Icon
					name={positive ? 'check-circle' : 'x'}
					className={`size-5 shrink-0 ${positive ? 'text-success' : 'text-error dark:text-error'}`}
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
				required ? 'border-amber-600/30 bg-amber-600/10' : 'border-success/30 bg-success/10'
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
				value={asset.onChainMcap?.total != null ? formatCompactUsd(asset.onChainMcap.total) : '-'}
				{...(asset.onChainMcap?.breakdown
					? { byChain: asset.onChainMcap.breakdown.map(([chain, v]) => [chain, formatCompactUsd(v)]) }
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
		<div className="flex flex-col gap-2">
			<KeyMetricsHeader />
			<div className="flex flex-col">
				{activeMcap?.breakdown != null && activeMcap.breakdown.length > 0 ? (
					<MetricSection
						label={definitions.activeMcap.label}
						tooltip={definitions.activeMcap.description}
						value={formatUsd(activeMcap.total, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					>
						{activeMcap.breakdown.map(([chain, value]) => (
							<SubMetricRow
								key={chain}
								label={chain}
								value={formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							/>
						))}
					</MetricSection>
				) : (
					<MetricRow
						label={definitions.activeMcap.label}
						tooltip={definitions.activeMcap.description}
						value={
							activeMcap?.total != null
								? formatUsd(activeMcap.total, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})
								: '-'
						}
					/>
				)}
				{asset.defiActiveTvlByProtocolChain != null && asset.defiActiveTvlByProtocolChain.length > 0 ? (
					<MetricSection
						label={definitions.defiActiveTvl.label}
						tooltip={definitions.defiActiveTvl.description}
						value={formatUsd(defiActiveTvl?.total ?? 0, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					>
						{asset.defiActiveTvlByProtocolChain.map((row) => (
							<SubMetricSection
								key={row.protocol}
								label={row.protocol}
								value={formatUsd(row.total, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							>
								{row.byChain.map(([chain, value]) => (
									<SubMetricRow
										key={chain}
										label={chain}
										value={formatUsd(value, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
									/>
								))}
							</SubMetricSection>
						))}
					</MetricSection>
				) : (
					<MetricRow
						label={definitions.defiActiveTvl.label}
						tooltip={definitions.defiActiveTvl.description}
						value={formatUsd(defiActiveTvl?.total ?? 0, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
				)}
				<MetricRow
					label={definitions.flows.assetNetFlow7d.label}
					tooltip={
						<RWAFlowSummaryTooltip description={definitions.flows.assetNetFlow7d.description} summary={flow7d} />
					}
					value={
						isLoadingFlows ? (
							<RWAFlowValueShimmer />
						) : isFlowUnavailable ? (
							<RWAFlowValueUnavailable />
						) : (
							formatSignedRWAFlow(flow7d?.flow)
						)
					}
					valueClassName={`mono-md-bold ml-auto ${getRWAFlowTextClass(flow7d?.flow)}`}
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
						) : (
							formatSignedRWAFlow(flow30d?.flow)
						)
					}
					valueClassName={`mono-md-bold ml-auto ${getRWAFlowTextClass(flow30d?.flow)}`}
				/>
				{asset.price != null ? (
					<MetricRow
						label={`${asset.ticker ?? 'Token'} Price`}
						value={formatUsd(asset.price, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
				) : null}
				<MetricRow label="Chains" value={asset.chain?.length ?? 0} />
				{asset.nativeYieldCurrent != null ? (
					<MetricRow
						label="Native Yield"
						value={`${formatPercent(asset.nativeYieldCurrent, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`}
					/>
				) : null}
			</div>
		</div>
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
			<img src={chainIconUrl(chain)} alt={chain} className="mt-0.5 size-5 rounded-full" loading="lazy" />
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

export function RWAAssetPage({ asset }: { asset: IRWAAssetData }) {
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
	const { data: assetFlows, isLoading: isLoadingFlows, error: flowError } = useRWAAssetFlows(asset.id, isFlowChart)
	const [flowVisibleRange, setFlowVisibleRange] = useState<RWAFlowVisibleRange | null>(null)
	const handleFlowVisibleRangeChange = useCallback((range: RWAFlowVisibleRange | null) => {
		setFlowVisibleRange((previous) => {
			const sameStart = previous?.start === range?.start
			const sameEnd = previous?.end === range?.end
			return sameStart && sameEnd ? previous : range
		})
	}, [])

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

	const displayPools = asset.yieldPools ?? []

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
	const flowVsPriceSummary = useMemo(
		() => (chartMetric === 'flowVsPrice' && flowChart ? getRWAFlowVsPriceSummary(flowChart, flowVisibleRange) : null),
		[chartMetric, flowChart, flowVisibleRange]
	)

	const attestationLinks = asset.attestationLinks ?? []

	return (
		<div className="flex flex-col gap-2">
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<Card padding="sm" className="col-span-1 hidden flex-col gap-6 xl:flex xl:min-h-[360px]">
					<AssetHeader asset={asset} displayName={displayName} headingAs="h1" />
					<AssetKeyMetrics
						asset={asset}
						flow7d={flow7d}
						flow30d={flow30d}
						isLoadingFlows={isLoadingFlowSummary}
						isFlowUnavailable={isFlowSummaryError && !flowSummary}
					/>
				</Card>
				<div className="col-span-1 flex flex-col gap-2 xl:col-[2/-1]">
					<Card padding="sm" className="flex flex-col gap-6 xl:hidden">
						<AssetHeader asset={asset} displayName={displayName} headingAs="div" />
					</Card>
					<ChartPanel>
						<ChartPanelToolbar className="justify-end">
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
							isLoadingFlows ? (
								<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
									Loading
									<LoadingDots />
								</ChartPanelBodyFallback>
							) : flowError ? (
								<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
									{flowError instanceof Error ? flowError.message : 'Failed to load flow data.'}
								</ChartPanelBodyFallback>
							) : flowChart ? (
								<Suspense fallback={<ChartPanelBodyFallback />}>
									<RWAFlowsChart
										chart={flowChart}
										onVisibleRangeChange={handleFlowVisibleRangeChange}
										onReady={onAssetChartReady}
									/>
								</Suspense>
							) : (
								<ChartPanelBodyFallback className="body-sm text-secondary">
									No flow data available.
								</ChartPanelBodyFallback>
							)
						) : assetChartDataset ? (
							<Suspense fallback={<ChartPanelExportShellFallback />}>
								<MultiSeriesChart
									charts={timeSeriesCharts}
									dataset={assetChartDataset}
									hideDefaultLegend={false}
									exportButtons="hidden"
									onReady={onAssetChartReady}
								/>
							</Suspense>
						) : (
							<ChartPanelBodyFallback className="body-sm text-secondary">
								No market data available.
							</ChartPanelBodyFallback>
						)}
					</ChartPanel>
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
			</div>

			<div className="grid gap-2 lg:grid-cols-2">
				{/* Left Column */}
				<div className="flex flex-col gap-2">
					{/* Token Properties */}
					<SectionCard title="Token Properties">
						<div className="grid grid-cols-2 gap-2">
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.category.description}
									className="text-secondary underline decoration-dotted"
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
									className="text-secondary underline decoration-dotted"
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
								<Tooltip content={definitions.type.description} className="text-secondary underline decoration-dotted">
									{definitions.type.label}
								</Tooltip>
								<span className="font-medium">{asset.type || '-'}</span>
							</Card>
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.rwaClassification.description}
									className="text-secondary underline decoration-dotted"
								>
									{definitions.rwaClassification.label}
								</Tooltip>
								<span className={`flex items-center gap-1 font-medium ${asset.trueRWA ? 'text-data-up' : ''}`}>
									{asset.rwaClassification || '-'}
									{asset.rwaClassificationDescription ? (
										<QuestionHelper text={asset.rwaClassificationDescription} />
									) : null}
								</span>
							</Card>
							<Card padding="sm" className="flex flex-col gap-1">
								<Tooltip
									content={definitions.accessModel.description}
									className="text-secondary underline decoration-dotted"
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
											<span key={`${platform}-${idx}`} className="flex items-center gap-0.5">
												<BasicLink href={`/rwa/platform/${rwaSlug(platform)}`} className="text-link hover:underline">
													{platform}
												</BasicLink>
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
									className="text-secondary underline decoration-dotted"
								>
									{definitions.issuer.label}
								</Tooltip>
								<span className="font-medium">{asset.issuer || '-'}</span>
							</p>
							{asset.isin ? (
								<p className="flex flex-col gap-1">
									<Tooltip
										content={definitions.isin.description}
										className="text-secondary underline decoration-dotted"
									>
										{definitions.isin.label}
									</Tooltip>
									<span className="font-mono font-medium">{asset.isin}</span>
								</p>
							) : null}
							{asset.issuerRegistryInfo && asset.issuerRegistryInfo.length > 0 ? (
								<p className="flex flex-col gap-1">
									<Tooltip
										content={definitions.registryInformation.description}
										className="text-secondary underline decoration-dotted"
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
										className="text-secondary underline decoration-dotted"
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
											className={assetHeaderLinkButtonStyles}
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
										<Menu name="Twitter" options={asset.twitter} isExternal className={assetHeaderLinkButtonStyles} />
									) : (
										<ExternalLinkButton key={asset.twitter[0]} href={asset.twitter[0]} icon="twitter">
											Twitter
										</ExternalLinkButton>
									)
								) : null}
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
								<Tooltip content={definitions.attestations.description} className="underline decoration-dotted">
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
											<Menu
												name="View reports"
												options={attestationLinks}
												isExternal
												className={assetHeaderLinkButtonStyles}
											/>
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
							<li key={`${keyBase}-note-${idx}-${note.slice(0, 50)}`}>{note}</li>
						))}
					</ul>
				</SectionCard>
			) : null}

			{(asset.nativeYieldPoolId && (isLoadingYieldChart || nativeYieldDataset)) || displayPools.length > 0 ? (
				<div
					className={`grid gap-2 ${(isLoadingYieldChart || nativeYieldDataset) && displayPools.length > 0 ? 'lg:grid-cols-2' : ''}`}
				>
					{asset.nativeYieldPoolId && (isLoadingYieldChart || nativeYieldDataset) ? (
						<ChartPanel className="overflow-hidden">
							<div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#cc3e82] to-transparent" />
							<ChartPanelToolbar className="items-start">
								<p className="mr-auto flex flex-col">
									<span className="label-sm text-secondary uppercase">Native Yield</span>
									{asset.nativeYieldCurrent != null ? (
										<span className="font-jetbrains text-3xl font-bold tracking-tight text-[#cc3e82]">
											{formatPercent(asset.nativeYieldCurrent, {
												input: 'percent',
												minimumFractionDigits: 2,
												maximumFractionDigits: 2,
												useGrouping: false
											})}
										</span>
									) : null}
								</p>
								<ChartExportButtons
									chartInstance={nativeYieldChartInstance}
									filename={nativeYieldExportFilename}
									title={nativeYieldExportTitle}
									csvSource={nativeYieldDataset ? { type: 'dataset', prepare: () => nativeYieldDataset } : null}
								/>
							</ChartPanelToolbar>

							{isLoadingYieldChart ? (
								<ChartPanelBodyFallback role="status" aria-live="polite" className="flex-1 gap-1 body-sm text-tertiary">
									Loading
									<LoadingDots />
								</ChartPanelBodyFallback>
							) : (
								<Suspense fallback={<ChartPanelBodyFallback className="flex-1" />}>
									<MultiSeriesChart
										charts={NATIVE_YIELD_CHARTS}
										dataset={nativeYieldDataset ?? { source: [], dimensions: [] }}
										valueSymbol="%"
										hideDefaultLegend={false}
										exportButtons="hidden"
										onReady={onNativeYieldChartReady}
										containerClassName="flex-1 min-h-[360px]"
									/>
								</Suspense>
							)}

							{asset.issuer ? (
								<p className="px-2 pb-2 body-sm text-secondary">Historical APY from {asset.issuer}</p>
							) : null}
						</ChartPanel>
					) : null}
				</div>
			) : null}

			{displayPools.length > 0 ? (
				<SectionCard title={`DeFi Yield Opportunities (${displayPools.length})`}>
					<PaginatedYieldsPoolTable data={displayPools} initialPageSize={10} appearance="embedded" />
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
		color: '#cc3e82',
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
		name: 'Active Mcap',
		encode: { x: 'timestamp', y: 'Active Mcap' },
		color: CHART_COLORS[1]
	},
	{
		type: 'line',
		name: 'Onchain Mcap',
		encode: { x: 'timestamp', y: 'Onchain Mcap' },
		color: CHART_COLORS[2]
	}
]
