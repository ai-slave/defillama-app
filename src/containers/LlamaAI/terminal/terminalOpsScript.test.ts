import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
	applyTerminalOps,
	normalizeTerminalOpsPayload,
	readTerminalContext,
	resetTerminalDrawings
} from './terminalOps'
import {
	listTerminalScripts,
	resetTerminalScripts,
	setTerminalSymbol,
	setTerminalWidget,
	type TerminalChart,
	type TerminalWidget
} from './terminalViewStore'

/**
 * A saved indicator re-runs unattended, so its drawings have to be removable without touching the
 * agent's chat drawings, and a run that draws fewer shapes than the last one must not leave the
 * extras behind. Both hang on `clear` honouring the ids it names, which it did not used to.
 */

const DAY = 86_400
const START = 1_700_000_000 - (1_700_000_000 % DAY)

const entities = new Map<string, number>()
const removed: Array<string> = []
let nextEntity = 0

function recordingWidget(): TerminalWidget {
	const chart = {
		createShape: async () => {
			const id = `entity_${++nextEntity}`
			entities.set(id, nextEntity)
			return id
		},
		createMultipointShape: async () => `entity_${++nextEntity}`,
		createStudy: async () => null,
		removeEntity: (id: string) => {
			removed.push(id)
			entities.delete(id)
		},
		// The real chart lists what is actually on it, and readTerminalContext prunes against that.
		getAllShapes: () => [...entities.keys()].map((id) => ({ id, name: 'shape' })),
		getVisibleRange: () => ({ from: START, to: START + 30 * DAY }),
		resolution: () => '1D'
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

function hline(id: string, number: number, price: number) {
	return { type: 'hline' as const, id, number, price, text: `level ${number}` }
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
	entities.clear()
	removed.length = 0
	nextEntity = 0
	resetTerminalDrawings()
	resetTerminalScripts()
	setTerminalSymbol('BTC')
	setTerminalWidget(recordingWidget())
})

afterEach(() => {
	setTerminalWidget(null)
	resetTerminalDrawings()
	resetTerminalScripts()
})

describe('the script op', () => {
	test('registers the script so the client knows what to re-run on the next pan', () => {
		const payload = normalizeTerminalOpsPayload({
			symbol: 'BTC',
			interval: '1D',
			ops: [hline('sab12cd34_1', 1, 100), { type: 'script', file: 'scripts/mid.js', inputs: ['candles'] }]
		})
		expect(payload?.ops.length).toBe(2)

		applyTerminalOps(payload!)
		expect(listTerminalScripts()).toEqual(['scripts/mid.js'])
	})

	test('a script op with no file is dropped rather than registering an unrunnable name', () => {
		const payload = normalizeTerminalOpsPayload({
			symbol: 'BTC',
			interval: '1D',
			ops: [hline('sab12cd34_1', 1, 100), { type: 'script', inputs: ['candles'] }]
		})
		expect(payload?.ops.length).toBe(1)
		applyTerminalOps(payload!)
		expect(listTerminalScripts()).toEqual([])
	})
})

describe('a clear that names its ids', () => {
	test('removes only those drawings, so a re-run leaves the agent chat drawings alone', async () => {
		applyTerminalOps({
			symbol: 'BTC',
			interval: '1D',
			ops: [hline('ai_1', 1, 100), hline('sab12cd34_1', 1, 200)]
		})
		await settle()
		const chatEntity = 'entity_1'
		const scriptEntity = 'entity_2'
		expect([...entities.keys()]).toEqual([chatEntity, scriptEntity])

		applyTerminalOps({
			symbol: 'BTC',
			interval: '1D',
			ops: [{ type: 'clear', ids: ['sab12cd34_1', 'sab12cd34_2'] }, hline('sab12cd34_1', 1, 250)]
		})
		await settle()

		expect(removed).toEqual([scriptEntity])
		// The registry is what <terminal_context> is built from: a chat drawing dropped here would
		// be one the agent is told it no longer owns while the user can still see it.
		expect(readTerminalContext().drawings.map((drawing) => drawing.id)).toEqual(['ai_1', 'sab12cd34_1'])
	})

	test('an unnamed clear still wipes every agent drawing, which is what the chat clear means', async () => {
		applyTerminalOps({
			symbol: 'BTC',
			interval: '1D',
			ops: [hline('ai_1', 1, 100), hline('ai_2', 2, 200)]
		})
		await settle()

		applyTerminalOps({ symbol: 'BTC', interval: '1D', ops: [{ type: 'clear', ids: [] }, hline('ai_1', 1, 300)] })
		await settle()

		expect(removed).toEqual(['entity_1', 'entity_2'])
	})
})
