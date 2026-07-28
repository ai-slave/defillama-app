import type * as echarts from 'echarts/core'

type TreemapFocusNode = { id: string; path?: string[]; indexPath?: number[] }

const TREEMAP_FOCUS_NODE_KEY = '__llamaTreemapFocusNode'
const LEGACY_TREEMAP_FOCUS_NODE_ID_KEY = '__llamaTreemapFocusNodeId'

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

type TreemapGlobalModel = {
	getSeriesByIndex?: (seriesIndex: number) => {
		getData?: () => {
			tree?: { getNodeByDataIndex?: (dataIndex: number | undefined) => TreemapTreeNode | undefined }
		}
	}
}

type TreemapModelAccess = {
	getModel: () => TreemapGlobalModel | undefined
}

function hasTreemapModelAccess(value: object): value is TreemapModelAccess {
	return 'getModel' in value && typeof value.getModel === 'function'
}

export function clearTreemapFocus(instance: echarts.ECharts) {
	Reflect.deleteProperty(instance, TREEMAP_FOCUS_NODE_KEY)
	Reflect.deleteProperty(instance, LEGACY_TREEMAP_FOCUS_NODE_ID_KEY)
}

/** Track the drilled node so PNG export can reproduce the visible treemap viewport. */
export function registerTreemapFocusTracking(instance: echarts.ECharts) {
	const handleClick = (params: TreemapClickParams) => {
		if (params?.seriesType !== 'treemap') return
		// Treemap drill state is only exposed through ECharts' private model API.
		const privateApi: object = instance
		if (!hasTreemapModelAccess(privateApi)) return
		const node = privateApi
			.getModel()
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

		const hasCompleteIndexPath =
			Array.isArray(ancestors) && indexPath.length > 0 && indexPath.length === Math.max(0, ancestors.length - 1)
		const focusNode: TreemapFocusNode = { id: nodeId }
		if (path.length > 0) focusNode.path = path
		if (hasCompleteIndexPath) focusNode.indexPath = indexPath
		Reflect.set(instance, TREEMAP_FOCUS_NODE_KEY, focusNode)
	}
	const handleRestore = () => clearTreemapFocus(instance)

	instance.on('click', handleClick)
	instance.on('restore', handleRestore)
	return () => {
		instance.off('click', handleClick)
		instance.off('restore', handleRestore)
	}
}
