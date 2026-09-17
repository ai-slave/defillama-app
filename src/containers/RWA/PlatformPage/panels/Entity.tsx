import type { RWAPlatformMeta } from '../api.types'
import { getRwaLeadership, getRwaRegulationFacts, getRwaSourceGroups, hasRwaEntityContent } from './panelData'
import { LabelledProse, LinkPills, PanelCard, PanelRow, Pill } from './PanelParts'

/** Who is behind the platform: the entity facts, the leadership, the structure and registry prose, the source link. */
export function EntityPanel({ meta }: { meta: RWAPlatformMeta }) {
	if (!hasRwaEntityContent(meta)) return null
	const facts = getRwaRegulationFacts(meta)
	const leadership = getRwaLeadership(meta)
	const sources = getRwaSourceGroups(meta)

	return (
		<PanelCard title="Entity">
			{facts.length > 0 ? (
				<div className="flex flex-col">
					{facts.map((fact) => (
						<PanelRow key={fact.label} label={fact.label}>
							{fact.value}
						</PanelRow>
					))}
				</div>
			) : null}
			{leadership.length > 0 ? (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="label-md text-secondary">Leadership:</span>
					{leadership.map((person) => (
						<Pill key={person.name}>{person.role ? `${person.name}, ${person.role}` : person.name}</Pill>
					))}
				</div>
			) : null}
			<LabelledProse label="Entity structure" text={meta.entityStructureNotes} />
			<LabelledProse label="Registry" text={meta.issuerRegistryInfo} />
			<LinkPills groups={sources} />
		</PanelCard>
	)
}
