import { describe, expect, it } from 'vitest'
import {
	buildSelectedAdditiveChart,
	buildSelectedPercentageChart,
	buildSelectedSeriesCsv,
	rankSeriesByPeakAbsoluteValue
} from './selection'

it('ranks additive peers by peak absolute value with stable ties', () => {
	expect(
		rankSeriesByPeakAbsoluteValue(
			{
				dimensions: ['timestamp', 'CurrentLeader', 'HistoricalLeader', 'Signed'],
				source: [
					[1, 10, 100, -50],
					[2, 80, 1, 50]
				]
			},
			['CurrentLeader', 'HistoricalLeader', 'Signed']
		)
	).toEqual(['HistoricalLeader', 'CurrentLeader', 'Signed'])
})

describe('buildSelectedAdditiveChart', () => {
	it('keeps selected peers visible and folds only the selected tail into fixed-color Others', () => {
		const names = Array.from({ length: 5 }, (_, index) => `Series${index + 1}`)
		const charts = names.map((name, index) => ({
			type: 'bar' as const,
			name,
			encode: { x: 0, y: index + 1 },
			color: `#00000${index}`,
			stack: 'A'
		}))
		const result = buildSelectedAdditiveChart({
			dataset: { dimensions: ['timestamp', ...names], source: [[1, 50, 40, 30, 20, 10]] },
			charts,
			seriesOrder: names,
			selectedCharts: new Set(names),
			limit: 3
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Series1', 'Series2', 'Series3', 'Others'],
			source: [[1, 50, 40, 30, 30]]
		})
		expect(result.charts.map((chart) => [chart.name, chart.color, chart.encode.y])).toEqual([
			['Series1', '#000000', 1],
			['Series2', '#000001', 2],
			['Series3', '#000002', 3],
			['Others', '#AAAAAA', 4]
		])
		expect(result.charts.every((chart) => chart.type === 'bar' && chart.stack === 'A')).toBe(true)
	})

	it('does not add Others for an explicit subset below the limit', () => {
		const charts = [
			{ type: 'line' as const, name: 'A', encode: { x: 0, y: 1 } },
			{ type: 'line' as const, name: 'B', encode: { x: 0, y: 2 } },
			{ type: 'line' as const, name: 'Others', encode: { x: 0, y: 3 } }
		]
		const dataset = { dimensions: ['timestamp', 'A', 'B', 'Others'], source: [[1, 10, 20, 30]] }
		const explicitSubset = buildSelectedAdditiveChart({
			dataset,
			charts,
			seriesOrder: ['A', 'B'],
			selectedCharts: new Set(['B'])
		})
		expect(explicitSubset.dataset).toBe(dataset)
		expect(explicitSubset.charts).toEqual([charts[1]])
		expect(
			buildSelectedAdditiveChart({
				dataset,
				charts,
				seriesOrder: ['A', 'B'],
				selectedCharts: new Set(['A', 'B']),
				includeUpstreamRemainder: true
			}).dataset
		).toEqual({ dimensions: ['timestamp', 'A', 'B', 'Others'], source: [[1, 10, 20, 30]] })
	})
})

describe('buildSelectedPercentageChart', () => {
	const dataset = {
		dimensions: ['timestamp', 'Ethereum', 'Solana', 'Base'],
		source: [
			[1, 60, 30, 10],
			[2, 0, 0, null]
		]
	}
	const charts = [
		{ type: 'line' as const, name: 'Ethereum', encode: { x: 0, y: 1 }, color: '#111111' },
		{ type: 'line' as const, name: 'Solana', encode: { x: 0, y: 2 }, color: '#222222' },
		{ type: 'line' as const, name: 'Base', encode: { x: 0, y: 3 }, color: '#333333' }
	]

	it('renormalizes selected peers to 100% without changing canonical order or colors', () => {
		const result = buildSelectedPercentageChart({
			dataset,
			charts,
			selectedCharts: new Set(['Solana', 'Ethereum'])
		})

		expect(result.dataset.dimensions).toEqual(['timestamp', 'Ethereum', 'Solana'])
		expect(result.dataset.source[0]).toEqual([1, (60 / 90) * 100, 100 - (60 / 90) * 100])
		expect(result.dataset.source[1]).toEqual([2, 0, 0])
		expect(result.charts).toEqual([
			{ ...charts[0], encode: { x: 0, y: 1 } },
			{ ...charts[1], encode: { x: 0, y: 2 } }
		])
		expect(dataset.source[0]).toEqual([1, 60, 30, 10])
	})

	it('makes a single selected peer 100% while preserving missing values', () => {
		const result = buildSelectedPercentageChart({ dataset, charts, selectedCharts: new Set(['Base']) })

		expect(result.dataset.source).toEqual([
			[1, 100],
			[2, null]
		])
	})

	it('keeps zero-valued trailing peers exactly zero when correcting rounding residue', () => {
		const result = buildSelectedPercentageChart({
			dataset: {
				dimensions: ['timestamp', 'ActiveA', 'ActiveB', 'Dormant'],
				source: [[1, 1, 2, 0]]
			},
			charts: [
				{ type: 'line', name: 'ActiveA', encode: { x: 0, y: 1 } },
				{ type: 'line', name: 'ActiveB', encode: { x: 0, y: 2 } },
				{ type: 'line', name: 'Dormant', encode: { x: 0, y: 3 } }
			],
			selectedCharts: new Set(['ActiveA', 'ActiveB', 'Dormant'])
		})

		expect(result.dataset.source[0]).toEqual([1, (1 / 3) * 100, 100 - (1 / 3) * 100, 0])
		expect(
			result.dataset.source[0]
				.slice(1)
				.map(Number)
				.reduce((total, value) => total + value, 0)
		).toBe(100)
	})
})

describe('buildSelectedSeriesCsv', () => {
	it('exports only the visible chart series in canonical order', () => {
		const result = buildSelectedSeriesCsv({
			dataset: {
				dimensions: ['timestamp', 'Ethereum', 'Solana', 'Base'],
				source: [[1_700_000_000_000, 3, 2, 1]]
			},
			charts: [
				{ type: 'line', name: 'Ethereum', encode: { x: 0, y: 1 }, color: '#111111' },
				{ type: 'line', name: 'Solana', encode: { x: 0, y: 2 }, color: '#222222' },
				{ type: 'line', name: 'Base', encode: { x: 0, y: 3 }, color: '#333333' }
			],
			selectedCharts: new Set(['Solana', 'Base']),
			filename: 'chains'
		})

		expect(result.rows[0]).toEqual(['Timestamp', 'Date', 'Solana', 'Base'])
		expect(result.rows[1]).toEqual([1_700_000_000_000, '2023-11-14', 2, 1])
	})
})
