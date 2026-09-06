import { describe, expect, test } from 'vitest'
import { heatmapClass, percentileOpacity, rankOpacity } from '../colors'

describe('percentileOpacity', () => {
	test('maps percentile bands to discrete opacity steps', () => {
		expect(percentileOpacity(9)).toBe(0)
		expect(percentileOpacity(10)).toBe(10)
		expect(percentileOpacity(49)).toBe(40)
		expect(percentileOpacity(50)).toBe(50)
		expect(percentileOpacity(79)).toBe(50)
		expect(percentileOpacity(80)).toBe(80)
		expect(percentileOpacity(99)).toBe(90)
		expect(percentileOpacity(100)).toBe(100)
	})
	test('floors fractional percentiles into their band', () => {
		expect(percentileOpacity(49.9)).toBe(40)
		expect(percentileOpacity(9.9)).toBe(0)
	})
	test('returns 0 for null or undefined', () => {
		expect(percentileOpacity(null)).toBe(0)
		expect(percentileOpacity(undefined)).toBe(0)
	})
})

describe('rankOpacity', () => {
	test('gives the best rank the highest opacity', () => {
		expect(rankOpacity(1)).toBe(100)
		expect(rankOpacity(5)).toBe(20)
		expect(rankOpacity(6)).toBe(0)
		expect(rankOpacity(20)).toBe(0)
	})
	test('returns 0 for null or undefined', () => {
		expect(rankOpacity(null)).toBe(0)
		expect(rankOpacity(undefined)).toBe(0)
	})
})

describe('heatmapClass', () => {
	test('returns undefined for the zero band', () => {
		expect(heatmapClass(0)).toBeUndefined()
	})
	test('maps a band to a translucent green wash', () => {
		const c = heatmapClass(100) ?? ''
		expect(c).toContain('bg-[rgba(60,150,105,')
	})
	test('covers every band percentile and rank opacity can produce, including the rank-only 60', () => {
		for (const band of [10, 20, 30, 40, 50, 60, 80, 90, 100]) {
			expect(heatmapClass(band)).toBeTruthy()
		}
	})
})
