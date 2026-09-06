import type { LineSeriesOption } from 'echarts/charts'
import type { ArticleChartAnnotation } from './types'

/** Keep chart markers in the same A/B/C order as the annotation list below the figure. */
export function buildArticleAnnotationMarkLine(
	annotations: Array<ArticleChartAnnotation>
): LineSeriesOption['markLine'] | undefined {
	if (annotations.length === 0) return undefined
	return {
		silent: false,
		symbol: ['none', 'none'],
		lineStyle: { color: '#9ca3af', type: 'dashed', width: 1 },
		label: {
			color: '#6b7280',
			fontSize: 10,
			formatter: (params: { dataIndex?: number }) => {
				const index = typeof params.dataIndex === 'number' ? params.dataIndex : 0
				return String.fromCharCode(65 + index)
			}
		},
		data: annotations.map((annotation) => ({ xAxis: new Date(annotation.date).getTime() }))
	}
}
