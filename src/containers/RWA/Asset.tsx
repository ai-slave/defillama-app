import {
	createColumnHelper,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable
} from '@tanstack/react-table'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { CopyHelper } from '~/components/Copy'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { LoadingDots } from '~/components/Loaders'
import { Menu } from '~/components/Menu'
import { QuestionHelper } from '~/components/QuestionHelper'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/components/Tooltip'
import { CHART_COLORS } from '~/constants/colors'
import { useYieldChartData } from '~/containers/Yields/queries.client'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button, buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { StatItem } from '~/ui/SummaryStats'
import { formattedNum, truncateAddress } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import type { IRWAAssetData } from './api.types'
import { BreakdownTooltipContent } from './BreakdownTooltipContent'
import { definitions } from './definitions'
import { getRwaPlatforms } from './grouping'
import { rwaSlug } from './rwaSlug'
import { RWAYieldsTable } from './RWAYieldsTable'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))
const assetHeaderLinkButtonStyles = buttonStyles({ variant: 'secondary', size: 'md' })

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

type DefiActiveTvlBreakdownRow = {
	protocol: string
	tvl: number
	share: number
}

const defiActiveTvlBreakdownColumnHelper = createColumnHelper<DefiActiveTvlBreakdownRow>()
const DEFI_ACTIVE_TVL_BREAKDOWN_PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const

const defiActiveTvlBreakdownColumns = [
	defiActiveTvlBreakdownColumnHelper.accessor('protocol', {
		header: 'Protocol',
		enableSorting: false,
		cell: ({ getValue }) => {
			const protocol = getValue()

			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={protocol} kind="token" alt={`Logo of ${protocol}`} size={20} />
					<span>{protocol}</span>
				</span>
			)
		}
	}),
	defiActiveTvlBreakdownColumnHelper.accessor('tvl', {
		header: 'DeFi Active TVL',
		cell: ({ getValue }) => formattedNum(getValue(), true),
		meta: {
			align: 'end' as const
		}
	}),
	defiActiveTvlBreakdownColumnHelper.accessor('share', {
		header: 'Share',
		cell: ({ getValue }) => `${getValue().toFixed(2)}%`,
		meta: {
			align: 'end' as const
		}
	})
]

