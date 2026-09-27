import { describe, expect, test } from 'vitest'
import {
	buildSelectedAdditiveChart,
	buildSelectedPercentageChart,
	rankSeriesByPeakAbsoluteValue,
	selectChartDatasetColumns,
	selectDatasetColumns
} from '../selection'

test('ranks additive peers by peak absolute value with stable ties', () => {
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

describe('picked-series exports', () => {
	const dataset = { dimensions: ['timestamp', 'eth', 'sol', 'base'], source: [[1, 60, 30, 10]] }

	test('export the x column and the picked columns in the order given, skipping names without data', () => {
		expect(selectDatasetColumns(dataset, ['base', 'missing', 'eth'])).toEqual({
			dimensions: ['timestamp', 'base', 'eth'],
			source: [[1, 10, 60]]
		})
	})

	test('name each exported column after its chart, reading the column the chart encodes', () => {
		const charts = [
			{ type: 'line' as const, name: 'Solana', encode: { x: 0, y: 2 } },
			{ type: 'line' as const, name: 'Ethereum', encode: { x: 'timestamp', y: 'eth' } }
		]
		expect(selectChartDatasetColumns(dataset, charts)).toEqual({
			dimensions: ['timestamp', 'Solana', 'Ethereum'],
			source: [[1, 30, 60]]
		})
	})
})

describe('buildSelectedAdditiveChart', () => {
	test('keeps selected peers visible, folds only the selected tail into Others, and exports each peer', async () => {
		const names = Array.from({ length: 5 }, (_, index) => `Series${index + 1}`)
		const dataset = { dimensions: ['timestamp', ...names], source: [[1, 50, 40, 30, 20, 10]] }
		const charts = names.map((name, index) => ({
			type: 'bar' as const,
			name,
			encode: { x: 0, y: index + 1 },
			color: `#00000${index}`,
			stack: 'A'
		}))
		const result = buildSelectedAdditiveChart({
			dataset,
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
		if (result.csvSource === 'rendered-chart' || result.csvSource.type !== 'dataset') {
			throw new Error('Expected a dataset export')
		}
		expect(await result.csvSource.prepare()).toEqual({
			dimensions: ['timestamp', 'Series1', 'Series2', 'Series3', 'Series4', 'Series5'],
			source: [[1, 50, 40, 30, 20, 10]]
		})
	})

	test('keeps Others unavailable when any selected remainder member is unavailable', () => {
		const names = ['A', 'B', 'C', 'D']
		const charts = names.map((name, index) => ({
			type: 'line' as const,
			name,
			encode: { x: 0, y: index + 1 }
		}))
		const result = buildSelectedAdditiveChart({
			dataset: {
				dimensions: ['timestamp', ...names],
				source: [
					[1, 10, 20, null, 5],
					[2, 10, 20, 0, 5]
				]
			},
			charts,
			seriesOrder: names,
			selectedCharts: new Set(names),
			limit: 2
		})

		expect(result.dataset.source).toEqual([
			[1, 10, 20, null],
			[2, 10, 20, 5]
		])
	})

	test('does not add Others for an explicit subset below the limit', () => {
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

	test('exports the picked peers, and the upstream Others only while the chart shows it', async () => {
		const charts = [
			{ type: 'line' as const, name: 'A', encode: { x: 0, y: 1 } },
			{ type: 'line' as const, name: 'B', encode: { x: 0, y: 2 } },
			{ type: 'line' as const, name: 'Others', encode: { x: 0, y: 3 } }
		]
		const dataset = { dimensions: ['timestamp', 'A', 'B', 'Others'], source: [[1, 10, 20, 30]] }
		const exportOf = async (selected: Array<string>, includeUpstreamRemainder: boolean) => {
			const { csvSource } = buildSelectedAdditiveChart({
				dataset,
				charts,
				seriesOrder: ['A', 'B'],
				selectedCharts: new Set(selected),
				includeUpstreamRemainder
			})
			if (csvSource === 'rendered-chart' || csvSource.type !== 'dataset') throw new Error('Expected a dataset export')
			return csvSource.prepare()
		}
		expect(await exportOf(['B'], false)).toEqual({ dimensions: ['timestamp', 'B'], source: [[1, 20]] })
		expect(await exportOf(['A', 'B'], true)).toEqual({
			dimensions: ['timestamp', 'A', 'B', 'Others'],
			source: [[1, 10, 20, 30]]
		})
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

	test('renormalizes selected peers and exports the same shares', async () => {
		const result = buildSelectedPercentageChart({
			dataset,
			charts,
			selectedCharts: new Set(['Solana', 'Ethereum']),
			missingValuePolicy: 'require-complete'
		})

		expect(result.dataset.dimensions).toEqual(['timestamp', 'Ethereum', 'Solana'])
		expect(result.dataset.source[0]).toEqual([1, (60 / 90) * 100, 100 - (60 / 90) * 100])
		expect(result.dataset.source[1]).toEqual([2, 0, 0])
		expect(result.charts).toEqual([
			{ ...charts[0], encode: { x: 0, y: 1 } },
			{ ...charts[1], encode: { x: 0, y: 2 } }
		])
		expect(dataset.source[0]).toEqual([1, 60, 30, 10])
		if (result.csvSource === 'rendered-chart' || result.csvSource.type !== 'dataset') {
			throw new Error('Expected a dataset export')
		}
		expect(await result.csvSource.prepare()).toEqual({
			dimensions: ['timestamp', 'Ethereum', 'Solana'],
			source: [
				[1, (60 / 90) * 100, 100 - (60 / 90) * 100],
				[2, 0, 0]
			]
		})
	})

	test('makes a single selected peer 100% while preserving missing values', () => {
		const result = buildSelectedPercentageChart({
			dataset,
			charts,
			selectedCharts: new Set(['Base']),
			missingValuePolicy: 'require-complete'
		})

		expect(result.dataset.source).toEqual([
			[1, 100],
			[2, null]
		])
	})

	test('keeps every selected share unavailable when the selected denominator is incomplete', () => {
		const result = buildSelectedPercentageChart({
			dataset: {
				dimensions: ['timestamp', 'Unmeasured', 'Measured'],
				source: [[1, null, 50]]
			},
			charts: [
				{ type: 'line', name: 'Unmeasured', encode: { x: 0, y: 1 } },
				{ type: 'line', name: 'Measured', encode: { x: 0, y: 2 } }
			],
			selectedCharts: new Set(['Unmeasured', 'Measured']),
			missingValuePolicy: 'require-complete'
		})

		expect(result.dataset.source).toEqual([[1, null, null]])
	})

	test('normalizes available peers while preserving missing peer gaps', () => {
		const result = buildSelectedPercentageChart({
			dataset: {
				dimensions: ['timestamp', 'Unmeasured', 'MeasuredA', 'MeasuredB'],
				source: [[1, null, 75, 25]]
			},
			charts: [
				{ type: 'line', name: 'Unmeasured', encode: { x: 0, y: 1 } },
				{ type: 'line', name: 'MeasuredA', encode: { x: 0, y: 2 } },
				{ type: 'line', name: 'MeasuredB', encode: { x: 0, y: 3 } }
			],
			selectedCharts: new Set(['Unmeasured', 'MeasuredA', 'MeasuredB']),
			missingValuePolicy: 'sum-available'
		})

		expect(result.dataset.source).toEqual([[1, null, 75, 25]])
	})

	test('keeps zero-valued trailing peers exactly zero when correcting rounding residue', () => {
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
			selectedCharts: new Set(['ActiveA', 'ActiveB', 'Dormant']),
			missingValuePolicy: 'require-complete'
		})

		const row = result.dataset.source[0]
		if (!row) throw new Error('Expected one percentage row')
		expect(row).toEqual([1, (1 / 3) * 100, 100 - (1 / 3) * 100, 0])
		expect(
			row
				.slice(1)
				.map(Number)
				.reduce((total, value) => total + value, 0)
		).toBe(100)
	})
})
