import { Fragment, type ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { ReportIncorrectData } from '~/components/ReportIncorrectData'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { Logo } from '~/ui/Logo'
import { MetaLine } from '~/ui/MetaLine'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { StatItem, SummaryChange } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl } from '~/utils/icons'
import {
	formatUsd,
	formatCompactNumber,
	formatPercent,
	formatNumber,
	USD_LOWERCASE_MILLIONS_OPTIONS,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import { TierBadge } from './directoryColumns'
import { fractionChange, sumNullable } from './modelHelpers'
import {
	EXCHANGE_SEGMENT_LABELS,
	EXCHANGE_SEGMENTS,
	type ExchangeProfileModel,
	type ExchangeProfileSegmentModel,
	type ExchangeSegment
} from './models'
import { insideShown, IntraSpread } from './ProfileExecution'
import { ProfileIdentity } from './ProfileIdentity'
import { TierScale } from './ProfileRanking'
import { SEGMENT_DEFINITIONS } from './segmentPresentation'

interface SegmentValue {
	segment: ExchangeSegment
	label: string
	tooltip: string
	value: number
}

// The volume rows explain the number, not the segment (that is the (?) on the tabs).
const VOLUME_TOOLTIPS: Record<ExchangeSegment, string> = {
	spot: 'Last 24h rolling spot volume as reported. Single-counted: halved where the venue counts both sides of a trade.',
	linear_perp:
		'Last 24h rolling USD perp volume as reported. Single-counted: halved where the venue counts both sides of a trade.',
	inverse_perp:
		'Last 24h rolling COIN perp volume as reported. Single-counted: halved where the venue counts both sides of a trade.'
}

/** A metric that expands to an exact per-segment breakdown when more than one segment is present. */
function BreakdownMetric({
	label,
	total,
	segments,
	render
}: {
	label: string
	total: number | null
	segments: Array<SegmentValue>
	render: (value: number | null) => ReactNode
}) {
	if (segments.length < 2) return <MetricRow label={label} value={render(total)} />
	return (
		<MetricSection label={label} value={render(total)}>
			{segments.map((segment) => (
				<SubMetricRow
					key={segment.label}
					label={segment.label}
					tooltip={segment.tooltip}
					value={render(segment.value)}
				/>
			))}
		</MetricSection>
	)
}

export function ProfileMetrics({
	profile,
	countrySegments = null,
	showGlobalLabel = false
}: {
	profile: ExchangeProfileModel
	/**
	 * Segments available in the selected country's region, or null when no
	 * country is selected (or its regional data hasn't loaded / failed). When
	 * set, per-segment volume and open-interest rows for other segments are
	 * hidden; global figures (total volume, depth, markets) stay untouched.
	 */
	countrySegments?: Array<ExchangeSegment> | null
	showGlobalLabel?: boolean
}) {
	const segments = Object.values(profile.segments)
	const segmentVisible = (segmentId: ExchangeSegment) => countrySegments == null || countrySegments.includes(segmentId)

	// Grand total across all segments; perpetual classes are otherwise never combined.
	const totalVolume = sumNullable(segments.map((segment) => segment.volume24h))
	const volumeChange = fractionChange(totalVolume, sumNullable(segments.map((segment) => segment.volumePrevious24h)))

	const segmentValues = (
		select: (segment: ExchangeProfileSegmentModel) => number | null,
		isVisible: (segment: ExchangeSegment) => boolean = () => true
	) => {
		const values: Array<SegmentValue> = []
		for (const segmentId of EXCHANGE_SEGMENTS) {
			if (!isVisible(segmentId)) continue
			const segment = profile.segments[segmentId]
			const value = segment ? select(segment) : null
			if (value != null) {
				values.push({
					segment: segmentId,
					label: EXCHANGE_SEGMENT_LABELS[segmentId],
					tooltip: SEGMENT_DEFINITIONS[segmentId].description,
					value
				})
			}
		}
		return values
	}

	const volumeBySegment = segmentValues((segment) => segment.volume24h, segmentVisible)
	const openInterestBySegment = segmentValues((segment) => segment.openInterestUsd, segmentVisible)
	const depthBySegment = segmentValues((segment) => segment.depth2Usd, segmentVisible)
	const marketsBySegment = segmentValues((segment) => segment.marketCount, segmentVisible)
	// Normalized volume sits directly under its segment's reported volume, as a sub-row: the
	// figure is shown like any other volume, and the percentage is worded as a discount
	// against reported so it never reads as a change over time.
	const nvolRow = (
		segmentId: ExchangeSegment
	): { normalized: number; discount: string | null; tooltip: string } | null => {
		const nvol = profile.normalizedVolume?.[segmentId]
		if (!nvol) return null
		const discount = formatPercent(nvol.discountFraction, { input: 'fraction', maximumFractionDigits: 1 }) ?? '–'
		const basis = segmentId === 'spot' ? 'order book' : 'order book and open interest'
		return {
			normalized: nvol.normalized,
			// No gap → no annotation; the tooltip still states the 0%.
			discount: nvol.discountFraction > 0 ? discount : null,
			tooltip: `The part of the last 24h volume this venue's own ${basis} could support. ${discount} of the reported figure did not pass.${nvol.flag ? ` ${nvol.flag}` : ''}`
		}
	}

	const totalDepth = sumNullable(segments.map((segment) => segment.depth2Usd))
	const totalMarkets = sumNullable(segments.map((segment) => segment.marketCount))

	// Other KPIs (EU/MiCA/reserves/fees/leverage) duplicate the computed rows above or the Information tab.
	const supportsOpenInterest = segments.some((segment) => segment.capabilities.openInterest)

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-6 xl:min-h-[360px]">
			<ProfileIdentity profile={profile} />

			{profile.quality ? (
				<div className="flex flex-col gap-1.5">
					<Tooltip
						content="REAL score: Reserves, Execution, Activity, Liquidity. Breakdown on the Information tab."
						className="w-full"
					>
						<span className="flex w-full items-center gap-2">
							{profile.quality.tier ? <TierBadge tier={profile.quality.tier} /> : null}
							<span className="mono-lg">
								{formatNumber(profile.quality.score, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
							</span>
							<span className="body-sm text-tertiary">/ 100</span>
							<MetaLine className="ml-auto">
								{`#${profile.quality.rankInKind} of ${profile.kind.toUpperCase()}s`}
								{`#${profile.quality.overallRank} overall`}
							</MetaLine>
						</span>
					</Tooltip>
					<TierScale score={profile.quality.score} tier={profile.quality.tier} />
				</div>
			) : null}

			<div className="flex flex-nowrap items-end justify-between gap-8">
				<StatItem
					label={`24h Volume${showGlobalLabel ? ' · Global' : ''}`}
					value={formatUsd(totalVolume, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
					truncate
				/>
				{volumeChange != null ? <SummaryChange value={volumeChange * 100} comparison="vs previous 24h" /> : null}
			</div>

			<div className="flex flex-col">
				{volumeBySegment.map((segment) => {
					const nvol = nvolRow(segment.segment)
					const value = formatUsd(segment.value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'
					// The normalized figure hangs off THIS segment's reported volume with the same
					// tree connector the protocol parent/child switcher draws (vertical bar + tick).
					return (
						<Fragment key={segment.label}>
							<MetricRow label={`${segment.label} volume`} tooltip={VOLUME_TOOLTIPS[segment.segment]} value={value} />
							{nvol ? (
								<SubMetricRow
									className="relative"
									label={
										<>
											<span aria-hidden className="absolute top-0 left-2 h-1/2 w-0.5 bg-border-medium" />
											<span
												aria-hidden
												className="absolute top-1/2 left-2 h-0.5 w-3 -translate-y-1/2 bg-border-medium"
											/>
											<span className="ps-6">Normalized</span>
										</>
									}
									tooltip={nvol.tooltip}
									valueClassName="mono-sm ml-auto"
									value={
										<>
											{formatUsd(nvol.normalized, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
											{nvol.discount ? (
												<span className="ms-1.5 label-xs text-tertiary">{nvol.discount} below reported</span>
											) : null}
										</>
									}
								/>
							) : null}
						</Fragment>
					)
				})}
				{supportsOpenInterest
					? openInterestBySegment.map((segment) => (
							<MetricRow
								key={segment.label}
								label={`${segment.label} open interest`}
								tooltip={segment.tooltip}
								value={formatUsd(segment.value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
							/>
						))
					: null}
				{totalDepth != null ? (
					<BreakdownMetric
						label="Depth ±2%"
						total={totalDepth}
						segments={depthBySegment}
						render={(value: number | null) => formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
					/>
				) : null}
				<BreakdownMetric
					label="Markets"
					total={totalMarkets}
					segments={marketsBySegment}
					render={(value: number | null) => formatCompactNumber(value, NUMBER_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
				/>
				{/* Intra-spread volume per segment, only where it reaches the flag threshold: below it
				    the share is mostly a coarse tick grid or clock jitter, so an honest venue shows no row.
				    Cost, slippage and markouts live on the Markets and Execution tabs. */}
				{EXCHANGE_SEGMENTS.filter(
					(segmentId) =>
						segmentVisible(segmentId) && insideShown(profile.executionBySegment[segmentId]?.insideSpreadPct) != null
				).map((segmentId) => (
					<MetricRow
						key={segmentId}
						label={`${EXCHANGE_SEGMENT_LABELS[segmentId]} intra-spread volume`}
						tooltip="Share of the last 30 days' volume printed inside the spread the order book showed."
						value={<IntraSpread pct={profile.executionBySegment[segmentId]?.insideSpreadPct} />}
					/>
				))}
				{profile.nativeToken ? (
					<MetricRow
						label="Native Token"
						value={
							<BasicLink
								href={profile.nativeToken.url}
								className="flex items-center justify-end gap-1.5 hover:underline"
							>
								<Logo
									src={profile.nativeToken.coinId ? geckoTokenIconUrl(profile.nativeToken.coinId, 20) : null}
									size={20}
									alt={`${profile.nativeToken.name} logo`}
								/>
								<span>{profile.nativeToken.symbol}</span>
								{profile.nativeToken.priceUsd != null ? (
									<span>{formatUsd(profile.nativeToken.priceUsd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}</span>
								) : null}
								<Change value={profile.nativeToken.change24h} />
							</BasicLink>
						}
						valueClassName="mono-md-bold ml-auto self-center"
					/>
				) : null}
			</div>

			<ReportIncorrectData subject={{ type: 'exchange', name: profile.name, slug: profile.slug }} />
		</Card>
	)
}
