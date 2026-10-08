import type { RwaNamedBar } from '../cards/cardData'
import type { RWAPlatformMeta } from './api.types'
import { AboutPanel } from './panels/About'
import { EntityPanel } from './panels/Entity'
import { FeesRevenuePanel } from './panels/FeesRevenue'
import { MilestonesPanel } from './panels/Milestones'
import type { RWAAboutCrossLink } from './panels/panelData'
import { RegulationPanel } from './panels/Regulation'

/** The Information view of a platform or a venue: six panels in a three-column grid, each rendered when it has one line
    to say. Who the entity is on the first row (About, Entity, Regulation), how it operates on the second; `slot` is the
    fourth panel (Compliance on a platform, Markets on a venue). A venue the index has no row for has no profile, so
    only the slot draws. */
export function RWAInformationPanels({
	meta,
	issuers,
	crossLink,
	slot
}: {
	meta: RWAPlatformMeta | null
	issuers: Array<RwaNamedBar>
	crossLink: RWAAboutCrossLink | null
	slot: React.ReactNode
}) {
	return (
		<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
			{meta ? (
				<>
					<AboutPanel meta={meta} issuers={issuers} crossLink={crossLink} />
					<EntityPanel meta={meta} />
					<RegulationPanel meta={meta} />
				</>
			) : null}
			{slot}
			{meta ? (
				<>
					<FeesRevenuePanel meta={meta} />
					<MilestonesPanel meta={meta} />
				</>
			) : null}
		</div>
	)
}
