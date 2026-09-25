import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { agentSeriesBars, SOURCE_INPUT_ID } from '../terminalData'
import {
	applyTerminalOps,
	normalizeTerminalOpsPayload,
	readTerminalContext,
	resetTerminalDrawings
} from '../terminalOps'
import { setTerminalSymbol, setTerminalWidget, type TerminalChart, type TerminalWidget } from '../terminalViewStore'

/**
 * A series is a study bound to a ticker, not a shape, and the two lifecycles do not overlap:
 * getAllShapes never lists a study, the points live only in the browser, and the whole thing is
 * rebuilt from the ops payload on every restore. Each case here covers a way that mismatch
 * silently loses the agent's work.
 */

const DAY = 86_400
const START = 1_700_000_000 - (1_700_000_000 % DAY)

const created: Array<string> = []
const removed: Array<string> = []
const studies: Array<{ id: string; inputs: Record<string, string | number | boolean> }> = []
const overrides = new Map<string, Record<string, string | number | boolean>>()
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
		createStudy: async (_name: string, _overlay: boolean, _lock: boolean, inputs: Record<string, string>) => {
			const id = `entity_${++nextEntity}`
			created.push(id)
			studies.push({ id, inputs })
			return id
		},
		getStudyById: (id: string) => ({
			applyOverrides: (next: Record<string, string | number | boolean>) => overrides.set(id, next)
		}),
		removeEntity: (id: string) => {
			removed.push(id)
		},
		// The real chart lists shapes only. A study is invisible here, which is exactly the trap.
		getAllShapes: () => [],
		getVisibleRange: () => ({ from: START, to: START + 30 * DAY }),
		resolution: () => '1D'
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

const points = [
	{ time: START, value: 10 },
	{ time: START + DAY, value: 20 },
	{ time: START + 2 * DAY, value: 30 }
]

const seriesPayload = (id: string, text: string, style: 'line' | 'histogram' = 'line', data = points) => ({
	symbol: 'AAVE',
	interval: '1D',
	ops: [
		{ type: 'series' as const, id, number: Number(id.slice(3)), text, style, placement: 'pane' as const, points: data }
	]
})

const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
	created.length = 0
	removed.length = 0
	studies.length = 0
	overrides.clear()
	nextEntity = 0
	setTerminalSymbol('AAVE')
	setTerminalWidget(recordingWidget())
})

afterEach(async () => {
	setTerminalWidget(null)
	resetTerminalDrawings()
	await drain()
	setTerminalSymbol('HYPE')
})

describe('an agent series becomes a study bound to its own ticker', () => {
	test('the points reach the datafeed through the ticker the study was given', async () => {
		applyTerminalOps(seriesPayload('ai_1', 'Aave TVL'))
		await drain()

		expect(studies).toHaveLength(1)
		const ticker = studies[0].inputs[SOURCE_INPUT_ID] as string
		// The numbers never go back to the server: the op carried them and the map answers for them.
		expect(agentSeriesBars(ticker, { to: START + 30 * DAY, countBack: 0 })).toEqual([
			{ time: START * 1000, open: 10, high: 10, low: 10, close: 10, volume: 0 },
			{ time: (START + DAY) * 1000, open: 20, high: 20, low: 20, close: 20, volume: 0 },
			{ time: (START + 2 * DAY) * 1000, open: 30, high: 30, low: 30, close: 30, volume: 0 }
		])
	})

	// countBack counts bars at the resolution the library asked for, and these bars are at whatever
	// resolution the agent computed at. Slicing by it cut 600 of 900 points off the front of an
	// hourly equity curve when the study asked daily — head first, silently, on a chart the user
	// reads. countBack is a minimum the feed must meet, so answering with more keeps the contract.
	test('a bar past `to` is never served, and countBack never truncates the head', async () => {
		applyTerminalOps(seriesPayload('ai_1', 'Aave TVL'))
		await drain()
		const bound = studies[0].inputs[SOURCE_INPUT_ID] as string

		expect(agentSeriesBars(bound, { to: START + DAY, countBack: 0 })).toHaveLength(2)
		const asked = agentSeriesBars(bound, { to: START + 30 * DAY, countBack: 1 })
		expect(asked).toHaveLength(3)
		expect(asked?.[0].time).toBe(START * 1000)
	})

	test('a flow is drawn as columns, not as a line through its own gaps', async () => {
		applyTerminalOps(seriesPayload('ai_1', 'Aave fees', 'histogram'))
		await drain()

		expect(overrides.get(studies[0].id)).toEqual({ 'Value.plottype': 'columns' })
	})
})

