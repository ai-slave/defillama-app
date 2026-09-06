import type { ChartSeries } from '~/utils/breakdowns'

export type ProTreemapValueMode = 'latest' | 'sum7d' | 'sum30d'

export interface ProTreemapNode {
	name: string
	value: number
	itemStyle: { color: string }
}

export function buildProTreemapData(
	series: Array<ChartSeries>,
	valueMode: ProTreemapValueMode,
	resolveColor: (name: string, fallback?: string) => string
): Array<ProTreemapNode> {
	const nodes: Array<ProTreemapNode> = []
	const windowSeconds = valueMode === 'sum7d' ? 7 * 86_400 : 30 * 86_400
	const startOfTodayUtc = Math.floor(Date.now() / 86_400_000) * 86_400

	for (const item of series) {
		const lastPoint = item.data[item.data.length - 1]
		if (!lastPoint) continue
		const pointIndex = lastPoint[0] >= startOfTodayUtc ? item.data.length - 2 : item.data.length - 1
		if (pointIndex < 0) continue
		const point = item.data[pointIndex]
		if (!point) continue

		let value = point[1]
		if (valueMode !== 'latest') {
			value = 0
			const windowStart = point[0] - windowSeconds + 1
			// Series are ascending; only visit the tail that can contribute to this window.
			for (let i = pointIndex; i >= 0 && item.data[i][0] >= windowStart; i--) {
				value += item.data[i][1]
			}
		}

		if (value <= 0) continue
		nodes.push({
			name: item.name,
			value,
			itemStyle: { color: resolveColor(item.name, item.color) }
		})
	}

	return nodes
}
