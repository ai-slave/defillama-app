import type { ChartCsvDataset } from '~/components/ChartExport/ChartCsvExportButton'
import type { TreemapNode } from './types'

/** Flatten treemap leaves once; parent nodes are presentation totals, not additional rows. */
export function buildTreemapCsvDataset(treeData: ReadonlyArray<TreemapNode>): ChartCsvDataset {
	const source: Array<[path: string, name: string, value: number]> = []
	const visit = (node: TreemapNode, parentNames: ReadonlyArray<string>) => {
		const names = [...parentNames, node.name]
		if (node.children?.length) {
			for (const child of node.children) visit(child, names)
			return
		}
		source.push([node.path ?? names.join('/'), node.name, node.value[0]])
	}
	for (const node of treeData) visit(node, [])
	return { dimensions: ['Path', 'Name', 'Value'], source }
}
