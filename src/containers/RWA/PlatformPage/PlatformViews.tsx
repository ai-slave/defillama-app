import { TabPanel } from '~/ui/Tabs'
import type { RWAPlatformKpi } from '../kpi/platformKpi'
import type { RWAPlatformMeta } from './api.types'
import { RWAInformationPanels } from './InformationPanels'
import type { RWAPlatformView } from './view'

/**
 * The view's panels under the strip. The page's `Tabs` provider spans the strip, which holds the view tabs, and these
 * panels. The Information panel stays mounted and only hidden under the table views, so the platform's profile copy is
 * always in the served HTML for crawlers. The view also swaps the chart above the panels (the platform alone, or its
 * breakdown) and hides Group by on Information; those sit outside the panels because they share the strip's layout.
 */
export function RWAPlatformViews({
	meta,
	kpi,
	view,
	renderTable
}: {
	meta: RWAPlatformMeta
	kpi: RWAPlatformKpi
	view: RWAPlatformView
	renderTable: (view: Exclude<RWAPlatformView, 'information'>) => React.ReactNode
}) {
	return (
		<>
			{view === 'information' ? null : <TabPanel value={view}>{renderTable(view)}</TabPanel>}
			<TabPanel value="information">
				<RWAInformationPanels meta={meta} kpi={kpi} />
			</TabPanel>
		</>
	)
}
