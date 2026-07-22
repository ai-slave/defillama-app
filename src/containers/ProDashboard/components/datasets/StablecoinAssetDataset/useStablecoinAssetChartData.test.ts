import { describe, expect, it } from 'vitest'
import { buildStablecoinAssetPresentation } from './useStablecoinAssetChartData'

const day = 86_400
const firstDate = 1_700_000_000
const rawData = {
	chainsUnique: ['Ethereum', 'Base'],
	chainsData: [
		[
			{ date: firstDate, circulating: { peggedUSD: 100 } },
			{ date: firstDate + 2 * day, circulating: { peggedUSD: 90 } }
		],
		[
			{ date: firstDate + day, circulating: { peggedUSD: 50 } },
			{ date: firstDate + 3 * day, circulating: { peggedUSD: 0 } }
		]
	]
}

describe('buildStablecoinAssetPresentation', () => {
	it('constructs only the requested canonical history presentation', () => {
		const total = buildStablecoinAssetPresentation(rawData, 'totalCirc')
		const area = buildStablecoinAssetPresentation(rawData, 'chainMcaps')
		const dominance = buildStablecoinAssetPresentation(rawData, 'chainDominance')

		expect(total).toEqual({
			chartType: 'totalCirc',
			dataset: {
				dimensions: ['timestamp', 'Circulating'],
				source: [
					[firstDate * 1e3, 100],
					[(firstDate + day) * 1e3, 50],
					[(firstDate + 2 * day) * 1e3, 90],
					[(firstDate + 3 * day) * 1e3, 0]
				]
			},
			totalCirculating: 0
		})
		expect(area.chartType).toBe('chainMcaps')
		if (area.chartType === 'chainMcaps') {
			expect(area.dataset.dimensions).toEqual(['timestamp', 'Ethereum', 'Base'])
			expect(area.dataset.source[1]).toEqual([(firstDate + day) * 1e3, 0, 50])
			expect(area.totalCirculating).toBe(0)
		}
		expect(dominance.chartType).toBe('chainDominance')
		if (dominance.chartType === 'chainDominance') {
			expect(dominance.dataset.source[1]).toEqual([(firstDate + day) * 1e3, 0, 100])
			expect(dominance.totalCirculating).toBe(0)
		}
	})

	it('builds a pie from the latest sparse point inside the active period', () => {
		const secondDate = firstDate + day
		const result = buildStablecoinAssetPresentation(rawData, 'chainPie', {
			start: firstDate,
			end: secondDate
		})

		expect(result).toEqual({
			chartType: 'chainPie',
			slices: [
				{ name: 'Base', value: 50 },
				{ name: 'Ethereum', value: 0 }
			],
			totalCirculating: 50
		})
	})

	it('returns an empty snapshot when the active period has no points', () => {
		expect(
			buildStablecoinAssetPresentation(rawData, 'chainPie', {
				start: firstDate - 2 * day,
				end: firstDate - day
			})
		).toEqual({ chartType: 'chainPie', slices: [], totalCirculating: null })
	})
})
