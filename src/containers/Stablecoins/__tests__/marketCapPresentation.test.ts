import { describe, expect, it, vi } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import {
	buildStablecoinMarketCapPresentation,
	prepareStablecoinMarketCapSeries,
	prepareStablecoinMarketCapTreemapCsv
} from '../marketCapPresentation'

type Row = { name: string; mcap: number | null }
const getName = (row: Row) => row.name

describe('buildStablecoinMarketCapPresentation', () => {
	it('preserves pie ordering and consolidates slices beyond the selected limit into Others', () => {
		const rows: Row[] = Array.from({ length: 12 }, (_, index) => ({
			name: index === 2 ? 'Others' : `Token ${index}`,
			mcap: 120 - index * 10
		}))

		const series = prepareStablecoinMarketCapSeries({ rows, view: 'pie', getName, getValue: (row) => row.mcap ?? 0 })
		expect(buildStablecoinMarketCapPresentation({ series })).toEqual({
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
				{ name: 'Token 10', value: 20 },
				{ name: 'Others', value: 110 }
			],
			stackColors: {
				'Token 0': CHART_COLORS[0],
				'Token 1': CHART_COLORS[1],
				'Token 3': CHART_COLORS[2],
				'Token 4': CHART_COLORS[3],
				'Token 5': CHART_COLORS[4],
				'Token 6': CHART_COLORS[5],
				'Token 7': CHART_COLORS[6],
				'Token 8': CHART_COLORS[7],
				'Token 9': CHART_COLORS[8],
				'Token 10': CHART_COLORS[9],
				Others: '#AAAAAA'
			}
		})
		expect(series.peers.map((peer) => peer.name)).toEqual([
			'Token 0',
			'Token 1',
			'Token 3',
			'Token 4',
			'Token 5',
			'Token 6',
			'Token 7',
			'Token 8',
			'Token 9',
			'Token 10',
			'Token 11'
		])
		expect(series.selectionSeries).toEqual(series.peers.map((peer) => peer.name))
	})

	it('builds horizontal-bar columns and colors only for its selected slices', () => {
		const rows: Row[] = Array.from({ length: 10 }, (_, index) => ({ name: `Chain ${index}`, mcap: 10 - index }))
		const getTrackedName = vi.fn(getName)

		const series = prepareStablecoinMarketCapSeries({
			rows,
			view: 'hbar',
			getName: getTrackedName,
			getValue: (row) => row.mcap ?? 0
		})
		const result = buildStablecoinMarketCapPresentation({ series })

		expect(result).toEqual({
			kind: 'hbar',
			categories: [...Array.from({ length: 9 }, (_, index) => `Chain ${index}`), 'Others'],
			values: [...Array.from({ length: 9 }, (_, index) => 10 - index), 1],
			colors: [...Array.from({ length: 9 }, (_, index) => CHART_COLORS[index % CHART_COLORS.length]), '#AAAAAA']
		})
		expect(getTrackedName).toHaveBeenCalledTimes(10)
	})

	it('removes hbar Others at the limit and computes it from only the selected tail above the limit', () => {
		const rows: Row[] = Array.from({ length: 11 }, (_, index) => ({ name: `Chain ${index}`, mcap: 11 - index }))
		const series = prepareStablecoinMarketCapSeries({ rows, view: 'hbar', getName, getValue: (row) => row.mcap ?? 0 })

		expect(
			buildStablecoinMarketCapPresentation({
				series,
				selectedSeries: new Set(series.selectionSeries.slice(0, 9))
			})
		).toMatchObject({ categories: series.selectionSeries.slice(0, 9), values: [11, 10, 9, 8, 7, 6, 5, 4, 3] })
		expect(
			buildStablecoinMarketCapPresentation({
				series,
				selectedSeries: new Set(series.selectionSeries.slice(0, 10))
			})
		).toMatchObject({
			categories: [...series.selectionSeries.slice(0, 9), 'Others'],
			values: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
		})
	})

	it('uses the same positive peer universe for every snapshot view', () => {
		const rows: Row[] = [
			{ name: 'Alpha', mcap: 2 },
			{ name: 'Beta', mcap: 1 },
			{ name: 'Zero', mcap: 0 },
			{ name: 'Negative', mcap: -1 }
		]
		for (const view of ['pie', 'hbar', 'treemap'] as const) {
			const series = prepareStablecoinMarketCapSeries({
				rows,
				view,
				getName,
				getValue: (row) => row.mcap ?? 0
			})
			expect(series.selectionSeries).toEqual(['Alpha', 'Beta'])
		}

		const series = prepareStablecoinMarketCapSeries({
			rows,
			view: 'treemap',
			getName,
			getValue: (row) => row.mcap ?? 0
		})
		expect(series.selectionSeries).toEqual(['Alpha', 'Beta'])
		expect(buildStablecoinMarketCapPresentation({ series })).toEqual({
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

		const series = prepareStablecoinMarketCapSeries({
			rows,
			view: 'treemap',
			getName,
			getValue: (row) => row.mcap ?? 0
		})
		const result = buildStablecoinMarketCapPresentation({ series })

		expect(result.kind).toBe('treemap')
		if (result.kind !== 'treemap') return
		expect(result.treeData[1].value[1]).toBe(0.07)
	})

	it('renders an explicit selection without Others and keeps canonical colors', () => {
		const rows: Row[] = Array.from({ length: 12 }, (_, index) => ({
			name: `Token ${index}`,
			mcap: 12 - index
		}))
		const series = prepareStablecoinMarketCapSeries({ rows, view: 'pie', getName, getValue: (row) => row.mcap ?? 0 })

		expect(buildStablecoinMarketCapPresentation({ series, selectedSeries: new Set(['Token 2']) })).toEqual({
			kind: 'pie',
			chartData: [{ name: 'Token 2', value: 10 }],
			stackColors: { 'Token 2': CHART_COLORS[2] }
		})
		expect(buildStablecoinMarketCapPresentation({ series, selectedSeries: new Set() })).toEqual({
			kind: 'pie',
			chartData: [],
			stackColors: {}
		})

		const exactlyAtLimit = buildStablecoinMarketCapPresentation({
			series,
			selectedSeries: new Set(series.selectionSeries.slice(0, 10))
		})
		expect(exactlyAtLimit.kind).toBe('pie')
		if (exactlyAtLimit.kind !== 'pie') return
		expect(exactlyAtLimit.chartData).toHaveLength(10)
		expect(exactlyAtLimit.chartData.some((slice) => slice.name === 'Others')).toBe(false)

		const aboveLimit = buildStablecoinMarketCapPresentation({
			series,
			selectedSeries: new Set(series.selectionSeries.slice(0, 11))
		})
		expect(aboveLimit.kind).toBe('pie')
		if (aboveLimit.kind !== 'pie') return
		expect(aboveLimit.chartData.at(-1)).toEqual({ name: 'Others', value: 2 })
	})

	it('renormalizes treemap shares over only the selected peers', () => {
		const rows: Row[] = [
			{ name: 'Alpha', mcap: 6 },
			{ name: 'Beta', mcap: 3 },
			{ name: 'Gamma', mcap: 1 }
		]
		const series = prepareStablecoinMarketCapSeries({
			rows,
			view: 'treemap',
			getName,
			getValue: (row) => row.mcap ?? 0
		})
		const result = buildStablecoinMarketCapPresentation({
			series,
			selectedSeries: new Set(['Beta', 'Gamma'])
		})

		expect(result.kind).toBe('treemap')
		if (result.kind !== 'treemap') return
		expect(result.treeData.map((node) => [node.name, node.value[1]])).toEqual([
			['Beta', 75],
			['Gamma', 25]
		])
		expect(
			prepareStablecoinMarketCapTreemapCsv({ treeData: result.treeData, filename: 'stablecoins-market-cap-treemap' })
		).toEqual({
			filename: 'stablecoins-market-cap-treemap',
			rows: [
				['Name', 'Market Cap', 'Share (%)'],
				['Beta', 3, 75],
				['Gamma', 1, 25]
			]
		})
	})

	it('keeps treemap remainder-free and renders every selected peer', () => {
		const rows: Row[] = Array.from({ length: 22 }, (_, index) => ({ name: `Token ${index}`, mcap: 22 - index }))
		const series = prepareStablecoinMarketCapSeries({
			rows,
			view: 'treemap',
			getName,
			getValue: (row) => row.mcap ?? 0
		})
		const result = buildStablecoinMarketCapPresentation({
			series,
			selectedSeries: new Set(series.selectionSeries)
		})

		expect(series.selectionSeries).toHaveLength(22)
		expect(result.kind).toBe('treemap')
		if (result.kind !== 'treemap') return
		expect(result.treeData).toHaveLength(22)
		expect(result.treeData.some((node) => node.name === 'Others')).toBe(false)
		expect(result.treeData.reduce((total, node) => total + node.value[1], 0)).toBeCloseTo(100, 1)
	})

	it('selects every source entity by default while rendering top N plus selected-tail Others', () => {
		const rows: Row[] = Array.from({ length: 479 }, (_, index) => ({ name: `Chain ${index}`, mcap: 479 - index }))
		const series = prepareStablecoinMarketCapSeries({ rows, view: 'pie', getName, getValue: (row) => row.mcap ?? 0 })

		expect(series.selectionSeries).toHaveLength(479)
		const defaultView = buildStablecoinMarketCapPresentation({ series })
		expect(defaultView.kind).toBe('pie')
		if (defaultView.kind !== 'pie') return
		expect(defaultView.chartData).toHaveLength(11)
		expect(defaultView.chartData.at(-1)).toEqual({
			name: 'Others',
			value: rows.slice(10).reduce((total, row) => total + (row.mcap ?? 0), 0)
		})

		const withoutTopChain = buildStablecoinMarketCapPresentation({
			series,
			selectedSeries: new Set(series.selectionSeries.slice(1))
		})
		expect(withoutTopChain.kind).toBe('pie')
		if (withoutTopChain.kind !== 'pie') return
		expect(withoutTopChain.chartData[0].name).toBe('Chain 1')
		expect(withoutTopChain.chartData.at(-1)).toEqual({
			name: 'Others',
			value: rows.slice(11).reduce((total, row) => total + (row.mcap ?? 0), 0)
		})
	})

	it('coalesces duplicate display names into one selectable peer', () => {
		const rows: Row[] = [
			{ name: 'USDX', mcap: 4 },
			{ name: 'USDY', mcap: 3 },
			{ name: 'USDX', mcap: 2 }
		]
		const series = prepareStablecoinMarketCapSeries({ rows, view: 'pie', getName, getValue: (row) => row.mcap ?? 0 })
		expect(series.selectionSeries).toEqual(['USDX', 'USDY'])
		expect(buildStablecoinMarketCapPresentation({ series })).toMatchObject({
			chartData: [
				{ name: 'USDX', value: 6 },
				{ name: 'USDY', value: 3 }
			]
		})
	})

	it('preserves first-seen canonical colors when coalesced totals tie', () => {
		const rows: Row[] = [
			{ name: 'First', mcap: 2 },
			{ name: 'Second', mcap: 4 },
			{ name: 'First', mcap: 2 }
		]
		const series = prepareStablecoinMarketCapSeries({ rows, view: 'pie', getName, getValue: (row) => row.mcap ?? 0 })

		expect(series.selectionSeries).toEqual(['First', 'Second'])
		expect(buildStablecoinMarketCapPresentation({ series, selectedSeries: new Set(['Second']) })).toMatchObject({
			stackColors: { Second: CHART_COLORS[1] }
		})
	})

	it('filters nonpositive peers after coalescing duplicate identities', () => {
		const rows: Row[] = [
			{ name: 'Net Positive', mcap: 5 },
			{ name: 'Net Positive', mcap: -3 },
			{ name: 'Net Zero', mcap: 2 },
			{ name: 'Net Zero', mcap: -2 }
		]
		const series = prepareStablecoinMarketCapSeries({ rows, view: 'pie', getName, getValue: (row) => row.mcap ?? 0 })

		expect(series.selectionSeries).toEqual(['Net Positive'])
		expect(series.peers[0].value).toBe(2)
	})

	it('restores upstream Others only after matching every canonical peer', () => {
		const rows: Row[] = [
			{ name: 'A', mcap: 4 },
			{ name: 'B', mcap: 3 },
			{ name: 'Others', mcap: 2 }
		]
		const series = prepareStablecoinMarketCapSeries({ rows, view: 'pie', getName, getValue: (row) => row.mcap ?? 0 })

		expect(buildStablecoinMarketCapPresentation({ series, selectedSeries: new Set(['A', 'stale']) })).toMatchObject({
			chartData: [{ name: 'A', value: 4 }]
		})
		expect(
			buildStablecoinMarketCapPresentation({ series, selectedSeries: new Set(['A', 'B', 'stale']) })
		).toMatchObject({
			chartData: [
				{ name: 'A', value: 4 },
				{ name: 'B', value: 3 },
				{ name: 'Others', value: 2 }
			]
		})
	})
})
