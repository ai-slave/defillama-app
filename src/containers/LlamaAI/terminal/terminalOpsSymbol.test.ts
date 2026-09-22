import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { applyTerminalOps, readTerminalContext, resetTerminalDrawings } from './terminalOps'
import {
	chartTicker,
	setTerminalSymbol,
	setTerminalWidget,
	type TerminalChart,
	type TerminalWidget
} from './terminalViewStore'

// Measured on CL v32.2: chart.symbol() comes back uppercased ("XYZ:TSLA", "KPEPE") while the
// resolved ticker keeps the exact Hyperliquid coin id, which is case-sensitive upstream.
test('the chart symbol is read from the resolved ticker, not the uppercased display symbol', () => {
	expect(chartTicker({ symbol: () => 'XYZ:TSLA', symbolExt: () => ({ ticker: 'xyz:TSLA' }) })).toBe('xyz:TSLA')
	expect(chartTicker({ symbol: () => 'KPEPE', symbolExt: () => ({ ticker: 'kPEPE' }) })).toBe('kPEPE')
})

/**
 * An agent drawing belongs to the symbol it was drawn on. Symbol ownership moves synchronously
 * while the chart work is queued, so a payload that lands in that gap — a turn still streaming
 * when the user switches symbol — must still land on the right chart, and the previous symbol's
 * shapes must leave it. Both directions used to be wrong: ownership was released inside the queue.
 */

const created: Array<string> = []
const removed: Array<string> = []
let nextEntity = 0

function recordingWidget(): TerminalWidget {
	const chart = {
		createShape: async () => {
			const id = `entity_${++nextEntity}`
			created.push(id)
			return id
		},
		createMultipointShape: async () => {
			const id = `entity_${++nextEntity}`
			created.push(id)
			return id
		},
		removeEntity: (id: string) => {
			removed.push(id)
		},
		getAllShapes: () => created.filter((id) => !removed.includes(id)).map((id) => ({ id, name: 'shape' })),
		getVisibleRange: () => ({ from: 1_750_000_000, to: 1_757_000_000 }),
		resolution: () => '60'
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

const hline = (symbol: string, id: string, price: number) => ({
	symbol,
	interval: '60',
	ops: [{ type: 'hline' as const, id, number: Number(id.slice(3)), price }]
})

// The ops queue is a module-level promise chain; let it drain before asserting on the chart.
const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
	created.length = 0
	removed.length = 0
	nextEntity = 0
	setTerminalSymbol('HYPE')
	setTerminalWidget(recordingWidget())
})

afterEach(async () => {
	setTerminalWidget(null)
	resetTerminalDrawings()
	await drain()
	setTerminalSymbol('HYPE')
})

describe('drawings never cross symbols', () => {
	test('a payload arriving during a symbol switch is still drawn on the new symbol', async () => {
		applyTerminalOps(hline('HYPE', 'ai_1', 42))
		await drain()
		expect(created).toEqual(['entity_1'])

		// Exactly what TerminalPanel does on onSymbolChanged, then a late event for the new symbol.
		resetTerminalDrawings()
		setTerminalSymbol('BTC')
		applyTerminalOps(hline('BTC', 'ai_1', 81_000))
		await drain()

		// The HYPE shape is gone and the BTC one exists: ownership moved before the queue ran.
		expect(removed).toContain('entity_1')
		expect(created).toEqual(['entity_1', 'entity_2'])
		expect(readTerminalContext().drawings).toEqual([{ id: 'ai_1', kind: 'hline' }])
	})

	test('switching symbol through a payload alone takes the old shapes off the chart', async () => {
		applyTerminalOps(hline('HYPE', 'ai_1', 42))
		await drain()

		setTerminalSymbol('BTC')
		applyTerminalOps(hline('BTC', 'ai_1', 81_000))
		await drain()

		expect(removed).toEqual(['entity_1'])
		expect(created).toEqual(['entity_1', 'entity_2'])
	})

	test('a payload for the symbol the user just left is neither drawn nor reported back', async () => {
		setTerminalSymbol('BTC')
		applyTerminalOps(hline('HYPE', 'ai_1', 42))
		await drain()

		expect(created).toEqual([])
		// Telling the agent about a drawing it cannot see would have it clear or move a ghost.
		expect(readTerminalContext().drawings).toEqual([])
	})
})
