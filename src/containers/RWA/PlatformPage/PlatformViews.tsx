import { Card } from '~/ui/Card'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TabPanel, Tabs } from '~/ui/Tabs'
import type { RWAPlatformKpi } from '../kpi/platformKpi'
import type { RWAPlatformMeta } from './api.types'
import { RWAInformationPanels } from './InformationPanels'
import { CompliancePanel } from './panels/Compliance'
import { getRwaEntityViewOptions, RWA_ENTITY_VIEWS, type RWAEntityView } from './view'

const PLATFORM_VIEW_OPTIONS = getRwaEntityViewOptions('platform')

/**
 * A protocol's RWA tab has no top tab row, so its views are panel tabs: this switch, in its own card above the strip,
 * and the `tabs` panels of RWAPlatformViews below. The provider spans everything between, the strip, Key Metrics and
 * the chart, which the view also swaps; the switch stays mounted across a view change, so it keeps focus.
 */
export function RWAPlatformViewTabs({
	view,
	onViewChange,
	children
}: {
	view: RWAEntityView
	onViewChange: (view: RWAEntityView) => void
	children: React.ReactNode
}) {
	return (
		<Tabs value={view} values={RWA_ENTITY_VIEWS} onValueChange={onViewChange}>
			<Card padding="sm">
				<SegmentedControl
					semantics="tabs"
					options={PLATFORM_VIEW_OPTIONS}
					label="Platform view"
					variant="default"
					size="md"
				/>
			</Card>
			{children}
		</Tabs>
	)
}

/**
 * The view's content under the strip: Information, or the list with the table (its column set, Compliance included,
 * is the table's own switch). On a platform page the view tabs are links in the page's top row (layout/pageTabs.ts);
 * in a protocol's RWA tab (`tabs`) they are RWAPlatformViewTabs, and these are its tab panels. The Information panels
 * stay mounted and only hidden under the list, so the platform's profile copy is always in the served HTML for
 * crawlers. The view also swaps the chart above the panels (the platform alone, or its breakdown) and hides Group by on
 * Information; those sit outside the panels because they share the strip's layout.
 */
export function RWAPlatformViews({
	meta,
	kpi,
	view,
	tabs,
	perpsVenueHref = null,
	renderTable
}: {
	meta: RWAPlatformMeta
	kpi: RWAPlatformKpi
	view: RWAEntityView
	tabs: boolean
	/** The platform's venue page when it also runs a live perps venue. */
	perpsVenueHref?: string | null
	renderTable: () => React.ReactNode
}) {
	const information = (
		<RWAInformationPanels
			meta={meta}
			issuers={kpi.issuersByMcap}
			crossLink={perpsVenueHref ? { label: 'Perps on the venue page', href: perpsVenueHref } : null}
			slot={<CompliancePanel meta={meta} kpi={kpi} />}
		/>
	)
	if (tabs) {
		return (
			<>
				{view === 'information' ? null : <TabPanel value="list">{renderTable()}</TabPanel>}
				<TabPanel value="information">{information}</TabPanel>
			</>
		)
	}
	return (
		<>
			{view === 'information' ? null : renderTable()}
			<div hidden={view !== 'information'}>{information}</div>
		</>
	)
}
