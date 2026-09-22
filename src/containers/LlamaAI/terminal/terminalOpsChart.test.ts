import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { agentTimescaleMarks } from './terminalData'
import {
	applyTerminalOps,
	followTerminalSymbol,
	normalizeTerminalOpsPayload,
	readTerminalContext,
	resetTerminalDrawings,
	type TerminalOp
} from './terminalOps'
import {
	setTerminalSymbol,
	setTerminalWidget,
	type TerminalChart,
	type TerminalShapeOptions,
	type TerminalWidget
} from './terminalViewStore'

/**
 * normalizeOp silently DROPS an op shape this build does not know, so a backend that ships an op
 * ahead of the browser loses it with no error anywhere and the agent reports success. These cases
 * pin the shapes the chart SDK emits: each one has to survive normalization AND reach a real
 * charting call, because passing only the first half is exactly the failure that is invisible.
 */

const DAY = 86_400
const START = 1_700_000_000 - (1_700_000_000 % DAY)

interface Shape {
	id: string
	points: Array<{ time: number; price?: number }>
	options: TerminalShapeOptions
}

const shapes: Array<Shape> = []
const studies: Array<{ id: string; overlay: boolean }> = []
const removed: Array<string> = []
let live: Array<string> = []
let nextEntity = 0

function recordingWidget(): TerminalWidget {
	const record = (points: Array<{ time: number; price?: number }>, options: TerminalShapeOptions) => {
		const id = `entity_${++nextEntity}`
		shapes.push({ id, points, options })
		live.push(id)
		return id
	}
	const chart = {
		createShape: async (point: { time: number; price?: number }, options: TerminalShapeOptions) =>
			record([point], options),
		createMultipointShape: async (points: Array<{ time: number; price: number }>, options: TerminalShapeOptions) =>
			record(points, options),
		createStudy: async (_name: string, overlay: boolean) => {
			const id = `entity_${++nextEntity}`
			studies.push({ id, overlay })
			return id
		},
		getStudyById: () => ({ applyOverrides: () => undefined }),
		removeEntity: (id: string) => {
			removed.push(id)
			live = live.filter((entry) => entry !== id)
		},
		getAllShapes: () => live.map((id) => ({ id, name: 'shape' })),
		getVisibleRange: () => ({ from: START, to: START + 30 * DAY }),
		resolution: () => '1D'
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

function apply(ops: Array<TerminalOp>) {
	applyTerminalOps({ symbol: 'AAVE', interval: '1D', ops })
	return drain()
}

beforeEach(() => {
	shapes.length = 0
	studies.length = 0
	removed.length = 0
	live = []
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

const zone = {
	type: 'zone' as const,
	id: 'ai_1',
	number: 1,
	from: START,
	to: START + 5 * DAY,
	low: 30,
	high: 40,
	text: 'Jan range'
}

const marks = {
	type: 'marks' as const,
	id: 'ai_2',
	number: 2,
	text: 'Unlocks',
	marks: [{ time: START + DAY, text: 'cliff', color: '#f04438' }, { time: START + 2 * DAY }]
}

const event = {
	type: 'event' as const,
	id: 'ai_3',
	number: 3,
	time: START + 3 * DAY,
	text: 'Kelp bridge hack $293M — chain TVL fell 11%'
}

describe('the ops the chart SDK emits survive the wire', () => {
	test('a zone normalizes and becomes a rectangle across both corners', async () => {
		const payload = normalizeTerminalOpsPayload({ symbol: 'AAVE', interval: '1D', ops: [zone] })
		expect(payload?.ops).toEqual([zone])

		await apply(payload!.ops)
		expect(shapes).toHaveLength(1)
		expect(shapes[0].options.shape).toBe('rectangle')
		expect(shapes[0].options.disableSave).toBe(true)
		expect(shapes[0].points).toEqual([
			{ time: START, price: 40 },
			{ time: START + 5 * DAY, price: 30 }
		])
	})

	test('a zone missing a bound is dropped instead of drawn half-placed', () => {
		const payload = normalizeTerminalOpsPayload({
			symbol: 'AAVE',
			interval: '1D',
			ops: [{ ...zone, high: undefined }]
		})
		expect(payload).toBeNull()
	})

	// A vertical line per mark wrote its sentence across the candles; a badge keeps the axis readable
	// and the number is what the answer text refers to.
	test('a marks set is one drawing and one axis badge per mark, with its own colour', async () => {
		const payload = normalizeTerminalOpsPayload({ symbol: 'AAVE', interval: '1D', ops: [marks] })
		expect(payload?.ops).toEqual([marks])

		await apply(payload!.ops)
		expect(shapes).toEqual([])
		const badges = agentTimescaleMarks('AAVE', START, START + 30 * DAY)
		expect(badges.map((badge) => badge.label)).toEqual(['2', '2'])
		expect(badges[0]).toMatchObject({ time: START + DAY, color: '#f04438' })
		expect(badges[0].tooltip).toEqual([
			'#2 · cliff',
			'Unlocks',
			new Date((START + DAY) * 1000).toISOString().slice(0, 10)
		])
		// A mark with no text of its own still says which drawing it belongs to.
		expect(badges[1].tooltip[0]).toBe('#2 · Unlocks')
		expect(readTerminalContext().drawings).toEqual([{ id: 'ai_2', kind: 'marks', label: 'Unlocks' }])
	})

	test('replacing a marks set replaces its badges', async () => {
		await apply([marks])
		await apply([{ ...marks, marks: [{ time: START + 3 * DAY }] }])

		expect(agentTimescaleMarks('AAVE', START, START + 30 * DAY).map((badge) => badge.time)).toEqual([START + 3 * DAY])
	})

	test('a badge belongs to the symbol it was drawn on and to the requested range', async () => {
		await apply([marks])

		expect(agentTimescaleMarks('HYPE', START, START + 30 * DAY)).toEqual([])
		expect(agentTimescaleMarks('AAVE', START, START + 30 * DAY)).toHaveLength(2)
		expect(agentTimescaleMarks('AAVE', START + 2 * DAY, START + 30 * DAY)).toHaveLength(1)
	})

	test('a badge drawn on a HIP-3 market stays on that market, not on a same-named coin elsewhere', async () => {
		applyTerminalOps({ symbol: 'xyz:TSLA', interval: '1D', ops: [marks] })
		await drain()

		expect(agentTimescaleMarks('xyz:TSLA', START, START + 30 * DAY)).toHaveLength(2)
		expect(agentTimescaleMarks('TSLA', START, START + 30 * DAY)).toEqual([])
	})

	// The zone and the event op were added to this registry by two people at once. One payload
	// carrying both has to keep both: normalizeOp drops an op it cannot read with no error
	// anywhere, so whichever side lost the merge disappears while the agent reports success.
	test('an event and a zone in one payload both normalize and both get drawn', async () => {
		const payload = normalizeTerminalOpsPayload({ symbol: 'AAVE', interval: '1D', ops: [zone, event] })
		expect(payload?.ops).toEqual([zone, event])

		await apply(payload!.ops)
		expect(shapes.map((shape) => shape.options.shape)).toEqual(['rectangle'])
		expect(agentTimescaleMarks('AAVE', START, START + 30 * DAY)).toMatchObject([
			{
				time: event.time,
				label: '3',
				tooltip: ['#3 · Kelp bridge hack $293M', 'chain TVL fell 11%', expect.any(String)]
			}
		])
		expect(readTerminalContext().drawings).toEqual([
			{ id: 'ai_1', kind: 'zone', label: 'Jan range' },
			{ id: 'ai_3', kind: 'event', label: event.text }
		])
	})

	test('a clear removes the event badge as well as the zone', async () => {
		await apply([zone, event])
		await apply([{ type: 'clear', ids: ['ai_1', 'ai_3'] }])

		expect(removed).toEqual(['entity_1'])
		expect(agentTimescaleMarks('AAVE', START, START + 30 * DAY)).toEqual([])
		expect(readTerminalContext().drawings).toEqual([])
	})

	// A badge is not a shape, so getAllShapes never lists it. Pruning it as "deleted by the user"
	// would drop it from the agent's context on the very next turn.
	test('events and marks sets stay in the agent context although no shape backs them', async () => {
		await apply([marks, event])
		live = []

		expect(readTerminalContext().drawings.map((drawing) => drawing.id)).toEqual(['ai_2', 'ai_3'])
	})
})

describe('a series chooses its pane', () => {
	const series = {
		type: 'series' as const,
		id: 'ai_1',
		number: 1,
		text: 'Aave TVL',
		style: 'line' as const,
		placement: 'pane' as const,
		points: [{ time: START, value: 10 }]
	}

	test('pane is the default and keeps the series off the price scale', async () => {
		await apply([series])
		expect(studies).toEqual([{ id: 'entity_1', overlay: false }])
	})

	test('overlay puts it on the price, which is what the op asked for', async () => {
		await apply([{ ...series, placement: 'overlay' }])
		expect(studies).toEqual([{ id: 'entity_1', overlay: true }])
	})

	test('an unknown placement falls back to a pane rather than the price scale', () => {
		const payload = normalizeTerminalOpsPayload({
			symbol: 'AAVE',
			interval: '1D',
			ops: [{ ...series, placement: 'price' }]
		})
		expect(payload?.ops[0]).toMatchObject({ placement: 'pane' })
	})

	test('area joins line and histogram as a style this build can draw', () => {
		const payload = normalizeTerminalOpsPayload({
			symbol: 'AAVE',
			interval: '1D',
			ops: [{ ...series, style: 'area' }]
		})
		expect(payload?.ops[0]).toMatchObject({ style: 'area' })
	})
})

describe('the chart switching symbol under a restored chat', () => {
	test('drawings for the new symbol are redrawn once its data is ready; another symbol drops them', async () => {
		await apply([zone])
		const chart = Object.assign(recordingWidget().activeChart(), {
			symbolExt: () => ({ ticker: 'AAVE' }),
			symbol: () => 'AAVE',
			dataReady: (callback: () => void) => {
				whenReady = callback
				return false
			}
		})
		let whenReady = () => {}
		live = []

		followTerminalSymbol(chart)
		await drain()
		expect(live).toHaveLength(0)
		whenReady()
		await drain()
		expect(live).toHaveLength(1)
		expect(readTerminalContext().drawings).toEqual([{ id: 'ai_1', kind: 'zone', label: 'Jan range' }])

		followTerminalSymbol(Object.assign(chart, { symbolExt: () => ({ ticker: 'ETH' }) }))
		expect(readTerminalContext().drawings).toEqual([])
	})
})
