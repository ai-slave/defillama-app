import { useQueries } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { chartNeedsGeckoId } from '../../chartSource'
import type { TimePeriod } from '../../dashboardTypes'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { buildProDashboardParentMapping, buildProtocolSymbolMap } from '../../protocolCatalog'
import {
	filterDataByTimePeriod,
	getChartCardQueryKey,
	getChartQueryFn,
	ProxyAuthTokenContext,
	StreamDoneContext
} from '../../queries'
import type { ChartConfig } from '../../types'
import { groupData } from '../../utils'

const EMPTY_SERIES: [number, number][] = []

export function isComposerItemQueryEnabled(streamDone: boolean, item: ChartConfig) {
	const itemType = item.protocol ? 'protocol' : 'chain'
	const itemName = item.protocol || item.chain || ''
	return streamDone && !!itemName && !!item.type && (!chartNeedsGeckoId(item.type, itemType) || !!item.geckoId)
}

export function useComposerItemsData(composerItems: ChartConfig[], timePeriod: TimePeriod) {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const { protocols } = useProDashboardCatalog()
	const protocolSymbols = useMemo(() => buildProtocolSymbolMap(protocols), [protocols])
	const parentMapping = useMemo(() => buildProDashboardParentMapping(protocols), [protocols])
	const queries = useQueries({
		queries: composerItems.map((item) => {
			const itemType = item.protocol ? 'protocol' : 'chain'
			const itemName = item.protocol || item.chain || ''

			return {
				queryKey: getChartCardQueryKey(item),
				queryFn: getChartQueryFn(
					item.type,
					itemType,
					itemName,
					item.geckoId,
					undefined,
					parentMapping,
					undefined,
					item.dataType,
					authToken,
					itemType === 'protocol' ? protocolSymbols : undefined
				),
				staleTime: 5 * 60 * 1000,
				enabled: isComposerItemQueryEnabled(streamDone, item),
				select: (data: [number, number][]) => filterDataByTimePeriod(data, timePeriod || 'all')
			}
		})
	})

	const itemsWithData = useMemo(() => {
		return composerItems.map((item, index) => {
			const queryResult = queries[index]
			const rawData = queryResult?.data ?? EMPTY_SERIES

			const shouldGroup = item.grouping && item.grouping !== 'day'
			const groupedData = shouldGroup && rawData.length > 0 ? groupData(rawData, item.grouping) : rawData

			return {
				...item,
				data: groupedData,
				isLoading: queryResult?.isLoading || false,
				hasError: queryResult?.isError || false
			}
		})
	}, [composerItems, queries])

	return itemsWithData
}
