import { afterEach, describe, expect, test, vi } from 'vitest'
import { buildProTreemapData } from '../treemap'

const resolveColor = (name: string, fallback?: string) => fallback ?? `color:${name}`

afterEach(() => vi.useRealTimers())

describe('buildProTreemapData', () => {
	test('uses the latest completed snapshot and skips an actual current-day point', () => {
		const day = 86_400
		vi.useFakeTimers()
		vi.setSystemTime(new Date(4 * day * 1000))
		expect(
			buildProTreemapData(
				[
					{
						name: 'Multiple',
						data: [
							[day, 10],
							[2 * day, 20],
							[4 * day, 30]
						],
						color: '#123456'
					},
					{ name: 'Single', data: [[2 * day, 40]] }
				],
				'latest',
				resolveColor
			)
		).toEqual([
			{ name: 'Multiple', value: 20, itemStyle: { color: '#123456' } },
			{ name: 'Single', value: 40, itemStyle: { color: 'color:Single' } }
		])
	})

	test('anchors windows at the latest completed point and preserves exact day boundaries', () => {
		const day = 86_400
		vi.useFakeTimers()
		vi.setSystemTime(new Date(18 * day * 1000))
		const series = [
			{
				name: 'Windowed',
				data: [
					[9 * day, 1],
					[9 * day + 1, 2],
					[16 * day, 4],
					[17 * day, 8]
				] as Array<[number, number]>
			}
		]

		expect(buildProTreemapData(series, 'sum7d', resolveColor)[0].value).toBe(12)
		expect(buildProTreemapData(series, 'sum30d', resolveColor)[0].value).toBe(15)
	})

	test('filters non-positive nodes before resolving their colors', () => {
		const color = vi.fn(resolveColor)

		expect(
			buildProTreemapData(
				[
					{ name: 'Zero', data: [[1, 0]] },
					{ name: 'Loss', data: [[1, -1]] },
					{ name: 'Gain', data: [[1, 1]] }
				],
				'latest',
				color
			)
		).toEqual([{ name: 'Gain', value: 1, itemStyle: { color: 'color:Gain' } }])
		expect(color).toHaveBeenCalledOnce()
	})
})
