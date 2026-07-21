import { describe, expect, it } from 'vitest'
import { buildArticleAnnotationMarkLine } from '../articleAnnotationMarkLine'

describe('article annotation mark lines', () => {
	it('preserves annotation-list order and alphabetic labels', () => {
		const markLine = buildArticleAnnotationMarkLine([
			{ date: '2025-03-01', label: 'Later event' },
			{ date: '2025-01-01', label: 'Earlier event' }
		])!

		expect(markLine.symbol).toEqual(['none', 'none'])
		expect(markLine.lineStyle).toMatchObject({ color: '#9ca3af', type: 'dashed' })
		const formatter = markLine.label.formatter
		if (typeof formatter !== 'function') throw new Error('Expected mark-line label formatter')
		expect(formatter({ dataIndex: 0 } as Parameters<typeof formatter>[0])).toBe('A')
		expect(formatter({ dataIndex: 1 } as Parameters<typeof formatter>[0])).toBe('B')
		expect(markLine.data).toEqual([{ xAxis: Date.parse('2025-03-01') }, { xAxis: Date.parse('2025-01-01') }])
	})

	it('omits mark-line configuration when there are no annotations', () => {
		expect(buildArticleAnnotationMarkLine([])).toBeUndefined()
	})
})
