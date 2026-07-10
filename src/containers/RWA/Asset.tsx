import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { CopyHelper } from '~/components/Copy'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { LoadingDots } from '~/components/Loaders'
import { Menu } from '~/components/Menu'
import { MetricRow, MetricSection, SubMetricRow, SubMetricSection } from '~/components/MetricPrimitives'
import { QuestionHelper } from '~/components/QuestionHelper'
import { SegmentedControl } from '~/components/SegmentedControl'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/components/Tooltip'
import { CHART_COLORS } from '~/constants/colors'
import { useYieldChartData } from '~/containers/Yields/queries.client'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { tooltipSurfaceStyles } from '~/ui/Popover'
import { Switch } from '~/ui/Switch'
import { formattedNum, truncateAddress } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { IRWAAssetData, IRWAFlowSummary } from './api.types'
import { definitions } from './definitions'
import { RWAFlowCoverageTag, RWAFlowVsPriceStrip } from './FlowPanelParts'
import {
	formatSignedRWAFlow,
	getRWAFlowTextClass,
	getRWAFlowVsPriceSummary,
	parseRWAFlowMode,
	RWA_FLOW_MODE_OPTIONS,
	type RWAFlowChartMode
} from './flows'
import { useRWAAssetFlows, useRWAFlowSummary } from './flows.hooks'
import { getRwaPlatforms } from './grouping'
import { rwaSlug } from './rwaSlug'
import { RWAYieldsTable } from './RWAYieldsTable'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))
const RWAFlowsChart = lazy(() => import('./FlowsChart').then((module) => ({ default: module.RWAFlowsChart })))
const assetHeaderLinkButtonStyles = buttonStyles({ variant: 'secondary', size: 'md' })

type AssetChartMetric = 'marketData' | 'flows'

const ASSET_CHART_METRIC_OPTIONS = [
	{ value: 'marketData' as const, label: 'Market data' },
	{ value: 'flows' as const, label: 'Net Flows' }
]

interface ClassificationItemProps {
	label: string
	value?: string | null
	positive?: boolean | null | undefined
	description?: string
}

