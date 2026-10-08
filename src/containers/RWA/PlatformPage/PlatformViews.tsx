import type { RWAPlatformKpi } from '../kpi/platformKpi'
import type { RWAPlatformMeta } from './api.types'
import { RWAInformationPanels } from './InformationPanels'
import { CompliancePanel } from './panels/Compliance'
import type { RWAEntityView } from './view'

/**
 * The view's content under the strip: Information, or the list with the table (its column set, Compliance included,
 * is the table's own switch). The view tabs are links in the page's top row (layout/pageTabs.ts). The Information
 * panels stay mounted and only hidden under the list, so the platform's profile copy is always in the served HTML for
 * crawlers. The view also swaps the chart above the panels (the platform alone, or its
 * breakdown) and hides Group by on Information; those sit outside the panels because they share the strip's layout.
 */
export function RWAPlatformViews({
	meta,
	kpi,
	view,
	perpsVenueHref = null,
	renderTable
}: {
	meta: RWAPlatformMeta
	kpi: RWAPlatformKpi
	view: RWAEntityView
	/** The platform's venue page when it also runs a live perps venue. */
	perpsVenueHref?: string | null
	renderTable: () => React.ReactNode
}) {
	return (
		<>
			{view === 'information' ? null : renderTable()}
			<div hidden={view !== 'information'}>
				<RWAInformationPanels
					meta={meta}
					issuers={kpi.issuersByMcap}
					crossLink={perpsVenueHref ? { label: 'Perps on the venue page', href: perpsVenueHref } : null}
					slot={<CompliancePanel meta={meta} kpi={kpi} />}
				/>
			</div>
		</>
	)
}