function DefiActiveTvlBreakdownTable({ breakdown, total }: { breakdown: Array<[string, number]>; total: number }) {
	const data = useMemo(() => {
		const rows: DefiActiveTvlBreakdownRow[] = []
		for (const [protocol, tvl] of breakdown) {
			rows.push({ protocol, tvl, share: total > 0 ? (tvl / total) * 100 : 0 })
		}
		return rows
	}, [breakdown, total])
	const table = useReactTable({
		data,
		columns: defiActiveTvlBreakdownColumns,
		initialState: {
			pagination: {
				pageIndex: 0,
				pageSize: 10
			},
			sorting: [{ id: 'tvl', desc: true }]
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	return <PaginatedTable table={table} pageSizeOptions={DEFI_ACTIVE_TVL_BREAKDOWN_PAGE_SIZE_OPTIONS} shell="none" />
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

type ChainMetricValues = {
	onChainMcap: number | null
	activeMcap: number | null
	defiActiveTvl: number | null
}

function getChainMetricValue(breakdown: Array<[string, number]> | undefined, chain: string): number | null {
	for (const [breakdownChain, value] of breakdown ?? []) {
		if (rwaSlug(breakdownChain) === rwaSlug(chain)) return value
	}
	return null
}

const ChainMetricItem = ({ label, value }: { label: string; value: number | null }) => (
	<div className="flex items-center justify-between gap-2 label-sm">
		<dt className="text-secondary">{label}</dt>
		<dd className="text-right font-jetbrains font-medium whitespace-nowrap">
			{value == null ? '-' : formattedNum(value, true)}
		</dd>
	</div>
)

const ChainBadge = ({
	chain,
	isPrimary = false,
	showPrimaryStyle = true,
	contracts,
	contractUrls,
	metrics
}: {
	chain: string
	isPrimary?: boolean
	showPrimaryStyle?: boolean
	contracts?: string[]
	contractUrls?: Record<string, string>
	metrics: ChainMetricValues
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
				<dl className="mt-1.5 grid gap-1 border-t border-subtle pt-1.5">
					<ChainMetricItem label={definitions.onChainMcap.label} value={metrics.onChainMcap} />
					<ChainMetricItem label={definitions.activeMcap.label} value={metrics.activeMcap} />
					<ChainMetricItem label={definitions.defiActiveTvl.label} value={metrics.defiActiveTvl} />
				</dl>
			</div>
		</Card>
	)
}

export const RWAAssetPage = ({ asset }: { asset: IRWAAssetData }) => {
	const displayName = asset.assetName ?? asset.ticker ?? 'Unknown asset'
	const keyBase = asset.ticker ?? asset.assetName ?? 'asset'
	const onChainMcap = asset.onChainMcap ?? null
	const activeMcap = asset.activeMcap ?? null
	const defiActiveTv = asset.defiActiveTvl ?? null
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

	const nativeYieldExportFilename = `${asset.ticker ?? asset.assetName ?? 'asset'}-native-yield`
	const nativeYieldExportTitle = `${asset.ticker ?? asset.assetName ?? 'Asset'} Native Yield`

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

	const attestationLinks = asset.attestationLinks ?? []

	return (
		<div className="flex flex-col gap-2">
			{/* Header */}
			<Card padding="sm" className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="heading-xs">{displayName}</h1>
					{asset.ticker ? <p className="body-md text-tertiary">({asset.ticker})</p> : null}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{asset.website ? (
						asset.website.length > 1 ? (
							<Menu name="Website" options={asset.website} isExternal className={assetHeaderLinkButtonStyles} />
						) : (
							<Button
								as="a"
								key={asset.website[0]}
								href={asset.website[0]}
								target="_blank"
								rel="noopener noreferrer"
								size="md"
							>
								<Icon name="external-link" className="size-3" />
								Website
							</Button>
						)
					) : null}
					{asset.twitter ? (
						asset.twitter.length > 1 ? (
							<Menu name="Twitter" options={asset.twitter} isExternal className={assetHeaderLinkButtonStyles} />
						) : (
							<Button
								as="a"
								key={asset.twitter[0]}
								href={asset.twitter[0]}
								target="_blank"
								rel="noopener noreferrer"
								size="md"
							>
								<Icon name="external-link" className="size-3" />
								Twitter
							</Button>
						)
					) : null}
					{asset.linkedin ? (
						<Button as="a" href={asset.linkedin} target="_blank" rel="noopener noreferrer" size="md">
							<Icon name="external-link" className="size-3" />
							LinkedIn
						</Button>
					) : null}
					{asset.docs ? (
						<Button as="a" href={asset.docs} target="_blank" rel="noopener noreferrer" size="md">
							<Icon name="external-link" className="size-3" />
							Docs
						</Button>
					) : null}
					{asset.rwaGithub != null ? (
						<Button as="a" href={asset.rwaGithub} target="_blank" rel="noopener noreferrer" size="md">
							<Icon name="external-link" className="size-3" />
							GitHub
						</Button>
					) : null}
					{typeof asset.discord === 'string' ? (
						<Button as="a" href={asset.discord} target="_blank" rel="noopener noreferrer" size="md">
							<Icon name="external-link" className="size-3" />
							Discord
						</Button>
					) : null}
					{typeof asset.telegram === 'string' ? (
						<Button as="a" href={asset.telegram} target="_blank" rel="noopener noreferrer" size="md">
							<Icon name="external-link" className="size-3" />
							Telegram
						</Button>
					) : null}
				</div>
			</Card>

			{/* Stats Row */}
			<div className="flex flex-col gap-2 lg:flex-row">
				<Tooltip
					content={
						onChainMcap?.breakdown != null ? (
							<BreakdownTooltipContent
								breakdown={onChainMcap.breakdown}
								description={definitions.onChainMcap.description}
							/>
						) : (
							definitions.onChainMcap.description
						)
					}
					render={<Card padding="sm" className="flex flex-1 flex-col items-start gap-1" />}
				>
					<span className="text-secondary underline decoration-dotted">{definitions.onChainMcap.label}</span>
					<span className="font-jetbrains text-2xl font-semibold">
						{onChainMcap?.total != null ? formattedNum(onChainMcap.total, true) : '-'}
					</span>
				</Tooltip>

				<Tooltip
					content={
						activeMcap?.breakdown != null ? (
							<BreakdownTooltipContent
								breakdown={activeMcap.breakdown}
								description={definitions.activeMcap.description}
							/>
						) : (
							definitions.activeMcap.description
						)
					}
					render={<Card padding="sm" className="flex flex-1 flex-col items-start gap-1" />}
				>
					<span className="text-secondary underline decoration-dotted">{definitions.activeMcap.label}</span>
					<span className="font-jetbrains text-2xl font-semibold">
						{activeMcap?.total != null ? formattedNum(activeMcap.total, true) : '-'}
					</span>
				</Tooltip>

				<Tooltip
					content={
						defiActiveTv?.breakdown != null ? (
							<BreakdownTooltipContent
								breakdown={defiActiveTv.breakdown}
								description={definitions.defiActiveTvl.description}
							/>
						) : (
							definitions.defiActiveTvl.description
						)
					}
					render={<Card padding="sm" className="flex flex-1 flex-col items-start gap-1" />}
				>
					<span className="text-secondary underline decoration-dotted">{definitions.defiActiveTvl.label}</span>
					<span className="font-jetbrains text-2xl font-semibold">
						{defiActiveTv?.total != null ? formattedNum(defiActiveTv.total, true) : '$0'}
					</span>
				</Tooltip>

				{asset.price != null ? (
					<Card padding="sm" className="flex-1">
						<StatItem
							className="gap-1"
							label={`${asset.ticker ?? 'Token'} Price`}
							value={formattedNum(asset.price, true)}
						/>
					</Card>
				) : null}
				<Card padding="sm" className="flex-1">
					<StatItem className="gap-1" label="Chains" value={asset.chain?.length ?? 0} />
				</Card>
				{asset.nativeYieldCurrent != null ? (
					<Card padding="sm" className="flex-1">
						<StatItem className="gap-1" label="Native Yield" value={`${asset.nativeYieldCurrent.toFixed(2)}%`} />
					</Card>
				) : null}
			</div>

			{asset.chartDataset && asset.chartDataset.source.length > 0 ? (
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart2
							charts={timeSeriesCharts}
							dataset={asset.chartDataset}
							hideDefaultLegend={false}
							exportButtons={{
								png: true,
								csv: true,
								filename: `${asset.ticker ?? asset.assetName ?? 'asset'}`,
								pngTitle: `${asset.ticker ?? asset.assetName ?? 'Asset'}`
							}}
						/>
					</Suspense>
				</ChartPanel>
			) : null}

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
					{/* Issuer Information */}
					<SectionCard title="Issuer Information">
						<div className="flex flex-col gap-2">
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
						</div>
					</SectionCard>

					{/* Oracle Metadata */}
					{asset.oracleProvider != null || asset.oracleProofLink != null ? (
						<SectionCard title="Oracle">
							{asset.oracleProofLink != null ? (
								<a
									href={asset.oracleProofLink}
									target="_blank"
									rel="noopener noreferrer"
									className="hover-wash flex items-center justify-between gap-2 rounded-[8px] border border-subtle bg-surface p-2"
								>
									<span className="flex items-center gap-2">
										<Icon name="check-circle" className="size-4 text-secondary" />
										<span className="flex flex-col">
											<span className="label-md">{asset.oracleProvider ?? 'Oracle Proof'}</span>
											<span className="label-sm text-secondary">View oracle proof details</span>
										</span>
									</span>
									<Icon name="external-link" className="size-3" />
								</a>
							) : (
								<Card padding="sm" className="flex items-center justify-between gap-2">
									<span className="label-md">{asset.oracleProvider}</span>
								</Card>
							)}
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
							{asset.dateOfLastAttestation != null ? (
								<p className="mb-2 flex flex-col gap-1">
									<span className="text-secondary">Date of Last Attestation</span>
									<span className="font-medium">{asset.dateOfLastAttestation}</span>
								</p>
							) : null}
							{attestationFrequency != null ? (
								<p className="mb-2 flex flex-col gap-1">
									<span className="text-secondary">Attestation Frequency</span>
									<span className="font-medium">{attestationFrequency}</span>
								</p>
							) : null}
							{attestationLinks.map((link) => (
								<a
									key={link}
									href={link}
									target="_blank"
									rel="noopener noreferrer"
									className="hover-wash flex items-center justify-between gap-2 rounded-[8px] border border-subtle bg-surface p-2"
								>
									<span className="flex items-center gap-2">
										<Icon name="check-circle" className="size-4 text-secondary" />
										<span className="flex flex-col">
											<span className="label-md">View Attestations</span>
											<span className="label-sm text-secondary">Third-party verification reports</span>
										</span>
									</span>
									<Icon name="external-link" className="size-3" />
								</a>
							))}
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

			{defiActiveTv?.breakdown != null && defiActiveTv.breakdown.length > 0 ? (
				<SectionCard title="DeFi Active TVL by Protocol">
					<DefiActiveTvlBreakdownTable breakdown={defiActiveTv.breakdown} total={defiActiveTv.total} />
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
								metrics={{
									onChainMcap: getChainMetricValue(onChainMcap?.breakdown, chain),
									activeMcap: getChainMetricValue(activeMcap?.breakdown, chain),
									defiActiveTvl: getChainMetricValue(asset.defiActiveTvlByChain?.breakdown, chain)
								}}
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
