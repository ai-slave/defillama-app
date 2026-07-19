import type * as echarts from 'echarts/core'

type TreemapFocusChart = echarts.ECharts & {
	__llamaTreemapFocusNode?: { id: string; path?: string[] }
	__llamaTreemapFocusNodeId?: string
}

export function clearTreemapFocus(instance: echarts.ECharts) {
	const chart = instance as TreemapFocusChart
	delete chart.__llamaTreemapFocusNode
	delete chart.__llamaTreemapFocusNodeId
}

/** Track the drilled node so PNG export can reproduce the visible treemap viewport. */
export function registerTreemapFocusTracking(instance: echarts.ECharts) {
	const handleClick = (params: any) => {
		if (params?.seriesType !== 'treemap') return
		const node = (instance as any)
			.getModel?.()
			?.getSeriesByIndex?.(params.seriesIndex ?? 0)
			?.getData?.()
			?.tree?.getNodeByDataIndex?.(params.dataIndex)
		const nodeId = node?.getId?.()
		if (typeof nodeId !== 'string' || !nodeId) return

		const ancestors = node?.getAncestors?.(true)
		const path: string[] = []
		if (Array.isArray(ancestors)) {
			for (const ancestor of ancestors) {
				if (typeof ancestor?.name === 'string' && ancestor.name) path.push(ancestor.name)
			}
		}

		;(instance as TreemapFocusChart).__llamaTreemapFocusNode = {
			id: nodeId,
			...(path.length > 0 ? { path } : {})
		}
	}
	const handleRestore = () => clearTreemapFocus(instance)

	instance.on('click', handleClick)
	instance.on('restore', handleRestore)
	return () => {
		instance.off('click', handleClick)
		instance.off('restore', handleRestore)
	}
}
