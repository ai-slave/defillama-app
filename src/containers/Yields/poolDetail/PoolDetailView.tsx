import { useRouter } from 'next/router'
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
import { hasPart } from '../domain/apyPresentation'
import { useStickyPrefsOverlay, useStickyQueryReplace } from '../useStickyQueryReplace'
import { scoreValue, YIELD_PERCENT_OPTIONS } from './format'
import { HoldersPanel } from './HoldersPanel'
import { PoolApyChart } from './PoolApyChart'
import type { PoolChartModel } from './poolCharts'
import { PoolHeader, PoolMetaInfo } from './PoolHeader'
import { POOL_CHART_PREFS } from './queryState'
import type { DetailChain, DetailHolders, DetailProtocol, PoolHistoryRange } from './types'

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
	initialRange: PoolHistoryRange
	symbol: string
	name: string
	protocol: DetailProtocol
	chain: DetailChain
	supply: PoolSide | null
	borrow: PoolSide | null
	stability: StabilityInfo | null
	supplyChart: PoolChartModel | null
	borrowChart: PoolChartModel | null
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

function SideBlock({ side, kind, children }: { side: PoolSide; kind: ApyKind; children?: React.ReactNode }) {
	const parts = hasPart(side.apy.reward) || hasPart(side.apy.intrinsic) ? apyParts(side.apy, kind) : []
	const apyValue = side.apy.total == null ? '—' : formatPercent(side.apy.total, YIELD_PERCENT_OPTIONS)
	return (
		<>
			{parts.length > 0 ? (
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
	symbol,
	name,
	protocol,
	chain,
	supply,
	borrow,
	stability,
	supplyChart,
	borrowChart,
	holders,
	details
}: PoolDetailViewProps) {
	// Restore both charts together before mounting to avoid competing replaces and default flashes.
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
			<div className="grid grid-cols-1 gap-2 @min-[90rem]:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
				<Card padding="sm" className="flex flex-col gap-3">
					<PoolHeader symbol={symbol} name={name} protocol={protocol} chain={chain} />

					{supply || borrow ? (
						<div className="grid grid-cols-1 gap-x-6 border-t border-subtle pt-1 @min-[40rem]:grid-cols-2 @min-[80rem]:grid-cols-3 @min-[90rem]:grid-cols-1">
							{supply ? (
								<SideBlock side={supply} kind="supply">
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

				<div className="flex min-w-0 flex-col gap-2">
					{(
						[
							['supply', supplyChart],
							['borrow', borrowChart]
						] as const
					).map(([kind, model]) =>
						model ? (
							preferencesReady ? (
								<PoolApyChart
									key={`${poolId}:${kind}`}
									model={model}
									poolId={poolId}
									kind={kind}
									initialRange={initialRange}
								/>
							) : (
								<PoolChartPlaceholder key={kind} title={model.title} />
							)
						) : null
					)}
					{!supplyChart && !borrowChart ? (
						<Card padding="md" className="flex min-h-24 flex-1 items-center justify-center">
							<p className="text-center body-sm text-tertiary">No history available for this pool yet.</p>
						</Card>
					) : null}
				</div>
			</div>

			{holders ? (
				<HoldersPanel holders={holders} chain={chain.name} tvlUsd={tvlUsd} poolId={poolId} exportTitle={exportTitle} />
			) : null}
		</div>
	)
}
