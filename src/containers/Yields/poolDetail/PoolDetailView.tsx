import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { Skeleton } from '~/ui/Skeleton'
import { LoadingIndicator } from '~/ui/Status'
import { formatPercent, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import type { MeasuredApy } from '../data/apy'
import type { VerifiedBlock } from '../data/types'
import { hasPart } from '../domain/apyPresentation'
import { useStickyPrefsOverlay, useStickyQueryReplace } from '../useStickyQueryReplace'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { VerifiedApyAnnouncement } from '../VerifiedApyAnnouncement'
import type { ExitReliabilityModel } from './exitReliability'
import { ExitReliabilityPanel } from './ExitReliabilityPanel'
import { scoreValue, YIELD_PERCENT_OPTIONS } from './format'
import type { GrowthChartModel } from './growthChart'
import { HoldersPanel } from './HoldersPanel'
import type { LiquidityChartModel } from './liquidityChart'
import { PoolApyChart } from './PoolApyChart'
import { type PoolChartModel, stripVerifiedSeries } from './poolCharts'
import { PoolGrowthChart } from './PoolGrowthChart'
import { PoolHeader, PoolMetaInfo } from './PoolHeader'
import { PoolLiquidityChart } from './PoolLiquidityChart'
import { POOL_CHART_PREFS } from './queryState'
import type { DetailChain, DetailHolders, DetailProtocol, PoolHistoryRange } from './types'
import { usePoolVerifiedProps } from './useVerifiedProps'
import { VerifiedApyPanel, type VerifiedWindowRow } from './VerifiedApyPanel'
import {
	buildVerifiedSnapshot,
	LockedVerifiedSection,
	type MeasuredComposition,
	VerifiedSection
} from './VerifiedSnapshotCard'

type ApyKind = 'supply' | 'borrow'

export interface ApyBreakdown {
	total: number | null
	base: number | null
	reward: number | null
	intrinsic: number | null
	rewardTokens: Array<string>
	intrinsicSource: string | null
}

export interface PoolMetric {
	label: string
	value: number | null
	// How to render `value`. Defaults to a USD dollar figure; 'ltv' renders a
	// loan-to-value ratio as a whole-percent (borrow-only markets).
	format?: 'usd' | 'ltv'
}

export interface PoolSide {
	apyLabel: string
	apy: ApyBreakdown
	metrics: Array<PoolMetric>
}

export interface StabilityInfo {
	score: number | null
	rating: string | null
}

export interface PoolDetailViewProps {
	poolId: string
	// 'pool' = earn pool (may also be a borrow market); 'borrow' = borrow-only market
	// (no /v2/earn row) rendered from the borrow-markets detail endpoint.
	mode: 'pool' | 'borrow'
	// Whether a vault-risk entry exists for this pool (gates the "View risk data" link).
	hasRisk: boolean
	exploited: boolean
	// The range the supply history was fetched at — the widest the APY, growth and deposits panels
	// asked for, since all three read it and slice their own window locally.
	initialRange: PoolHistoryRange
	// Borrow history is its own fetch with its own URL range; omitted when it matches `initialRange`.
	initialBorrowRange?: PoolHistoryRange
	symbol: string
	name: string
	protocol: DetailProtocol
	chain: DetailChain
	supply: PoolSide | null
	borrow: PoolSide | null
	stability: StabilityInfo | null
	supplyChart: PoolChartModel | null
	borrowChart: PoolChartModel | null
	// Only present on pools with at least one measured redemption; unmeasured pools render no
	// growth chart at all rather than an empty one.
	growthChart: GrowthChartModel | null
	// Null when the pool never reported withdrawable liquidity, or when its underlying tokens
	// disagree on decimals so the raw amounts cannot be denominated.
	liquidityChart: LiquidityChartModel | null
	// Aggregated daily withdrawal-check outcomes over the pool's FULL measured history (always
	// built from max-range history, whatever ?range= says). Null when no day was ever measured.
	exitReliability: ExitReliabilityModel | null
	// Needed by the chart to rebuild its model when a wider range is fetched client-side.
	liquidityDecimals: number | null
	// Underlying token symbol for the verdict card's native-unit line.
	// The measured block from `/v2/earn/:id`. Null on unmeasured pools, which render no
	// verification panel at all rather than an empty or greyed one.
	verified: VerifiedBlock | null
	// Supply composition with the measured legs swapped in; null on unmeasured or redacted pages.
	apy: MeasuredApy | null
	verifiedWindows: Array<VerifiedWindowRow>
	// Measured, but stripped server-side: every verified-derived model above arrives empty.
	// Null means SSR could not establish entitlement; the data is still redacted.
	verifiedLocked?: boolean | null
	holders: DetailHolders | null
	details: {
		poolTokenAddress: string | null
		url: string | null
		protocolName: string
		assets: Array<string>
	}
}

function apyParts(apy: ApyBreakdown, kind: ApyKind) {
	const parts: Array<{ key: string; label: string; value: string; strong: boolean }> = []
	if (apy.base != null) {
		parts.push({
			key: 'base',
			label: kind === 'borrow' ? 'Base cost' : 'Base',
			value: formatPercent(apy.base, YIELD_PERCENT_OPTIONS),
			strong: false
		})
	}
	if (hasPart(apy.reward)) {
		const sign = kind === 'borrow' ? '−' : '+'
		const syms = apy.rewardTokens.length > 0 ? ` · ${apy.rewardTokens.join(', ')}` : ''
		parts.push({
			key: 'reward',
			label: `Reward${syms}`,
			value: `${sign}${formatPercent(Math.abs(apy.reward), YIELD_PERCENT_OPTIONS)}`,
			strong: true
		})
	}
	if (hasPart(apy.intrinsic)) {
		const src = apy.intrinsicSource ? ` · ${apy.intrinsicSource}` : ''
		parts.push({
			key: 'intrinsic',
			label: `Intrinsic${src}`,
			value: `+${formatPercent(Math.abs(apy.intrinsic), YIELD_PERCENT_OPTIONS)}`,
			strong: false
		})
	}
	return parts
}

const VALUE_CLS = 'ml-auto mono-md-bold'
const SUB_VALUE_CLS = 'ml-auto mono-md'

function SideBlock({
	side,
	kind,
	children,
	hideApy = false
}: {
	side: PoolSide
	kind: ApyKind
	children?: React.ReactNode
	/** The verified section states the APY instead; showing both would say it twice. */
	hideApy?: boolean
}) {
	const parts = hasPart(side.apy.reward) || hasPart(side.apy.intrinsic) ? apyParts(side.apy, kind) : []
	const apyValue = side.apy.total == null ? '—' : formatPercent(side.apy.total, YIELD_PERCENT_OPTIONS)
	return (
		<>
			{hideApy ? null : parts.length > 0 ? (
				<MetricSection label={side.apyLabel} value={apyValue} valueClassName={VALUE_CLS}>
					{parts.map((p) => (
						<SubMetricRow
							key={p.key}
							label={p.label}
							value={p.value}
							valueClassName={`${SUB_VALUE_CLS}${p.strong ? ' text-(--yield-reward-text)' : ''}`}
						/>
					))}
				</MetricSection>
			) : (
				<MetricRow label={side.apyLabel} value={apyValue} valueClassName={VALUE_CLS} />
			)}
			{side.metrics.map((m) => (
				<MetricRow
					key={m.label}
					label={m.label}
					value={
						m.format === 'ltv'
							? (formatPercent(m.value, {
									input: 'fraction',
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								}) ?? '—')
							: (formatUsd(m.value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—')
					}
					valueClassName={VALUE_CLS}
				/>
			))}
			{children}
		</>
	)
}

function PoolChartPlaceholder({ title }: { title: string }) {
	return (
		<ChartPanel className="h-full">
			<PanelHeader>
				<PanelTitle>{title}</PanelTitle>
				<Skeleton className="ml-auto h-8 w-40" />
			</PanelHeader>
			<ChartPanelToolbar>
				<Skeleton className="h-8 w-40" />
				<Skeleton className="ml-auto h-8 w-40" />
			</ChartPanelToolbar>
			<ChartPanelBody>
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator label="Loading chart" />
				</ChartPanelBodyFallback>
			</ChartPanelBody>
		</ChartPanel>
	)
}

export function PoolDetailView({
	poolId,
	mode,
	hasRisk,
	exploited,
	initialRange,
	initialBorrowRange,
	symbol,
	name,
	protocol,
	chain,
	supply,
	borrow,
	stability,
	supplyChart: supplyChartFromProps,
	borrowChart,
	growthChart: growthChartFromProps,
	liquidityChart: liquidityChartFromProps,
	liquidityDecimals: liquidityDecimalsFromProps,
	exitReliability: exitReliabilityFromProps,
	verified: verifiedFromProps,
	apy: apyFromProps,
	verifiedWindows: verifiedWindowsFromProps,
	verifiedLocked,
	holders,
	details
}: PoolDetailViewProps) {
	const { hasAccess, isDenied } = useVerifiedAccess()
	// A subscriber's page carries its measured props; they stand only while the reader is still
	// entitled, as the table's seed does, so a lapsed or ended session drops them without a reload.
	const seeded = !isDenied
	const locked = verifiedLocked === null || verifiedLocked === true || (isDenied && verifiedFromProps != null)
	// The page's props are redacted for everyone else; a subscriber's measured sections arrive here.
	const { props: paid, isLoading: paidLoading } = usePoolVerifiedProps({
		poolId,
		range: initialRange,
		locked
	})
	const verified = (seeded ? verifiedFromProps : null) ?? paid.verified
	const verifiedWindows =
		seeded && verifiedWindowsFromProps.length > 0 ? verifiedWindowsFromProps : paid.verifiedWindows
	const growthChart = (seeded ? growthChartFromProps : null) ?? paid.growthChart
	const liquidityChart = (seeded ? liquidityChartFromProps : null) ?? paid.liquidityChart
	const liquidityDecimals = (seeded ? liquidityDecimalsFromProps : null) ?? paid.liquidityDecimals
	const exitReliability = (seeded ? exitReliabilityFromProps : null) ?? paid.exitReliability
	// The measured rebuild defaults its TVL label, which depends on protocol meta only the page
	// resolves. The page's own chart holds the right one, so it is carried across.
	const supplyChart = useMemo(() => {
		if (!paid.supplyChart) {
			// A subscriber's page carries the measured chart; once their access has ended (a logout in
			// another tab), it shows what the public build would: the reported bars without the verified base.
			return seeded || !supplyChartFromProps ? supplyChartFromProps : stripVerifiedSeries(supplyChartFromProps)
		}
		const label = supplyChartFromProps?.lines.find((line) => line.unit === 'usd')?.label
		if (label == null) return paid.supplyChart
		return {
			...paid.supplyChart,
			lines: paid.supplyChart.lines.map((line) => (line.unit === 'usd' ? { ...line, label } : line))
		}
	}, [paid.supplyChart, seeded, supplyChartFromProps])
	// Anonymous SSR keeps its offer; an unavailable server check must wait for a client verdict.
	const showOffer = locked && verified == null && !paidLoading && !hasAccess && (verifiedLocked !== null || isDenied)
	// Built once and shared: the section renders it, and the supply block hides the APY it covers.
	const snapshot = verified ? buildVerifiedSnapshot(verified, verifiedWindows) : null
	// The table cell's split: only when a leg was substituted and there is more than the base to show.
	const measuredApy = (seeded ? apyFromProps : null) ?? paid.apy
	let composition: MeasuredComposition | null = null
	if (
		supply &&
		measuredApy?.measured != null &&
		measuredApy.total != null &&
		(hasPart(measuredApy.reward) || hasPart(measuredApy.intrinsic))
	) {
		const provenance: Record<string, string> = {
			base: 'verified',
			reward: 'reported',
			intrinsic: measuredApy.intrinsicMeasured != null ? 'verified' : 'reported'
		}
		const parts = apyParts({ ...supply.apy, ...measuredApy }, 'supply').map((part) => {
			const source = provenance[part.key]
			return source ? { ...part, provenance: source } : part
		})
		composition = { total: measuredApy.total, parts }
	}

	const growthSection = growthChart ? (
		<PoolGrowthChart key={`${poolId}:growth`} model={growthChart} poolId={poolId} initialRange={initialRange} />
	) : null
	const liquiditySection = liquidityChart ? (
		<PoolLiquidityChart
			key={`${poolId}:liquidity`}
			model={liquidityChart}
			poolId={poolId}
			decimals={liquidityDecimals}
			exitStatus={verified?.exit?.status ?? null}
			initialRange={initialRange}
		/>
	) : null
	// A chart without its product card (history without a current measurement) still gets a panel.
	const apyCard = verified ? (
		<VerifiedApyPanel verified={verified} measuredSince={exitReliability?.measuredSince ?? null}>
			{growthSection}
		</VerifiedApyPanel>
	) : growthSection ? (
		<ChartPanel>{growthSection}</ChartPanel>
	) : null
	const exitCard = exitReliability ? (
		<ExitReliabilityPanel model={exitReliability} verified={verified} holders={holders}>
			{liquiditySection}
		</ExitReliabilityPanel>
	) : liquiditySection ? (
		<ChartPanel>{liquiditySection}</ChartPanel>
	) : null

	// Fill the APY charts' range / windows the URL lacks from the sticky per-browser preferences,
	// once for both so two replaces can never race; mount them only once resolved so neither default
	// controls nor default history can flash.
	const router = useRouter()
	const preferencesReady = useStickyQueryReplace(
		useStickyPrefsOverlay(router.isReady ? router.query : null, POOL_CHART_PREFS)
	)

	const stabilityRating = stability?.rating ?? null
	const stabilityScore = stability?.score ?? null
	const stabilityColor =
		stabilityRating === 'stable'
			? ' text-(--yield-positive-text)'
			: stabilityRating === 'volatile'
				? ' text-(--yield-negative-text)'
				: ''
	const stabilityRow =
		stabilityRating != null && stabilityScore != null ? (
			<MetricRow
				label="30d Stability"
				tooltip="How consistent this pool's supply-side APY has been over the last 30 days. Higher score is more stable."
				valueClassName={`${VALUE_CLS}${stabilityColor}`}
				value={
					<>
						<span className="capitalize">{stabilityRating}</span>{' '}
						<span className="text-secondary">{scoreValue(stabilityScore)}</span>
					</>
				}
			/>
		) : null

	// A queued-exit pool has no instant lane to plot, so the panel would be a second deposits chart
	// under an exit title. One flag drives both the count and the render, so a suppressed panel can
	// never leave a lone chart in a half-width column beside an empty one.

	// The donut needs the pool's headline dollar figure (TVL / Total supplied) to derive
	// per-holder USD. Only earn pools carry that as their first supply metric; borrow-only
	// markets have no pooled TVL (and don't carry holders), so pass null.
	const tvlUsd = mode === 'pool' ? (supply?.metrics[0]?.value ?? null) : null

	// Prefix for the holders donut's PNG/CSV export filename.
	const exportTitle =
		symbol && protocol.name
			? `${symbol} - ${protocol.name}${chain.name ? ` (${chain.name})` : ''}`
			: symbol || protocol.name || poolId

	// Preserve the stacked summary at normal widths; only spend horizontal space
	// on a summary rail once the pool content itself is wide enough for both regions.
	return (
		<div className="@container flex w-full flex-col gap-2">
			{exploited ? (
				<p
					role="alert"
					className="flex items-start gap-3 rounded-lg border border-l-4 border-error/30 border-l-error bg-error/10 p-3 body-md"
				>
					<Icon name="alert-triangle-filled" height={20} width={20} className="mt-px shrink-0 text-error" />
					<span className="flex flex-col">
						<span className="font-semibold text-error-on-tint">Exploit or ongoing incident</span>
						<span>
							This pool involves a protocol or token affected by an exploit or an ongoing incident. Proceed with extreme
							caution.
						</span>
					</span>
				</p>
			) : null}
			{/* The feature's one-sentence pitch lives here, spanning both columns, so the summary card
			    below can stay as short as the subscriber's and the chart beside it the same height. */}
			{showOffer ? <VerifiedApyAnnouncement placement="pool-banner" /> : null}

			<div className="grid grid-cols-1 gap-2 @min-[90rem]:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
				<Card padding="sm" className="flex flex-col gap-3 self-start">
					<PoolHeader symbol={symbol} name={name} protocol={protocol} chain={chain} />

					{/* Trial placement: straight under the identity, so the measured claim leads the card
					    and the pool's own reported stats follow it. */}
					{verified && snapshot ? (
						<VerifiedSection verified={verified} snapshot={snapshot} composition={composition} />
					) : null}
					{/* One panel for every measured section: the rest render nothing without the data. */}
					{showOffer ? <LockedVerifiedSection /> : null}
					{verifiedLocked === null && verified == null && !paidLoading && !isDenied ? (
						<p role="status" className="text-sm text-secondary">
							Verified APY is temporarily unavailable.
						</p>
					) : null}

					{supply || borrow ? (
						<div className="grid grid-cols-1 gap-x-6 border-t border-subtle pt-1 @min-[40rem]:grid-cols-2 @min-[80rem]:grid-cols-3 @min-[90rem]:grid-cols-1">
							{supply ? (
								<SideBlock side={supply} kind="supply" hideApy={snapshot?.baseApy != null}>
									{stabilityRow}
								</SideBlock>
							) : null}
							{borrow ? <SideBlock side={borrow} kind="borrow" /> : null}
						</div>
					) : null}

					<PoolMetaInfo
						protocol={protocol}
						chain={chain}
						poolTokenAddress={details.poolTokenAddress}
						url={details.url}
						assets={details.assets}
						actions={
							hasRisk ? (
								<Button
									as={BasicLink}
									href={`/yields/pool/${poolId}/risk`}
									variant="secondary"
									size="md"
									className="group w-fit"
								>
									<Icon name="shield-check" className="size-3.5 text-warning" />
									View risk data
									<span className="transition-transform group-hover:translate-x-0.5">→</span>
								</Button>
							) : null
						}
					/>
				</Card>

				{/* Rhythm carries the hierarchy: the rate charts are the primary read and sit at full
				    height, the measured pair below them runs compact and side by side. Each chart owns
				    its range control and URL param, so one panel's window never moves another's. */}
				<div className="flex min-w-0 flex-col gap-2">
					{supplyChart ? (
						preferencesReady ? (
							<PoolApyChart
								key={`${poolId}:supply:${paid.supplyChart ? 'measured' : 'reported'}`}
								model={supplyChart}
								poolId={poolId}
								kind="supply"
								initialRange={initialRange}
								lockedVerifiedApy={locked && !hasAccess}
							/>
						) : (
							<PoolChartPlaceholder key="supply" title={supplyChart.title} />
						)
					) : null}
					{borrowChart ? (
						preferencesReady ? (
							<PoolApyChart
								key={`${poolId}:borrow`}
								model={borrowChart}
								poolId={poolId}
								kind="borrow"
								initialRange={initialBorrowRange ?? initialRange}
							/>
						) : (
							<PoolChartPlaceholder key="borrow" title={borrowChart.title} />
						)
					) : null}
					{!supplyChart && !borrowChart ? (
						<Card padding="md" className="flex min-h-24 flex-1 items-center justify-center">
							<p className="text-center body-sm text-tertiary">No history available for this pool yet.</p>
						</Card>
					) : null}
				</div>
			</div>

			{apyCard || exitCard ? (
				/* The conclusions already sit in the summary card. This band is the two products behind
				   them, each with its answer, its history and its receipts: the yield down the left, the
				   exit down the right, paired above 64rem and stacked below. */
				<section
					aria-label="Measured history"
					className={
						apyCard && exitCard
							? 'grid grid-cols-1 items-start gap-2 @min-[64rem]:grid-cols-2'
							: 'grid grid-cols-1 gap-2'
					}
				>
					{apyCard}
					{exitCard}
				</section>
			) : null}

			{holders ? (
				<HoldersPanel holders={holders} chain={chain.name} tvlUsd={tvlUsd} poolId={poolId} exportTitle={exportTitle} />
			) : null}
		</div>
	)
}
