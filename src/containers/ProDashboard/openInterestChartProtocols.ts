import { selectOpenInterestProtocols } from '~/containers/ProtocolOverview/openInterestSplit'
import type { ProDashboardProtocolRelations } from './protocolCatalog'

// A parent with options open interest reads each open-interest chart from its catalog children flagged for
// that kind; see openInterestSplit.ts. Returns null for every other chart, which reads the protocol's own.
export function getOpenInterestChartProtocols(
	type: string,
	slug: string,
	relations: ProDashboardProtocolRelations
): Array<string> | null {
	if (type !== 'openInterest' && type !== 'optionsOpenInterest') return null
	const protocol = relations.protocolsBySlug.get(slug)
	const children = protocol ? (relations.childrenByParentId.get(protocol.id) ?? []) : []
	// Metadata sets a parent's flags from its children's.
	const flags = {
		openInterest: children.some((child) => child.openInterest),
		optionsOpenInterest: children.some((child) => child.optionsOpenInterest)
	}
	if (!flags.optionsOpenInterest) return null
	return selectOpenInterestProtocols(
		slug,
		flags,
		children.map((child) => ({ name: child.slug, flags: child })),
		type
	)
}
