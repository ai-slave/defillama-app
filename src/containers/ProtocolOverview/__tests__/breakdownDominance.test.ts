import { expect, test } from 'vitest'
import { buildProtocolBreakdownDominance } from '../breakdownDominance'
import type { ProtocolBreakdownChart } from '../useProtocolBreakdownCharts'

function present(breakdown: ProtocolBreakdownChart, availableSeries: Array<string>, activeSeries: Array<string>) {
	return buildProtocolBreakdownDominance({ breakdown, availableSeries, activeSeries, aggregateOthers: true })
}

test('picked series keep their share of the whole breakdown, with the rest in Others, in the chart and its export', async () => {
	const breakdown: ProtocolBreakdownChart = [[1000, { Ethereum: 120, Solana: 60, Base: 20 }]]
	const twoPicks = present(breakdown, ['Ethereum', 'Solana', 'Base'], ['Base', 'Ethereum'])
	const expected = { dimensions: ['timestamp', 'Ethereum', 'Base', 'Others'], source: [[1000, 60, 10, 30]] }
	expect(twoPicks.dataset).toEqual(expected)
	expect(await csvOf(twoPicks)).toEqual(expected)
})

test('nothing picked draws and exports nothing', async () => {
	const empty = present([[1000, { Ethereum: 120, Solana: 60 }]], ['Ethereum', 'Solana'], [])
	expect(empty.dataset).toEqual({ dimensions: ['timestamp'], source: [[1000]] })
	expect(await csvOf(empty)).toEqual({ dimensions: ['timestamp'], source: [[1000]] })
})

function csvOf(result: ReturnType<typeof present>) {
	if (result.csvSource === 'rendered-chart' || result.csvSource.type !== 'dataset') {
		throw new Error('Expected a dataset export')
	}
	return result.csvSource.prepare()
}

test('exports individual tail peers and the upstream remainder while folding only the chart', async () => {
	const names = Array.from({ length: 32 }, (_, index) => `Token${index}`)
	const values = Object.fromEntries(names.map((name) => [name, 6]))
	const result = present([[1000, { ...values, Others: 8 }]], names, names)
	expect(result.dataset.dimensions).toHaveLength(32)
	expect(result.dataset.source[0]?.at(-1)).toBe(10)
	expect(await csvOf(result)).toEqual({
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
