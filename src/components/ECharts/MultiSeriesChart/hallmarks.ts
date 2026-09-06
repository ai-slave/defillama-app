export function buildHallmarksMarkLine({
	hallmarks,
	textColor,
	dateInMs = false
}: {
	hallmarks: Array<[number, string]>
	textColor: string
	dateInMs?: boolean
}) {
	const sorted = hallmarks.toSorted((a, b) => +a[0] - +b[0])

	return {
		label: {
			position: 'end' as const,
			width: 200,
			color: textColor,
			fontFamily: 'sans-serif',
			overflow: 'truncate' as const,
			rotate: 0,
			distance: 6,
			formatter: (params) => {
				if (params.name) return params.name
				const data = params.data
				if (!data || typeof data !== 'object' || Array.isArray(data) || !('name' in data)) return ''
				return typeof data.name === 'string' ? data.name : ''
			}
		},
		data: sorted.map(([date, event]) => {
			const xAxis = dateInMs ? +date : +date * 1e3
			return {
				name: event,
				xAxis
			}
		})
	} satisfies NonNullable<LineSeriesOption['markLine']>
}
import type { LineSeriesOption } from 'echarts'
