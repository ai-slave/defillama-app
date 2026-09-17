import type { RWAPlatformKpi } from '../kpi/platformKpi'
import type { RWAPlatformMeta } from './api.types'
import { AboutPanel } from './panels/About'
import { CompliancePanel } from './panels/Compliance'
import { EntityPanel } from './panels/Entity'
import { FeesRevenuePanel } from './panels/FeesRevenue'
import { MilestonesPanel } from './panels/Milestones'
import { RegulationPanel } from './panels/Regulation'

/** The Information view: six panels in a three-column grid, each rendered when it has one line to say.
    Who the platform is on the first row (About, Entity, Regulation), how it operates on the second. */
export function RWAInformationPanels({ meta, kpi }: { meta: RWAPlatformMeta; kpi: RWAPlatformKpi }) {
	return (
		<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
			<AboutPanel meta={meta} kpi={kpi} />
			<EntityPanel meta={meta} />
			<RegulationPanel meta={meta} />
			<CompliancePanel meta={meta} kpi={kpi} />
			<FeesRevenuePanel meta={meta} />
			<MilestonesPanel meta={meta} />
		</div>
	)
}
