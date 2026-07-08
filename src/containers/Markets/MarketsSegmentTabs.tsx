import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { SEGMENTS, type Segment } from './segments'

interface MarketsSegmentTabsProps {
	activeSegment: Segment
	onChange: (segment: Segment) => void
	/** optional per-segment subtitle, e.g. "412 assets · $1.2B" */
	subtitleFor?: (segment: Segment) => string | null
	/** when provided, only these segments are shown (e.g. hide inverse perp when a venue has none) */
	availableSegments?: ReadonlyArray<Segment>
}

export function MarketsSegmentTabs({
	activeSegment,
	onChange,
	subtitleFor,
	availableSegments
}: MarketsSegmentTabsProps) {
	const tabs = availableSegments ? SEGMENTS.filter((s) => availableSegments.includes(s.id)) : SEGMENTS
	if (tabs.length === 0) return null
	return (
		<div className={tabTrackStyles} role="tablist" aria-label="Market segment">
			{tabs.map((segment) => {
				const isActive = segment.id === activeSegment
				const subtitle = subtitleFor?.(segment.id) ?? null
				return (
					<TabLink
						as="button"
						key={segment.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						data-active={isActive}
						onClick={() => onChange(segment.id)}
						className="flex flex-col items-start gap-0.5"
					>
						<span data-active={isActive} className="label-sm text-secondary uppercase data-[active=true]:text-primary">
							{segment.label}
						</span>
						{subtitle ? <span className="font-jetbrains label-sm text-secondary">{subtitle}</span> : null}
					</TabLink>
				)
			})}
		</div>
	)
}
