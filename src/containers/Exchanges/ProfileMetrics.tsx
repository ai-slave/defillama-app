import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { ReportIncorrectData } from '~/components/ReportIncorrectData'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { fractionChange, sumNullable } from './modelHelpers'
import {
	EXCHANGE_SEGMENT_LABELS,
	EXCHANGE_SEGMENTS,
	type ExchangeProfileModel,
	type ExchangeProfileSegmentModel,
	type ExchangeSegment
} from './models'
import { ProfileIdentity } from './ProfileIdentity'
import { SEGMENT_DEFINITIONS } from './segmentPresentation'

const money = (value: number | null) =>
	value == null ? '–' : formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
const count = (value: number | null) =>
	value == null ? '–' : formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })

function ChangePct({ value }: { value: number }) {
	return (
		<span className={`label-sm ${value >= 0 ? 'text-data-up' : 'text-data-down'}`}>
			{value >= 0 ? '+' : ''}
			{formatPercent(value, {
				input: 'fraction',
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
				useGrouping: false
			})}
		</span>
	)
}

interface SegmentValue {
	segment: ExchangeSegment
	label: string
	tooltip: string
	value: number
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
	segments: SegmentValue[]
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
	countrySegments?: ExchangeSegment[] | null
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
		const values: SegmentValue[] = []
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

	const totalDepth = sumNullable(segments.map((segment) => segment.depth2Usd))
	const totalMarkets = sumNullable(segments.map((segment) => segment.marketCount))

	// Other KPIs (EU/MiCA/reserves/fees/leverage) duplicate the computed rows above or the Information tab.
	const supportsOpenInterest = segments.some((segment) => segment.capabilities.openInterest)

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-6 xl:min-h-[360px]">
			<ProfileIdentity profile={profile} />

			<div className="flex flex-col">
				<span className="body-sm text-secondary">24h Volume{showGlobalLabel ? ' · Global' : ''}</span>
				<span className="flex flex-wrap items-baseline gap-2">
					<span className="min-h-8 font-jetbrains text-2xl font-semibold">{money(totalVolume)}</span>
					{volumeChange != null ? <ChangePct value={volumeChange} /> : null}
				</span>
			</div>

			<div className="flex flex-col">
				{volumeBySegment.map((segment) => (
					<MetricRow
						key={segment.label}
						label={`${segment.label} volume`}
						tooltip={segment.tooltip}
						value={money(segment.value)}
					/>
				))}
				{supportsOpenInterest
					? openInterestBySegment.map((segment) => (
							<MetricRow
								key={segment.label}
								label={`${segment.label} open interest`}
								tooltip={segment.tooltip}
								value={money(segment.value)}
							/>
						))
					: null}
				{totalDepth != null ? (
					<BreakdownMetric label="Depth ±2%" total={totalDepth} segments={depthBySegment} render={money} />
				) : null}
				<BreakdownMetric label="Markets" total={totalMarkets} segments={marketsBySegment} render={count} />
				{profile.nativeToken ? (
					<MetricRow
						label="Native token"
						className="items-center"
						value={
							<BasicLink
								href={profile.nativeToken.url}
								className="flex items-center justify-end gap-1.5 hover:underline"
							>
								<TokenLogo
									src={profile.nativeToken.coinId ? geckoTokenIconUrl(profile.nativeToken.coinId, 20) : null}
									size={20}
									alt={`${profile.nativeToken.name} logo`}
								/>
								<span>{profile.nativeToken.symbol}</span>
								{profile.nativeToken.priceUsd != null ? <span>{money(profile.nativeToken.priceUsd)}</span> : null}
								{profile.nativeToken.change24h != null ? (
									<span className={profile.nativeToken.change24h >= 0 ? 'text-data-up' : 'text-data-down'}>
										({profile.nativeToken.change24h >= 0 ? '+' : ''}
										{formatPercent(profile.nativeToken.change24h, {
											input: 'percent',
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
											useGrouping: false
										})}
										)
									</span>
								) : null}
							</BasicLink>
						}
						valueClassName="ml-auto text-right"
					/>
				) : null}
			</div>

			<ReportIncorrectData subject={{ type: 'exchange', name: profile.name, slug: profile.slug }} />
		</Card>
	)
}
