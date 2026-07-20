import type { ProDashboardProtocolCatalog } from '../protocolCatalog'
import {
	getAdvancedTvlBreakdownSources,
	getBorrowedBreakdownQueryKey,
	getBorrowedBreakdownSources,
	getProtocolTvlBreakdownQueryKey,
	shouldSuppressAdvancedTvlTokenBreakdown,
	shouldSuppressBorrowedTokenBreakdown,
	type ProtocolTvlBreakdownRequest
} from '../services/protocolTvl'
import type { DashboardItemConfig } from '../types'

export interface ProtocolTvlStreamSource {
	queryKey: ReturnType<typeof getProtocolTvlBreakdownQueryKey>
	request: ProtocolTvlBreakdownRequest
}

export function buildProtocolTvlStreamSourcePlan(
	items: readonly DashboardItemConfig[],
	catalog: ProDashboardProtocolCatalog | null
): ProtocolTvlStreamSource[] {
	const misrepresentedProtocols = new Set<string>()
	for (const protocol of catalog?.protocols ?? []) {
		if (protocol.misrepresentedTokens) misrepresentedProtocols.add(protocol.slug)
	}

	const sources = new Map<string, ProtocolTvlStreamSource>()
	for (const item of items) {
		if (item.kind === 'advanced-borrowed') {
			if (shouldSuppressBorrowedTokenBreakdown(item.chartType, misrepresentedProtocols.has(item.protocol))) continue

			for (const source of getBorrowedBreakdownSources(item.protocol, item.chartType)) {
				const queryKey = getBorrowedBreakdownQueryKey(source.request)
				sources.set(JSON.stringify(queryKey), { queryKey, request: source.request })
			}
		} else if (item.kind === 'advanced-tvl' && item.chartType !== 'tvl') {
			if (shouldSuppressAdvancedTvlTokenBreakdown(item.chartType, misrepresentedProtocols.has(item.protocol))) {
				continue
			}

			for (const source of getAdvancedTvlBreakdownSources(item.protocol, item.chartType, {})) {
				const queryKey = getProtocolTvlBreakdownQueryKey(source.request)
				sources.set(JSON.stringify(queryKey), { queryKey, request: source.request })
			}
		}
	}

	const plan: ProtocolTvlStreamSource[] = []
	for (const source of sources.values()) plan.push(source)
	return plan
}
