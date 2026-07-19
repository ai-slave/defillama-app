import { describe, expect, it, vi } from 'vitest'
import { buildProTreemapData } from './treemap'

const resolveColor = (name: string, fallback?: string) => fallback ?? `color:${name}`

describe('buildProTreemapData', () => {
	it('keeps the intentional second-to-last snapshot and one-point fallback', () => {
		expect(
			buildProTreemapData(
				[
					{
						name: 'Multiple',
						data: [
							[1, 10],
							[2, 20],
							[3, 30]
						],
						color: '#123456'
					},
					{ name: 'Single', data: [[4, 40]] }
				],
				'latest',
				resolveColor
			)
		).toEqual([
			{ name: 'Multiple', value: 20, itemStyle: { color: '#123456' } },
			{ name: 'Single', value: 40, itemStyle: { color: 'color:Single' } }
		])
	})

	it('anchors windows at the second-to-last point and preserves exact day boundaries', () => {
		const day = 86_400
		const series = [
			{
				name: 'Windowed',
				data: [
					[9 * day, 1],
					[9 * day + 1, 2],
					[16 * day, 4],
					[17 * day, 8]
				] as [number, number][]
			}
		]

		expect(buildProTreemapData(series, 'sum7d', resolveColor)[0].value).toBe(6)
		expect(buildProTreemapData(series, 'sum30d', resolveColor)[0].value).toBe(7)
	})

	it('filters non-positive nodes before resolving their colors', () => {
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
