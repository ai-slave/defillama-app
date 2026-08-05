import { describe, expect, it } from 'vitest'
import { getChartBuilderSeriesLimit } from './requestLimits'

describe('getChartBuilderSeriesLimit', () => {
	it('keeps interactive requests capped', () => {
		expect(getChartBuilderSeriesLimit({ limit: '7' }, 10)).toBe(7)
		expect(getChartBuilderSeriesLimit({ limit: '1000' }, 10)).toBe(20)
	})
})
