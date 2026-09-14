import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo } from 'react'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { SQL_CHART_HEIGHT } from '../chartLayout'
import { readSqlNumber } from '../rowValues'
import { makeValueFormatter } from '../valueFormatters'

const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart'))

interface TreemapChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height?: string
}

export function TreemapChartAdapter({
	config,
	result,
	classified,
	onReady,
	height = SQL_CHART_HEIGHT
}: TreemapChartAdapterProps) {
	const formatter = useMemo(() => makeValueFormatter(config.numberFormat), [config.numberFormat])
	const nameCol = classified.find(
		(column) => column.name === (config.xCol ?? classified.find((c) => c.coarse === 'category')?.name)
	)
	const valueCol = classified.find(
		(column) => column.name === (config.yCols[0] ?? classified.find((c) => c.coarse === 'number')?.name)
	)
	const groupCol = classified.find((c) => c.coarse === 'category' && c.name !== nameCol?.name) ?? null

	const treeData = useMemo(() => {
		return nameCol && valueCol
			? buildSqlTreemapNodes(result.rows, nameCol.index, valueCol.index, groupCol?.index ?? null)
			: []
	}, [result, nameCol, valueCol, groupCol])

	if (!nameCol || !valueCol)
		return (
			<div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-subtle text-sm text-pro-text-secondary">
				Treemap needs a category column and a numeric column.
			</div>
		)

	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center" style={{ height }}>
					<LoadingSpinner size={18} />
				</div>
			}
		>
			<TreemapChart
				treeData={treeData}
				variant="narrative"
				colorMode="categorical"
				height={height}
				valueLabel={valueCol.name}
				valueSymbol={formatter.valueSymbol}
				onReady={onReady}
			/>
		</Suspense>
	)
}

export function buildSqlTreemapNodes(
	rows: Array<Array<unknown>>,
	nameIndex: number,
	valueIndex: number,
	groupIndex: number | null
): Array<TreemapNode> {
	if (groupIndex != null) {
		const grouped = new Map<string, { total: number; items: Array<{ name: string; value: number }> }>()
		for (const row of rows) {
			const value = readSqlNumber(row[valueIndex])
			if (value == null) continue
			const rawGroupName = row[groupIndex]
			const rawItemName = row[nameIndex]
			const groupName = rawGroupName == null ? '∅' : String(rawGroupName)
			const item = { name: rawItemName == null ? '∅' : String(rawItemName), value }
			const group = grouped.get(groupName)
			if (group) {
				group.total += value
				group.items.push(item)
			} else {
				grouped.set(groupName, { total: value, items: [item] })
			}
		}

		const nodes: Array<TreemapNode> = []
		for (const [name, group] of grouped) {
			group.items.sort((a, b) => b.value - a.value)
			nodes.push({
				name,
				value: [group.total, 0, 0],
				children: group.items.map((item) => ({ name: item.name, value: [item.value, 0, 0] }))
			})
		}
		return nodes
	}

	const leaves = new Map<string, number>()
	for (const row of rows) {
		const value = readSqlNumber(row[valueIndex])
		if (value == null) continue
		const rawName = row[nameIndex]
		const name = rawName == null ? '∅' : String(rawName)
		leaves.set(name, (leaves.get(name) ?? 0) + value)
	}
	return [...leaves.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: [value, 0, 0] }))
}
