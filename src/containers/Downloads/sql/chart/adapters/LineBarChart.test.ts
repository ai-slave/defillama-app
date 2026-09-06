import { describe, expect, test } from 'vitest'
import { buildSqlChartModel } from './LineBarChart'

function series(name: string, sourceIndex = 1) {
	return {
		name,
		sourceIndex,
		type: 'line' as const,
		color: '#123456'
	}
}

describe('SQL line/bar chart model', () => {
	test('separates user display names from time and value dimensions', () => {
		const model = buildSqlChartModel([[Date.UTC(2026, 0, 1), 7]], 0, 'time', [series('timestamp')])

		expect(model.dataset).toEqual({
			dimensions: ['x', 'timestamp'],
			source: [[1_767_225_600_000, 7]]
		})
		expect(model.charts[0]).toMatchObject({
			name: 'timestamp',
			encode: { x: 0, y: 1 }
		})
	})

	test('retains the split-chart null category as the legacy blank bucket', () => {
		const model = buildSqlChartModel([[null, 5]], 0, 'category', [series('A')], true)

		expect(model.dataset.source).toEqual([['', 5]])
	})
})
