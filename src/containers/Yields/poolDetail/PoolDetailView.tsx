import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { hasPart } from '../domain/apyPresentation'
import { fmtLtv, fmtPct, fmtUsd, scoreValue } from './format'
import { HoldersPanel } from './HoldersPanel'
import { PoolApyChart } from './PoolApyChart'
import type { PoolChartModel } from './poolCharts'
import { PoolHeader, PoolMetaInfo } from './PoolHeader'
import type { DetailChain, DetailHolders, DetailProtocol, PoolHistoryRange } from './types'

type ApyKind = 'supply' | 'borrow'

export interface ApyBreakdown {
	total: number | null
	base: number | null
	reward: number | null
	intrinsic: number | null
	rewardTokens: string[]
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
	metrics: PoolMetric[]
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
		assets: string[]
	}
}

function apyParts(apy: ApyBreakdown, kind: ApyKind) {
	const parts: { key: string; label: string; value: string; strong: boolean }[] = []
	if (apy.base != null) {
		parts.push({
			key: 'base',
			label: kind === 'borrow' ? 'Base cost' : 'Base',
			value: `${fmtPct(apy.base)}%`,
			strong: false
		})
	}
	if (hasPart(apy.reward)) {
		const sign = kind === 'borrow' ? '−' : '+'
		const syms = apy.rewardTokens.length ? ` · ${apy.rewardTokens.join(', ')}` : ''
		parts.push({
			key: 'reward',
			label: `Reward${syms}`,
			value: `${sign}${fmtPct(Math.abs(apy.reward))}%`,
			strong: true
		})
	}
	if (hasPart(apy.intrinsic)) {
		const src = apy.intrinsicSource ? ` · ${apy.intrinsicSource}` : ''
		parts.push({
			key: 'intrinsic',
			label: `Intrinsic${src}`,
			value: `+${fmtPct(Math.abs(apy.intrinsic))}%`,
			strong: false
		})
	}
	return parts
}

const VALUE_CLS = 'ml-auto mono-md-bold'
const SUB_VALUE_CLS = 'ml-auto mono-md'

function SideBlock({ side, kind, children }: { side: PoolSide; kind: ApyKind; children?: React.ReactNode }) {
	const parts = hasPart(side.apy.reward) || hasPart(side.apy.intrinsic) ? apyParts(side.apy, kind) : []
	const total = fmtPct(side.apy.total)
	const apyValue = total === '—' ? '—' : `${total}%`
	return (
		<>
			{parts.length ? (
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
					value={m.format === 'ltv' ? fmtLtv(m.value) : fmtUsd(m.value)}
					valueClassName={VALUE_CLS}
				/>
			))}
			{children}
		</>
	)
}

export function PoolDetailView({
	poolId,
	mode,
	hasRisk,
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
					{supplyChart ? (
						<PoolApyChart
							key={`${poolId}:supply`}
							model={supplyChart}
							poolId={poolId}
							kind="supply"
							initialRange={initialRange}
						/>
					) : null}
					{borrowChart ? (
						<PoolApyChart
							key={`${poolId}:borrow`}
							model={borrowChart}
							poolId={poolId}
							kind="borrow"
							initialRange={initialRange}
						/>
					) : null}
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
