import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useNowSecondsOnce } from '~/hooks/useNowSeconds'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { Skeleton } from '~/ui/Skeleton'
import { LoadingIndicator } from '~/ui/Status'
import type { MeasuredApy } from '../data/apy'
import type { VerifiedBlock } from '../data/types'
import { hasPart } from '../domain/apyPresentation'
import { useStickyPrefsOverlay, useStickyQueryReplace } from '../useStickyQueryReplace'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { AnswerStrip, apyParts } from './AnswerStrip'
import type { ExitReliabilityModel } from './exitReliability'
import { EXIT_STATUS_ID, ExitLedger, ExitReliabilityPanel } from './ExitReliabilityPanel'
import type { GrowthChartModel, IntrinsicSourceSeries } from './growthChart'
import { HoldersPanel } from './HoldersPanel'
import type { LiquidityChartModel } from './liquidityChart'
import { PoolApyChart } from './PoolApyChart'
import type { PoolChartModel } from './poolCharts'
import { PoolGrowthChart } from './PoolGrowthChart'
import { PoolHeader, PoolMetaInfo } from './PoolHeader'
import { PoolLiquidityChart } from './PoolLiquidityChart'
import { POOL_CHART_PREFS } from './queryState'
import type { DetailChain, DetailHolders, DetailProtocol, PoolHistoryRange } from './types'
import { usePoolVerifiedProps } from './useVerifiedProps'
import { VerifiedApyPanel, type VerifiedWindowRow } from './VerifiedApyPanel'
import { buildVerifiedSnapshot, LockedVerifiedSection, type MeasuredComposition } from './VerifiedSnapshotCard'
import { isPoolVerifiedLocked, resolvePoolVerifiedView } from './verifiedView'

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
	// Whether a vault-risk entry exists for this pool.
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
	intrinsicSeries: IntrinsicSourceSeries | null
	// Null when the pool never reported withdrawable liquidity, or when its underlying tokens
	// disagree on decimals so the raw amounts cannot be denominated.
	liquidityChart: LiquidityChartModel | null
	// Aggregated daily withdrawal-check outcomes over the pool's FULL measured history (always
	// built from max-range history, whatever ?range= says). Null when no day was ever measured.
	exitReliability: ExitReliabilityModel | null
	// Needed by the chart to rebuild its model when a wider range is fetched client-side.
	liquidityDecimals: number | null
	// The measured block from `/v2/earn/:id`. Null on unmeasured pools, which render no
	// verification panel at all rather than an empty or greyed one.
	verified: VerifiedBlock | null
	// Supply composition with the measured legs swapped in; null on unmeasured or redacted pages.
	apy: MeasuredApy | null
	verifiedWindows: Array<VerifiedWindowRow>
	// Measured, but stripped server-side: every verified-derived model above arrives empty.
	// Null means SSR could not establish entitlement; the data is still redacted.
	verifiedLocked?: boolean | null
	stepAccrual?: boolean
	holders: DetailHolders | null
	details: {
		poolTokenAddress: string | null
		url: string | null
		protocolName: string
		assets: Array<string>
	}
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
	intrinsicSeries: intrinsicSeriesFromProps,
	liquidityChart: liquidityChartFromProps,
	liquidityDecimals: liquidityDecimalsFromProps,
	exitReliability: exitReliabilityFromProps,
	verified: verifiedFromProps,
	apy: apyFromProps,
	verifiedWindows: verifiedWindowsFromProps,
	verifiedLocked,
	stepAccrual = false,
	holders,
	details
}: PoolDetailViewProps) {
	const { hasAccess, isDenied } = useVerifiedAccess()
	const locked = isPoolVerifiedLocked(verifiedLocked, isDenied, verifiedFromProps)
	// The page's props are redacted for everyone else; a subscriber's measured sections arrive here.
	const { props: paid, isLoading: paidLoading } = usePoolVerifiedProps({
		poolId,
		range: initialRange,
		locked
	})
	const {
		verified,
		verifiedWindows,
		growthChart,
		intrinsicSeries,
		liquidityChart,
		liquidityDecimals,
		exitReliability,
		supplyChart,
		apy: measuredApy,
		notice
	} = useMemo(
		() =>
			resolvePoolVerifiedView({
				access: { hasAccess, isDenied },
				verifiedLocked,
				locked,
				paid,
				paidLoading,
				fromProps: {
					verified: verifiedFromProps,
					apy: apyFromProps,
					verifiedWindows: verifiedWindowsFromProps,
					growthChart: growthChartFromProps,
					intrinsicSeries: intrinsicSeriesFromProps,
					liquidityChart: liquidityChartFromProps,
					liquidityDecimals: liquidityDecimalsFromProps,
					exitReliability: exitReliabilityFromProps,
					supplyChart: supplyChartFromProps
				}
			}),
		[
			hasAccess,
			isDenied,
			verifiedLocked,
			locked,
			paid,
			paidLoading,
			verifiedFromProps,
			apyFromProps,
			verifiedWindowsFromProps,
			growthChartFromProps,
			intrinsicSeriesFromProps,
			liquidityChartFromProps,
			liquidityDecimalsFromProps,
			exitReliabilityFromProps,
			supplyChartFromProps
		]
	)
	// The page clock on the first render, so "verified within a day" reads the same on the server and the client.
	const nowMs = useNowSecondsOnce() * 1000
	const snapshot = verified ? buildVerifiedSnapshot(verified, verifiedWindows, nowMs) : null
	// The table cell's split: only when a leg was substituted and there is more than the base to show.
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
		<PoolGrowthChart
			key={`${poolId}:growth`}
			model={growthChart}
			poolId={poolId}
			initialRange={initialRange}
			intrinsicSymbol={supply.apy.intrinsicSource}
			intrinsicSeries={intrinsicSeries}
		/>
	) : null
	const liquiditySection = liquidityChart ? (
		<PoolLiquidityChart
			key={`${poolId}:liquidity`}
			model={liquidityChart}
			poolId={poolId}
			decimals={liquidityDecimals}
			exitStatus={verified?.exit?.status ?? null}
			verified={verified}
			reliability={exitReliability}
			ledger={exitReliability ? <ExitLedger model={exitReliability} verified={verified} holders={holders} /> : null}
			initialRange={initialRange}
		/>
	) : null
	const apyCard = growthSection ? <ChartPanel>{growthSection}</ChartPanel> : null
	const receipts = verified ? (
		<VerifiedApyPanel
			verified={verified}
			stepAccrual={stepAccrual}
			measuredSince={exitReliability?.measuredSince ?? null}
			symbol={symbol}
		/>
	) : null
	const exitCard = liquiditySection ? (
		<ChartPanel id={EXIT_STATUS_ID} className="scroll-mt-4">
			{liquiditySection}
		</ChartPanel>
	) : exitReliability ? (
		<ExitReliabilityPanel model={exitReliability} verified={verified} holders={holders} />
	) : null

	// Fill the APY charts' range / windows the URL lacks from the sticky per-browser preferences,
	// once for both so two replaces can never race; mount them only once resolved so neither default
	// controls nor default history can flash.
	const router = useRouter()
	const preferencesReady = useStickyQueryReplace(
		useStickyPrefsOverlay(router.isReady ? router.query : null, POOL_CHART_PREFS)
	)

	// Prefix for the holders donut's PNG/CSV export filename.
	const exportTitle =
		symbol && protocol.name
			? `${symbol} - ${protocol.name}${chain.name ? ` (${chain.name})` : ''}`
			: symbol || protocol.name || poolId

	// The page stops growing at 90rem rather than stretching across a wide monitor.
	return (
		<div className="@container mx-auto flex w-full max-w-[90rem] flex-col gap-2">
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

			<PoolHeader
				symbol={symbol}
				name={name}
				protocol={protocol}
				chain={chain}
				poolTokenAddress={details.poolTokenAddress}
				url={details.url}
			/>

			<AnswerStrip
				supply={supply}
				borrow={borrow}
				stability={stability}
				holders={holders}
				snapshot={snapshot}
				composition={composition}
				verifiedAsOf={verified?.apy_as_of ?? null}
				verifiedNote={verified?.apy_note ?? null}
				hasRisk={hasRisk}
				poolId={poolId}
			/>
			{notice === 'offer' ? <LockedVerifiedSection symbol={symbol} /> : null}
			{notice === 'unavailable' ? (
				<p role="status" className="px-1 body-sm text-secondary">
					Verified APY is temporarily unavailable.
				</p>
			) : null}

			<div className="flex min-w-0 flex-col gap-2">
				<section aria-label="APY history" className="flex flex-col gap-2">
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
				</section>

				{apyCard}
				{exitCard}
				{receipts}

				{holders ? (
					<HoldersPanel holders={holders} chain={chain.name} poolId={poolId} exportTitle={exportTitle} />
				) : null}

				<PoolMetaInfo
					poolId={poolId}
					protocol={protocol}
					chain={chain}
					poolTokenAddress={details.poolTokenAddress}
					assets={details.assets}
				/>
			</div>
		</div>
	)
}
