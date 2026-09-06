import { useContext, useMemo } from 'react'
import { getChartDataPrerequisite, toChartRuntimeState, type ChartRuntimeView } from '../../chartRuntime'
import type { TimePeriod } from '../../dashboardTypes'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext, useChartsData } from '../../queries'
import type { ChartConfig } from '../../types'

export function useComposerItemsData(composerItems: Array<ChartConfig>, timePeriod: TimePeriod) {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const { parentMapping, protocolBySlug, protocolCatalog } = useProDashboardCatalog()
	const queries = useChartsData(
		composerItems,
		protocolCatalog,
		protocolBySlug,
		timePeriod,
		null,
		authToken,
		parentMapping
	)

	const itemsWithData = useMemo<Array<ChartRuntimeView>>(() => {
		return queries.map((queryResult, index) => {
			const item = composerItems[index]
			if (!item) throw new Error(`Missing composer chart config at index ${index}`)

			return {
				...item,
				...toChartRuntimeState(queryResult, streamDone, getChartDataPrerequisite(item, protocolCatalog, protocolBySlug))
			}
		})
	}, [composerItems, protocolBySlug, protocolCatalog, queries, streamDone])

	return itemsWithData
}
