import type { ReactNode } from 'react'
import { ReportIncorrectData } from '~/components/ReportIncorrectData'
import { Card } from '~/ui/Card'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { formattedNum } from '~/utils'
import { MetadataFieldValue } from './MetadataGroups'
import { fractionChange, sumNullable } from './modelHelpers'
import {
	EXCHANGE_SEGMENT_LABELS,
	EXCHANGE_SEGMENTS,
	type ExchangeProfileModel,
	type ExchangeProfileSegmentModel
} from './models'
import { ProfileIdentity } from './ProfileIdentity'
import { SEGMENT_DEFINITIONS } from './segmentPresentation'

const money = (value: number | null) => (value == null ? '–' : formattedNum(value, true))
const count = (value: number | null) => (value == null ? '–' : formattedNum(value))

function ChangePct({ value }: { value: number }) {
	return (
		<span className={`label-sm ${value >= 0 ? 'text-data-up' : 'text-data-down'}`}>
			{value >= 0 ? '+' : ''}
			{(value * 100).toFixed(1)}%
		</span>
	)
}

interface SegmentValue {
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

export function ProfileMetrics({ profile }: { profile: ExchangeProfileModel }) {
	const segments = Object.values(profile.segments)

	// Grand total across all segments; perpetual classes are otherwise never combined.
	const totalVolume = sumNullable(segments.map((segment) => segment.volume24h))
	const volumeChange = fractionChange(totalVolume, sumNullable(segments.map((segment) => segment.volumePrevious24h)))

	const segmentValues = (select: (segment: ExchangeProfileSegmentModel) => number | null) =>
		EXCHANGE_SEGMENTS.flatMap((segmentId) => {
			const segment = profile.segments[segmentId]
			const value = segment ? select(segment) : null
			if (value == null) return []
			return [
				{
					label: EXCHANGE_SEGMENT_LABELS[segmentId],
					tooltip: SEGMENT_DEFINITIONS[segmentId].description,
					value
				}
			]
		})

	const volumeBySegment = segmentValues((segment) => segment.volume24h)
	const openInterestBySegment = segmentValues((segment) => segment.openInterestUsd)
	const depthBySegment = segmentValues((segment) => segment.depth2Usd)
	const marketsBySegment = segmentValues((segment) => segment.marketCount)

	const totalDepth = sumNullable(segments.map((segment) => segment.depth2Usd))
	const totalMarkets = sumNullable(segments.map((segment) => segment.marketCount))

	// Other KPIs (EU/MiCA/reserves/fees/leverage) duplicate the computed rows above or the Information tab.
	const tokenKpi = profile.metadata.kpis.find((kpi) => kpi.key === 'native_token')
	const supportsOpenInterest = segments.some((segment) => segment.capabilities.openInterest)

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-6 xl:min-h-[360px]">
			<ProfileIdentity profile={profile} />

			<div className="flex flex-col">
				<span className="body-sm text-secondary">24h Volume</span>
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
				{tokenKpi ? (
					<MetricRow
						label="Token"
						value={<MetadataFieldValue field={tokenKpi} />}
						valueClassName="ml-auto text-right"
					/>
				) : null}
			</div>

			<ReportIncorrectData subject={{ type: 'exchange', name: profile.name, slug: profile.slug }} />
		</Card>
	)
}
