import type { RWAPlatformKpi } from '../kpi/platformKpi'
import type { RWAPlatformMeta } from './api.types'
import { RWAInformationPanels } from './InformationPanels'
import type { RWAPlatformView } from './view'

/**
 * The view's content under the strip. The strip owns the switch (PlatformViewSwitch); this mounts what it selects.
 * The panels stay mounted and only hidden under the table views, so the platform's profile copy is always in the
 * served HTML for crawlers.
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
			{view === 'information' ? null : renderTable(view)}
			<div hidden={view !== 'information'}>
				<RWAInformationPanels meta={meta} kpi={kpi} />
			</div>
		</>
	)
}