const ClassificationItem = ({ label, value, positive, description }: ClassificationItemProps) => {
	if (value == null && positive == null) return null

	const isBoolean = positive != null
	const displayValue = isBoolean ? (positive ? 'Yes' : 'No') : value

	return (
		<div
			className={`flex items-start justify-between gap-2 rounded-md border p-2 ${
				isBoolean
					? positive
						? 'border-green-600/30 bg-green-600/10'
						: 'border-red-600/30 bg-red-600/10'
					: 'border-subtle bg-surface'
			}`}
		>
			<p className="flex flex-col gap-1">
				<span
					className={`font-medium ${
						isBoolean
							? positive
								? 'text-green-700 dark:text-green-400'
								: 'text-red-700 dark:text-red-400'
							: 'text-secondary'
					}`}
				>
					{label}
				</span>
				{description ? <span className="body-sm text-secondary">{description}</span> : null}
			</p>
			{isBoolean ? (
				<Icon
					name={positive ? 'check-circle' : 'x'}
					className={`size-5 shrink-0 ${positive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
				/>
			) : (
				<span className="font-medium">{displayValue}</span>
			)}
		</div>
	)
}

// KYC items: true = warning (amber), false = green (no KYC required is good)
const KYCItem = ({
	label,
	required,
	description
}: {
	label: string
	required: boolean | null
	description?: string
}) => {
	if (required == null) return null

	return (
		<div
			className={`flex items-start justify-between gap-2 rounded-md border p-2 ${
				required ? 'border-amber-600/30 bg-amber-600/10' : 'border-green-600/30 bg-green-600/10'
			}`}
		>
			<p className="flex flex-col gap-1">
				<span
					className={`font-medium ${required ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}
				>
					{label}
				</span>
				{description ? <span className="body-sm text-secondary">{description}</span> : null}
			</p>
			<Icon
				name={required ? 'alert-triangle' : 'check-circle'}
				className={`size-5 shrink-0 ${required ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}
			/>
		</div>
	)
}

const SectionCard = ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
	<Card as="section" padding="sm" className="flex flex-col gap-3">
		<h2 className="heading-xs">{title}</h2>
		{children}
	</Card>
)

/** Hero stat mirroring the protocol page's PrimaryValue: big value expanding to per-chain rows. */
const AssetPrimaryValue = ({
	label,
	tooltip,
	total,
	byChain
}: {
	label: string
	tooltip?: string
	total: number | null | undefined
	byChain?: Array<[string, number]> | null
}) => {
	const value = (
		<span className="min-h-8 font-jetbrains text-2xl font-semibold">
			{total != null ? formattedNum(total, true) : '-'}
		</span>
	)

	if (!byChain || byChain.length === 0) {
		return (
			<p className="flex flex-col">
				{tooltip ? (
					<Tooltip content={tooltip} className="text-secondary underline decoration-dotted">
						{label}
					</Tooltip>
				) : (
					<span className="text-secondary">{label}</span>
				)}
				{value}
			</p>
		)
	}

	const summaryContent = (
		<>
			<span className={`text-secondary ${tooltip ? 'underline decoration-dotted' : ''}`.trim()}>{label}</span>
			<span className="flex flex-nowrap items-center gap-2">
				{value}
				<Icon
					name="chevron-down"
					height={16}
					width={16}
					className="relative top-0.5 text-tertiary transition-transform duration-100 group-open:rotate-180"
				/>
			</span>
		</>
	)

	return (
		<details className="group">
			{tooltip ? (
				/* A <summary> must not contain interactive descendants, so the summary
				   itself anchors the tooltip (same trick as MetricSection). */
				<Ariakit.TooltipProvider placement="top-start">
					<Ariakit.TooltipAnchor render={<summary className="flex cursor-pointer flex-col" />}>
						{summaryContent}
					</Ariakit.TooltipAnchor>
					<Ariakit.Tooltip className={`${tooltipSurfaceStyles} max-w-56 whitespace-pre-wrap`} unmountOnHide portal>
						<div className="p-2">{tooltip}</div>
					</Ariakit.Tooltip>
				</Ariakit.TooltipProvider>
			) : (
				<summary className="flex cursor-pointer flex-col">{summaryContent}</summary>
			)}
			<div className="my-3 flex max-h-[50dvh] flex-col overflow-auto">
				<h2 className="font-semibold">{label} by chain</h2>
				{byChain.map(([chain, chainValue]) => (
					<p
						key={chain}
						className="flex items-center justify-between gap-1 border-b border-dashed border-subtle py-1 last:border-none"
					>
						<span className="text-secondary">{chain}</span>
						<span className="font-jetbrains">{formattedNum(chainValue, true)}</span>
					</p>
				))}
			</div>
		</details>
	)
}

const AssetHeader = ({
	asset,
	displayName,
	headingAs: Tag = 'h1'
}: {
	asset: IRWAAssetData
	displayName: string
	headingAs?: 'h1' | 'div'
}) => {
	const websiteUrl = asset.website?.[0]

	return (
		<>
			<Tag className="flex flex-wrap items-center gap-2 heading-sm">
				{asset.logo ? <TokenLogo src={asset.logo} size={24} /> : null}
				<span>{displayName}</span>
				{asset.ticker ? <span className="font-normal text-tertiary">({asset.ticker})</span> : null}
				{websiteUrl ? (
					<span className="-m-2 ml-auto flex items-center justify-end gap-1">
						<a
							href={websiteUrl}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={`${displayName} website`}
							className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
						>
							<Icon name="globe" width={16} height={16} className="shrink-0" />
						</a>
					</span>
				) : null}
			</Tag>
			<AssetPrimaryValue
				label={definitions.onChainMcap.label}
				tooltip={definitions.onChainMcap.description}
				total={asset.onChainMcap?.total}
				byChain={asset.onChainMcap?.breakdown}
			/>
		</>
	)
}

const AssetKeyMetrics = ({
	asset,
	flow7d,
	flow30d
}: {
	asset: IRWAAssetData
	flow7d: IRWAFlowSummary | undefined
	flow30d: IRWAFlowSummary | undefined
}) => {
	const activeMcap = asset.activeMcap ?? null
	const defiActiveTvl = asset.defiActiveTvl ?? null

	return (
		<div className="flex flex-col">
			<h2 className="mb-2 font-semibold">Key Metrics</h2>
			{activeMcap?.breakdown != null && activeMcap.breakdown.length > 0 ? (
				<MetricSection
					label={definitions.activeMcap.label}
					tooltip={definitions.activeMcap.description}
					value={formattedNum(activeMcap.total, true)}
				>
					{activeMcap.breakdown.map(([chain, value]) => (
						<SubMetricRow key={chain} label={chain} value={formattedNum(value, true)} />
					))}
				</MetricSection>
			) : (
				<MetricRow
					label={definitions.activeMcap.label}
					tooltip={definitions.activeMcap.description}
					value={activeMcap?.total != null ? formattedNum(activeMcap.total, true) : '-'}
				/>
			)}
			{asset.defiActiveTvlByProtocolChain != null && asset.defiActiveTvlByProtocolChain.length > 0 ? (
				<MetricSection
					label={definitions.defiActiveTvl.label}
					tooltip={definitions.defiActiveTvl.description}
					value={formattedNum(defiActiveTvl?.total ?? 0, true)}
				>
					{asset.defiActiveTvlByProtocolChain.map((row) => (
						<SubMetricSection key={row.protocol} label={row.protocol} value={formattedNum(row.total, true)}>
							{row.byChain.map(([chain, value]) => (
								<SubMetricRow key={chain} label={chain} value={formattedNum(value, true)} />
							))}
						</SubMetricSection>
					))}
				</MetricSection>
			) : (
				<MetricRow
					label={definitions.defiActiveTvl.label}
					tooltip={definitions.defiActiveTvl.description}
					value={formattedNum(defiActiveTvl?.total ?? 0, true)}
				/>
			)}
			<MetricRow
				label="Net Flows 7d"
				value={formatSignedRWAFlow(flow7d?.flow)}
				valueClassName={`mono-md-bold ml-auto ${getRWAFlowTextClass(flow7d?.flow)}`}
			/>
			<MetricRow
				label="Net Flows 30d"
				value={formatSignedRWAFlow(flow30d?.flow)}
				valueClassName={`mono-md-bold ml-auto ${getRWAFlowTextClass(flow30d?.flow)}`}
			/>
			{asset.price != null ? (
				<MetricRow label={`${asset.ticker ?? 'Token'} Price`} value={formattedNum(asset.price, true)} />
			) : null}
			<MetricRow label="Chains" value={asset.chain?.length ?? 0} />
			{asset.nativeYieldCurrent != null ? (
				<MetricRow label="Native Yield" value={`${asset.nativeYieldCurrent.toFixed(2)}%`} />
			) : null}
		</div>
	)
}

const ContractItem = ({ address, explorerUrl }: { address: string; explorerUrl?: string }) => {
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

const ChainBadge = ({
	chain,
	isPrimary = false,
	showPrimaryStyle = true,
	contracts,
	contractUrls
}: {
	chain: string
	isPrimary?: boolean
	showPrimaryStyle?: boolean
	contracts?: string[]
	contractUrls?: Record<string, string>
}) => {
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
						{contracts.map((address) => (
							<ContractItem key={`${chain}-${address}`} address={address} explorerUrl={contractUrls?.[address]} />
						))}
					</>
				) : null}
			</div>
		</Card>
	)
}

export const RWAAssetPage = ({ asset }: { asset: IRWAAssetData }) => {
	const router = useRouter()
	const displayName = asset.assetName ?? asset.ticker ?? 'Unknown asset'
	const keyBase = asset.ticker ?? asset.assetName ?? 'asset'
	const chartMetric: AssetChartMetric =
		readSingleQueryValue(router.query.chartType) === 'flows' ? 'flows' : 'marketData'
	const flowMode = parseRWAFlowMode(readSingleQueryValue(router.query.flowMode), true)
	const showMcapOverlay = readSingleQueryValue(router.query.flowOverlay) !== 'false'
	const attestationFrequency = Array.isArray(asset.attestationFrequency)
		? asset.attestationFrequency.length > 0
			? asset.attestationFrequency.join('; ')
			: null
		: (asset.attestationFrequency ?? null)
	const parentPlatforms = getRwaPlatforms(asset.parentPlatform)
	let hasParentPlatformName = false
	if (typeof asset.parentPlatform === 'string') {
		hasParentPlatformName = asset.parentPlatform.trim().length > 0
	} else if (Array.isArray(asset.parentPlatform)) {
		for (const platform of asset.parentPlatform) {
			if (platform.trim()) {
				hasParentPlatformName = true
				break
			}
		}
	}

	const { data: yieldChartRaw, isLoading: isLoadingYieldChart } = useYieldChartData(asset.nativeYieldPoolId)
	const { chartInstance: nativeYieldChartInstance, handleChartReady: onNativeYieldChartReady } = useGetChartInstance()
	const { chartInstance: assetChartInstance, handleChartReady: onAssetChartReady } = useGetChartInstance()
	const { data: flowSummary } = useRWAFlowSummary()
	const {
		data: assetFlows,
		isLoading: isLoadingFlows,
		error: flowError
	} = useRWAAssetFlows(asset.id, chartMetric === 'flows')

	const nativeYieldExportFilename = `${asset.ticker ?? asset.assetName ?? 'asset'}-native-yield`
	const nativeYieldExportTitle = `${asset.ticker ?? asset.assetName ?? 'Asset'} Native Yield`
	const assetChartExportFilename = `${asset.ticker ?? asset.assetName ?? 'asset'}-${chartMetric === 'flows' ? 'flows' : 'market-data'}`
	const assetChartExportTitle = `${asset.ticker ?? asset.assetName ?? 'Asset'} ${chartMetric === 'flows' ? 'Net Flows' : 'Market Data'}`
	const flowSummaryKey = asset.canonicalMarketId ?? asset.slug
	const flow7d = flowSummary?.windows['7d'].asset[flowSummaryKey]
	const flow30d = flowSummary?.windows['30d'].asset[flowSummaryKey]
	const flowCoverage = assetFlows?.coverage ?? flow30d?.coverage ?? null

	const nativeYieldDataset = useMemo(() => {
		if (!yieldChartRaw?.data) return null
		const source: Array<{ timestamp: number; 'Native Yield': number }> = []
		for (const item of yieldChartRaw.data) {
			if (item.apyBase == null || !item.timestamp) continue
			const ts =
				typeof item.timestamp === 'number' ? item.timestamp : new Date(String(item.timestamp).split('T')[0]).getTime()
			// Yield chart timestamps can be ISO strings from a separate API; skip invalid date parses before charting.
			if (!Number.isFinite(ts)) continue
			source.push({ timestamp: Math.floor(ts), 'Native Yield': Math.round(item.apyBase * 100) / 100 })
		}
		return source.length > 0 ? { source, dimensions: ['timestamp', 'Native Yield'] } : null
	}, [yieldChartRaw])

	const isCompactYields = !!asset.nativeYieldPoolId
	const displayPools = useMemo(() => {
		if (!asset.yieldPools || asset.yieldPools.length === 0) return []
		const maxRows = isCompactYields ? 8 : asset.yieldPools.length
		return asset.yieldPools.slice(0, maxRows)
	}, [asset.yieldPools, isCompactYields])
	const yieldPoolsTotal = asset.yieldPoolsTotal ?? asset.yieldPools?.length ?? 0
	const hasMorePools = yieldPoolsTotal > displayPools.length

	const chartDimensions = (asset.chartDataset?.dimensions ?? []) as string[]
	const timeSeriesCharts =
		chartDimensions.length > 0
			? BASE_TIME_SERIES_CHARTS.filter((chart) => chartDimensions.includes(String(chart.encode.y)))
			: BASE_TIME_SERIES_CHARTS
	const flowVsPriceSummary = useMemo(
		() => (assetFlows ? getRWAFlowVsPriceSummary(assetFlows.data) : null),
		[assetFlows]
	)

	const attestationLinks = asset.attestationLinks ?? []

	return (
		<div className="flex flex-col gap-2">
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<Card padding="sm" className="col-span-1 hidden flex-col gap-6 xl:flex xl:min-h-[360px]">
					<AssetHeader asset={asset} displayName={displayName} headingAs="h1" />
					<AssetKeyMetrics asset={asset} flow7d={flow7d} flow30d={flow30d} />
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
										chartType: nextMetric === 'flows' ? 'flows' : undefined,
										flowMode: nextMetric === 'flows' && flowMode !== 'daily' ? flowMode : undefined,
										flowOverlay: nextMetric === 'flows' && !showMcapOverlay ? 'false' : undefined
									})
								}}
								options={ASSET_CHART_METRIC_OPTIONS}
								label="Chart metric"
								variant="default"
								size="md"
								className="mr-auto"
							/>
							{chartMetric === 'flows' ? (
								<SegmentedControl<RWAFlowChartMode>
									value={flowMode}
									onValueChange={(nextFlowMode) => {
										void pushShallowQuery(router, { flowMode: nextFlowMode === 'daily' ? undefined : nextFlowMode })
									}}
									options={RWA_FLOW_MODE_OPTIONS}
									label="Flow view"
									variant="default"
									size="md"
								/>
							) : null}
							{chartMetric === 'flows' && flowMode !== 'flowVsPrice' ? (
								<Switch
									label="Marketcap overlay"
									value="marketcap"
									checked={showMcapOverlay}
									onChange={(event) => {
										void pushShallowQuery(router, { flowOverlay: event.currentTarget.checked ? undefined : 'false' })
									}}
								/>
							) : null}
							{chartMetric === 'flows' && flowCoverage != null ? <RWAFlowCoverageTag coverage={flowCoverage} /> : null}
							<ChartExportButtons
								chartInstance={assetChartInstance}
								filename={assetChartExportFilename}
								title={assetChartExportTitle}
							/>
						</ChartPanelToolbar>
						{chartMetric === 'flows' && flowMode === 'flowVsPrice' && flowVsPriceSummary ? (
							<RWAFlowVsPriceStrip summary={flowVsPriceSummary} coverage={flowCoverage} />
						) : null}
						{chartMetric === 'flows' ? (
							isLoadingFlows ? (
								<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
									Loading
									<LoadingDots />
								</ChartPanelBodyFallback>
							) : flowError ? (
								<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
									{flowError instanceof Error ? flowError.message : 'Failed to load flow data.'}
								</ChartPanelBodyFallback>
							) : assetFlows ? (
								<Suspense fallback={<ChartPanelBodyFallback />}>
									<RWAFlowsChart
										points={assetFlows.data}
										mode={flowMode}
										showMcapOverlay={showMcapOverlay}
										onReady={onAssetChartReady}
									/>
								</Suspense>
							) : (
								<ChartPanelBodyFallback className="body-sm text-secondary">
									No flow data available.
								</ChartPanelBodyFallback>
							)
						) : asset.chartDataset ? (
							<Suspense fallback={<ChartPanelExportShellFallback />}>
								<MultiSeriesChart2
									charts={timeSeriesCharts}
									dataset={asset.chartDataset}
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
						<AssetKeyMetrics asset={asset} flow7d={flow7d} flow30d={flow30d} />
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
								{asset.category && asset.category.length > 0 ? (
									<span className="flex flex-wrap items-center gap-1 font-medium">
										{asset.category.map((category, idx) => (
											<span key={category} className="flex items-center gap-0.5">
												<BasicLink href={`/rwa/category/${rwaSlug(category)}`} className="text-link hover:underline">
													{category}
												</BasicLink>
												{definitions.category.values?.[category] ? (
													<QuestionHelper text={definitions.category.values[category]} />
												) : null}
												{idx < asset.category!.length - 1 ? ',' : null}
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
								{asset.assetClass && asset.assetClass.length > 0 ? (
									<span className="flex flex-wrap items-center gap-1 font-medium">
										{asset.assetClass.map((ac, idx) => (
											<span key={ac} className="flex items-center gap-0.5">
												{ac}
												{asset.assetClassDescriptions?.[ac] ? (
													<QuestionHelper text={asset.assetClassDescriptions[ac]} />
												) : null}
												{idx < asset.assetClass!.length - 1 ? ',' : null}
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
										<Menu name="Website" options={asset.website} isExternal className={assetHeaderLinkButtonStyles} />
									) : (
										<ExternalLinkButton key={asset.website[0]} href={asset.website[0]} icon="globe">
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
								{typeof asset.discord === 'string' ? (
									<ExternalLinkButton href={asset.discord} icon="discord">
										Discord
									</ExternalLinkButton>
								) : null}
								{typeof asset.telegram === 'string' ? (
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
				<Card as="section" padding="sm" className="flex flex-col gap-3">
					<h2 className="heading-xs">Notes</h2>
					<ul className="flex list-disc flex-col gap-2 pl-5 body-md text-primary">
						{asset.descriptionNotes.map((note, idx) => (
							<li key={`${keyBase}-note-${idx}-${note.slice(0, 50)}`}>{note}</li>
						))}
					</ul>
				</Card>
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
											{asset.nativeYieldCurrent.toFixed(2)}%
										</span>
									) : null}
								</p>
								<ChartExportButtons
									chartInstance={nativeYieldChartInstance}
									filename={nativeYieldExportFilename}
									title={nativeYieldExportTitle}
								/>
							</ChartPanelToolbar>

							{isLoadingYieldChart ? (
								<ChartPanelBodyFallback role="status" aria-live="polite" className="flex-1 gap-1 body-sm text-tertiary">
									Loading
									<LoadingDots />
								</ChartPanelBodyFallback>
							) : (
								<Suspense fallback={<ChartPanelBodyFallback className="flex-1" />}>
									<MultiSeriesChart2
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

					{displayPools.length > 0 ? (
						<Card padding="sm" className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<h2 className="font-semibold">
									{hasMorePools
										? `DeFi Yield Opportunities (${displayPools.length} of ${yieldPoolsTotal})`
										: `DeFi Yield Opportunities (${displayPools.length})`}
								</h2>
								{hasMorePools && asset.ticker ? (
									<a
										href={`/yields?token=${encodeURIComponent(asset.ticker)}&attribute=no_il&attribute=single_exposure`}
										className="label-sm text-link hover:underline"
									>
										View all {yieldPoolsTotal} →
									</a>
								) : null}
							</div>
							<RWAYieldsTable data={displayPools} compact={isCompactYields} />
						</Card>
					) : null}
				</div>
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
								contracts={asset.contracts?.[chain]}
								contractUrls={asset.contractUrls?.[chain]}
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
