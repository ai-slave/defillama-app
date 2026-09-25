import { describe, expect, test } from 'vitest'
import { buildBandMarkArea, isoDay, rangeCount, rangeCovers, widestNestedRange } from './poolChartUtils'

describe('pool chart utilities', () => {
	test('uses one rank ordering for nested ranges', () => {
		expect(rangeCovers('max', '30d')).toBe(true)
		expect(rangeCovers('30d', '90d')).toBe(false)
		expect(widestNestedRange(['30d', 'max', '90d'])).toBe('max')
		expect(rangeCount('90d', 120)).toBe(90)
	})

	test('builds edge-to-edge day bands with the active theme fill', () => {
		const from = Date.UTC(2026, 0, 2)
		const to = Date.UTC(2026, 0, 4)
		const markArea = buildBandMarkArea([{ from, to, kind: 'gap' }], { gap: ['light-fill', 'dark-fill'] }, true)

		expect(markArea).toEqual({
			silent: true,
			data: [[{ xAxis: from - 43_200_000, itemStyle: { color: 'dark-fill' } }, { xAxis: to + 43_200_000 }]]
		})
		expect(buildBandMarkArea([], { gap: ['light-fill', 'dark-fill'] }, false)).toBeUndefined()
		expect(isoDay(from)).toBe('2026-01-02')
	})
})
