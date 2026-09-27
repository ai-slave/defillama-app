import { expect, test } from 'vitest'
import { buildProtocolBreakdownDominance } from '../breakdownDominance'
import { buildProtocolBreakdownPresentation, type ProtocolBreakdownChart } from '../useProtocolBreakdownCharts'

function present(breakdown: ProtocolBreakdownChart, availableSeries: Array<string>, activeSeries: Array<string>) {
	const visual = buildProtocolBreakdownPresentation({
		breakdown,
		availableSeries,
		activeSeries,
		aggregateOthers: true,
		includeUpstreamOthers: activeSeries.length === availableSeries.length,
		fillMissingWithZero: true,
		type: 'line'
	})
	return buildProtocolBreakdownDominance({
		dataset: visual.dataset!,
		charts: visual.charts,
		selectedCharts: new Set(visual.charts.map((chart) => chart.name)),
		breakdown,
		availableSeries,
		activeSeries,
		includeUpstreamOthers: activeSeries.length === availableSeries.length
	})
}

test('exports the same shares the chart draws for partial and empty selections', async () => {
	const breakdown: ProtocolBreakdownChart = [[1000, { Ethereum: 120, Solana: 60, Base: 20 }]]
	const twoPicks = present(breakdown, ['Ethereum', 'Solana', 'Base'], ['Base', 'Ethereum'])
	const picked = {
		dimensions: ['timestamp', 'Ethereum', 'Base'],
		source: [[1000, (120 / 140) * 100, 100 - (120 / 140) * 100]]
	}
	expect(twoPicks.dataset).toEqual(picked)
	expect(await twoPicks.csvSource.prepare()).toEqual(picked)

	const empty = present(breakdown, ['Ethereum', 'Solana', 'Base'], [])
	expect(empty.dataset).toEqual({ dimensions: ['timestamp'], source: [[1000]] })
	expect(await empty.csvSource.prepare()).toEqual({ dimensions: ['timestamp'], source: [[1000]] })
})

test('exports individual tail peers and the upstream remainder while folding only the chart', async () => {
	const names = Array.from({ length: 32 }, (_, index) => `Token${index}`)
	const values = Object.fromEntries(names.map((name) => [name, 6]))
	const result = present([[1000, { ...values, Others: 8 }]], names, names)
	expect(result.dataset.dimensions).toHaveLength(32)
	expect(result.dataset.source[0]?.at(-1)).toBe(10)
	expect(await result.csvSource.prepare()).toEqual({
		dimensions: [
			'timestamp',
			'Token0',
			'Token1',
			'Token2',
			'Token3',
			'Token4',
			'Token5',
			'Token6',
			'Token7',
			'Token8',
			'Token9',
			'Token10',
			'Token11',
			'Token12',
			'Token13',
			'Token14',
			'Token15',
			'Token16',
			'Token17',
			'Token18',
			'Token19',
			'Token20',
			'Token21',
			'Token22',
			'Token23',
			'Token24',
			'Token25',
			'Token26',
			'Token27',
			'Token28',
			'Token29',
			'Token30',
			'Token31',
			'Others'
		],
		source: [[1000, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4]]
	})
})
