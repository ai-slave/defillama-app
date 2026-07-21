import { describe, expect, it } from 'vitest'
import { buildScatterPresentation } from '../scatterPresentation'

describe('buildScatterPresentation', () => {
	it('labels the most important points and folds low-volume color groups into Other', () => {
		const points = Array.from({ length: 10 }, (_, index) => ({
			x: index,
			y: index * 2,
			label: `Protocol ${index}`,
			group: `Category ${index}`,
			importance: index
		}))

		const result = buildScatterPresentation(points, { 'Category 9': '#123456' })

		expect(result.filter((point) => point.showLabel)).toHaveLength(5)
		expect(result[9]).toMatchObject({ showLabel: true, symbolSize: 9 })
		expect(result[9]).not.toHaveProperty('entitySlug')
		expect(new Set(result.map((point) => point.seriesName))).toHaveLength(7)
		expect(result.some((point) => point.seriesName === 'Other')).toBe(true)
	})

	it('keeps bubbles proportional without inflating labeled points', () => {
		const result = buildScatterPresentation(
			[
				{ x: 1, y: 1, label: 'Small', importance: 9, symbolSize: 6 },
				{ x: 2, y: 2, label: 'Large', importance: 40, symbolSize: 40 }
			],
			{}
		)

		expect(result[0]).toMatchObject({ showLabel: true, symbolSize: 9 })
		expect(result[1]).toMatchObject({ showLabel: true, symbolSize: 40 })
	})

	it('keeps stable input order for equally important labels and ignores inherited colors', () => {
		const result = buildScatterPresentation(
			Array.from({ length: 7 }, (_, index) => ({
				x: index,
				y: index,
				label: `Point ${index}`,
				group: index === 0 ? 'constructor' : 'Data',
				importance: 1
			})),
			{}
		)

		expect(result.map((point) => point.showLabel)).toEqual([true, true, true, true, true, false, false])
		expect(result[0].groupColor).toMatch(/^#/)
	})
})
