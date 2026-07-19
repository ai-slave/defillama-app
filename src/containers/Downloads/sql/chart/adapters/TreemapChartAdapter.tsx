import { lazy, Suspense, useMemo } from 'react'
import type { TreemapNode } from '~/components/ECharts/types'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { SQL_CHART_HEIGHT } from '../chartLayout'
import { formatterFromConfig } from '../valueFormatters'

interface ITreemapChartShim {
	treeData: TreemapNode[]
	variant: 'narrative' | 'rwa'
	colorMode?: 'value' | 'categorical'
	height?: string
	valueLabel?: string
	valueSymbol?: string
	onReady?: (instance: any) => void
}

const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as unknown as React.FC<ITreemapChartShim>

interface TreemapChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: ClassifiedColumn[]
	onReady?: (instance: any) => void
}

export function TreemapChartAdapter({ config, result, classified, onReady }: TreemapChartAdapterProps) {
	const formatter = formatterFromConfig(config)
	const nameCol = config.xCol ?? classified.find((c) => c.coarse === 'category')?.name ?? null
	const valueCol = config.yCols[0] ?? classified.find((c) => c.coarse === 'number')?.name ?? null
	const groupCol = classified.find((c) => c.coarse === 'category' && c.name !== nameCol)?.name ?? null

	const treeData = useMemo(() => {
		return nameCol && valueCol ? buildSqlTreemapNodes(result.rows, nameCol, valueCol, groupCol) : []
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
				<div className="flex items-center justify-center" style={{ height: SQL_CHART_HEIGHT }}>
					<LoadingSpinner size={18} />
				</div>
			}
		>
			<TreemapChart
				treeData={treeData}
				variant="narrative"
				colorMode="categorical"
				height={SQL_CHART_HEIGHT}
				valueLabel={valueCol}
				valueSymbol={formatter.valueSymbol}
				onReady={onReady}
			/>
		</Suspense>
	)
}

export function buildSqlTreemapNodes(
	rows: Record<string, unknown>[],
	nameCol: string,
	valueCol: string,
	groupCol: string | null
): TreemapNode[] {
	if (groupCol) {
		const grouped = new Map<string, { total: number; items: Array<{ name: string; value: number }> }>()
		for (const row of rows) {
			const value = toNumber(row[valueCol])
			if (value == null) continue
			const groupName = row[groupCol] == null ? '∅' : String(row[groupCol])
			const item = { name: row[nameCol] == null ? '∅' : String(row[nameCol]), value }
			const group = grouped.get(groupName)
			if (group) {
				group.total += value
				group.items.push(item)
			} else {
				grouped.set(groupName, { total: value, items: [item] })
			}
		}

		const nodes: TreemapNode[] = []
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
		const value = toNumber(row[valueCol])
		if (value == null) continue
		const name = row[nameCol] == null ? '∅' : String(row[nameCol])
		leaves.set(name, (leaves.get(name) ?? 0) + value)
	}
	return [...leaves.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: [value, 0, 0] }))
}

function toNumber(v: unknown): number | null {
	if (typeof v === 'number') return Number.isFinite(v) ? v : null
	if (typeof v === 'bigint') return Number(v)
	if (typeof v === 'string') {
		const n = Number(v.trim())
		return Number.isFinite(n) ? n : null
	}
	return null
}
