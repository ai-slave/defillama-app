import { describe, expect, it, vi } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import { buildStablecoinMarketCapPresentation } from '../marketCapPresentation'

type Row = { name: string; mcap: number | null }
const getName = (row: Row) => row.name

describe('buildStablecoinMarketCapPresentation', () => {
	it('preserves pie ordering and consolidates slices beyond the selected limit into Others', () => {
		const rows: Row[] = Array.from({ length: 12 }, (_, index) => ({
			name: index === 2 ? 'Others' : `Token ${index}`,
			mcap: 120 - index * 10
		}))

		expect(buildStablecoinMarketCapPresentation({ rows, view: 'pie', getName })).toEqual({
			kind: 'pie',
			chartData: [
				{ name: 'Token 0', value: 120 },
				{ name: 'Token 1', value: 110 },
				{ name: 'Token 3', value: 90 },
				{ name: 'Token 4', value: 80 },
				{ name: 'Token 5', value: 70 },
				{ name: 'Token 6', value: 60 },
				{ name: 'Token 7', value: 50 },
				{ name: 'Token 8', value: 40 },
				{ name: 'Token 9', value: 30 },
				{ name: 'Others', value: 130 }
			]
		})
	})

	it('builds horizontal-bar columns and colors only for its selected slices', () => {
		const rows: Row[] = Array.from({ length: 10 }, (_, index) => ({ name: `Chain ${index}`, mcap: 10 - index }))
		const getTrackedName = vi.fn(getName)

		const result = buildStablecoinMarketCapPresentation({ rows, view: 'hbar', getName: getTrackedName })

		expect(result).toEqual({
			kind: 'hbar',
			categories: [...Array.from({ length: 9 }, (_, index) => `Chain ${index}`), 'Others'],
			values: [...Array.from({ length: 9 }, (_, index) => 10 - index), 1],
			colors: Array.from({ length: 10 }, (_, index) => CHART_COLORS[index % CHART_COLORS.length])
		})
		expect(getTrackedName).toHaveBeenCalledTimes(9)
	})

	it('limits treemap work to positive top rows and calculates each share once', () => {
		const rows: Row[] = [
			{ name: 'Alpha', mcap: 2 },
			{ name: 'Beta', mcap: 1 },
			{ name: 'Zero', mcap: 0 }
		]

		expect(buildStablecoinMarketCapPresentation({ rows, view: 'treemap', getName })).toEqual({
			kind: 'treemap',
			treeData: [
				{
					name: 'Alpha',
					path: 'Stablecoins/Alpha',
					value: [2, 66.67, 66.67],
					itemStyle: { color: CHART_COLORS[0] }
				},
				{
					name: 'Beta',
					path: 'Stablecoins/Beta',
					value: [1, 33.33, 33.33],
					itemStyle: { color: CHART_COLORS[1] }
				}
			]
		})
	})

	it('preserves the existing decimal half-boundary rounding in treemap shares', () => {
		const rows: Row[] = [
			{ name: 'Large', mcap: 3997 },
			{ name: 'Small', mcap: 3 }
		]

		const result = buildStablecoinMarketCapPresentation({ rows, view: 'treemap', getName })

		expect(result.kind).toBe('treemap')
		if (result.kind !== 'treemap') return
		expect(result.treeData[1].value[1]).toBe(0.07)
	})
})
