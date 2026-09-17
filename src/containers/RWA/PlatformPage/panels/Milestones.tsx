import type { RWAPlatformMeta } from '../api.types'
import { hasRwaMilestones } from './panelData'
import { PanelCard, Prose } from './PanelParts'

/** The dated timeline from the index, or its prose when the dates were never parsed. */
export function MilestonesPanel({ meta }: { meta: RWAPlatformMeta }) {
	if (!hasRwaMilestones(meta)) return null
	return (
		<PanelCard title="Milestones">
			{meta.milestones.length > 0 ? (
				<ol className="flex flex-col gap-3 border-l border-subtle pl-4">
					{meta.milestones.map((milestone) => (
						<li key={`${milestone.date ?? 'undated'}-${milestone.event}`} className="relative flex flex-col">
							<span className="absolute top-1.5 -left-[1.2rem] size-2 rounded-full bg-brand" aria-hidden="true" />
							{milestone.date ? <span className="body-sm text-tertiary">{milestone.date}</span> : null}
							<span className="body-md">{milestone.event}</span>
						</li>
					))}
				</ol>
			) : meta.keyMilestones ? (
				<Prose>{meta.keyMilestones}</Prose>
			) : null}
		</PanelCard>
	)
}