describe('a series survives the turns after the one that drew it', () => {
	test('it is still reported to the agent although the chart lists no such shape', async () => {
		applyTerminalOps(seriesPayload('ai_1', 'Aave TVL'))
		await drain()

		// pruneDeleted runs on every turn. A study is not a shape, so an unguarded prune would
		// report the series as deleted and the agent would redraw it forever.
		expect(readTerminalContext().drawings).toEqual([{ id: 'ai_1', kind: 'series', label: 'Aave TVL' }])
		expect(readTerminalContext().drawings).toHaveLength(1)
	})

	test('replacing it by id takes the old study off the chart and rebinds a fresh ticker', async () => {
		applyTerminalOps(seriesPayload('ai_1', 'Aave TVL'))
		await drain()
		const first = studies[0].inputs[SOURCE_INPUT_ID] as string

		applyTerminalOps(seriesPayload('ai_1', 'Aave TVL', 'line', [{ time: START, value: 99 }]))
		await drain()

		expect(removed).toEqual([studies[0].id])
		const second = studies[1].inputs[SOURCE_INPUT_ID] as string
		// A reused ticker would have the library serve the previous series' cached bars.
		expect(second).not.toBe(first)
		expect(agentSeriesBars(second, { to: START + 30 * DAY, countBack: 0 })).toHaveLength(1)
		expect(agentSeriesBars(first, { to: START + 30 * DAY, countBack: 0 })).toBeNull()
	})

	test('a clear takes the study with it', async () => {
		applyTerminalOps(seriesPayload('ai_1', 'Aave TVL'))
		await drain()
		applyTerminalOps({ symbol: 'AAVE', interval: '1D', ops: [{ type: 'clear', ids: ['ai_1'] }] })
		await drain()

		expect(removed).toEqual([studies[0].id])
		expect(readTerminalContext().drawings).toEqual([])
	})
})

describe('the wire shape is the contract with the backend', () => {
	test('a well-formed series op is kept', () => {
		expect(normalizeTerminalOpsPayload(seriesPayload('ai_2', 'Netflow', 'histogram'))?.ops).toEqual([
			{ type: 'series', id: 'ai_2', number: 2, text: 'Netflow', style: 'histogram', placement: 'pane', points }
		])
	})

	test.each([
		['no points', { points: [] }],
		['a point with no value', { points: [{ time: START }] }],
		['no text for the legend', { text: '' }]
	])('a series with %s is dropped rather than half-drawn', (_case, patch) => {
		const payload = seriesPayload('ai_1', 'Aave TVL')
		// An unusable op must not survive: normalizeTerminalOpsPayload nulls a payload it empties,
		// which is what keeps a broken op from reaching createStudy.
		expect(normalizeTerminalOpsPayload({ ...payload, ops: [{ ...payload.ops[0], ...patch }] })).toBeNull()
	})

	test('an unknown style falls back to a line instead of dropping the series', () => {
		const payload = seriesPayload('ai_1', 'Aave TVL')
		const normalized = normalizeTerminalOpsPayload({
			...payload,
			ops: [{ ...payload.ops[0], style: 'candles' }]
		})
		expect(normalized?.ops[0]).toMatchObject({ type: 'series', style: 'line' })
	})
})
