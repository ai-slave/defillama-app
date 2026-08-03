import { buildProtocolValueChartQueryKey } from '~/containers/ProtocolOverview/valueChartSources'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { ProDashboardProtocolCatalog } from '../protocolCatalog'
import {
	getAdvancedTvlBreakdownSources,
	getBorrowedBreakdownSources,
	shouldSuppressAdvancedTvlTokenBreakdown,
	shouldSuppressBorrowedTokenBreakdown,
	type ProtocolTvlBreakdownRequest
} from '../services/protocolTvl'

export interface ProtocolTvlStreamSource {
	queryKey: ReturnType<typeof buildProtocolValueChartQueryKey>
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
				const queryKey = buildProtocolValueChartQueryKey({ source: 'tvl', ...source.request })
				sources.set(JSON.stringify(queryKey), { queryKey, request: source.request })
			}
		} else if (item.kind === 'advanced-tvl' && item.chartType !== 'tvl') {
			if (shouldSuppressAdvancedTvlTokenBreakdown(item.chartType, misrepresentedProtocols.has(item.protocol))) {
				continue
			}

			for (const source of getAdvancedTvlBreakdownSources(item.protocol, item.chartType, {})) {
				const queryKey = buildProtocolValueChartQueryKey({ source: 'tvl', ...source.request })
				sources.set(JSON.stringify(queryKey), { queryKey, request: source.request })
			}
		}
	}

	const plan: ProtocolTvlStreamSource[] = []
	for (const source of sources.values()) plan.push(source)
	return plan
}
