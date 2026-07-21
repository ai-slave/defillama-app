import type * as echarts from 'echarts/core'

type TreemapFocusChart = echarts.ECharts & {
	__llamaTreemapFocusNode?: { id: string; path?: string[]; indexPath?: number[] }
	__llamaTreemapFocusNodeId?: string
}

interface TreemapClickParams {
	dataIndex?: number
	seriesIndex?: number
	seriesType?: string
}

interface TreemapTreeNode {
	name?: string
	getId?: () => unknown
	getChildIndex?: () => number
	getAncestors?: (includeSelf: boolean) => TreemapTreeNode[]
}

type TreemapModelAccess = {
	getModel?: () => {
		getSeriesByIndex?: (seriesIndex: number) => {
			getData?: () => {
				tree?: { getNodeByDataIndex?: (dataIndex: number | undefined) => TreemapTreeNode | undefined }
			}
		}
	}
}

export function clearTreemapFocus(instance: echarts.ECharts) {
	const chart = instance as TreemapFocusChart
	delete chart.__llamaTreemapFocusNode
	delete chart.__llamaTreemapFocusNodeId
}

/** Track the drilled node so PNG export can reproduce the visible treemap viewport. */
export function registerTreemapFocusTracking(instance: echarts.ECharts) {
	const handleClick = (params: TreemapClickParams) => {
		if (params?.seriesType !== 'treemap') return
		// Treemap drill state is only exposed through ECharts' private model API.
		const node = (instance as unknown as TreemapModelAccess)
			.getModel?.()
			?.getSeriesByIndex?.(params.seriesIndex ?? 0)
			?.getData?.()
			?.tree?.getNodeByDataIndex?.(params.dataIndex)
		const nodeId = node?.getId?.()
		if (typeof nodeId !== 'string' || !nodeId) return

		const ancestors = node?.getAncestors?.(true)
		const path: string[] = []
		const indexPath: number[] = []
		if (Array.isArray(ancestors)) {
			for (let index = 0; index < ancestors.length; index++) {
				const ancestor = ancestors[index]
				if (typeof ancestor?.name === 'string' && ancestor.name) path.push(ancestor.name)
				if (index > 0) {
					const childIndex = ancestor?.getChildIndex?.()
					if (typeof childIndex === 'number' && childIndex >= 0) indexPath.push(childIndex)
				}
			}
		}

		;(instance as TreemapFocusChart).__llamaTreemapFocusNode = {
			id: nodeId,
			...(path.length > 0 ? { path } : {}),
			...(indexPath.length > 0 && indexPath.length === Math.max(0, ancestors?.length - 1) ? { indexPath } : {})
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
