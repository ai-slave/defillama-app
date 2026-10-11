import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
	createTerminalDatafeed,
	getTerminalLayers,
	loadTerminalLayers,
	reloadTerminalLayers,
	saveTerminalLayers,
	type TerminalLayers,
	type TerminalSymbolInfo,
	type TerminalTimescaleMark
} from '../terminalData'
import { layerMenuItems } from '../terminalLayers'
import {
	applyTerminalLayers,
	applyTerminalOps,
	clearTerminalAgentDrawings,
	readTerminalContext,
	resetTerminalDrawings,
	type TerminalOp
} from '../terminalOps'
import {
	listTerminalScripts,
	registerTerminalScript,
	resetTerminalScripts,
	setTerminalSymbol,
	setTerminalWidget,
	type TerminalChart,
	type TerminalShapeOptions,
	type TerminalWidget
} from '../terminalViewStore'

const DAY = 86_400
const START = 1_700_000_000 - (1_700_000_000 % DAY)
const ALL_ON: TerminalLayers = { unlocks: true, events: true, drawings: true, trades: true }

const puts: Array<{ settings: { terminalLayers: TerminalLayers } }> = []
const settingsFetch = (async (_url: unknown, init?: RequestInit) => {
	if (init?.method === 'PUT') puts.push(JSON.parse(String(init.body)))
	return { ok: true, json: async () => ({ settings: { terminalLayers: puts.at(-1)?.settings.terminalLayers } }) }
}) as unknown as typeof fetch

function setLayers(next: Partial<TerminalLayers>) {
	saveTerminalLayers({ ...ALL_ON, ...next }, settingsFetch)
}

interface Shape {
	id: string
	points: Array<{ time: number; price?: number }>
	options: TerminalShapeOptions
}

let shapes: Array<Shape> = []
let live: Array<string> = []
let studies: Array<string> = []
let nextEntity = 0
let marksRefreshed = 0

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
		createStudy: async () => {
			const id = `entity_${++nextEntity}`
			studies.push(id)
			return id
		},
		removeEntity: (id: string) => {
			live = live.filter((entry) => entry !== id)
			studies = studies.filter((entry) => entry !== id)
		},
		getAllShapes: () => live.map((id) => ({ id, name: 'shape' })),
		getVisibleRange: () => ({ from: START, to: START + 30 * DAY }),
		resolution: () => '1D',
		clearMarks: () => undefined,
		refreshMarks: () => {
			marksRefreshed++
		}
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

function apply(ops: Array<TerminalOp>) {
	applyTerminalOps({ symbol: 'AAVE', interval: '1D', ops })
	return drain()
}

const hline: TerminalOp = { type: 'hline', id: 'ai_1', number: 1, price: 42, text: 'support' }
const trendline: TerminalOp = {
	type: 'trendline',
	id: 'ai_2',
	number: 2,
	points: [
		{ time: START, price: 40 },
		{ time: START + 5 * DAY, price: 50 }
	]
}
const zone: TerminalOp = { type: 'zone', id: 'ai_5', number: 5, from: START, to: START + 5 * DAY, low: 30, high: 40 }
const trades: TerminalOp = {
	type: 'trades',
	id: 'ai_3',
	number: 3,
	text: 'Backtest',
	fills: [{ time: START + DAY, price: 41, kind: 'long_entry' }]
}
const event: TerminalOp = {
	type: 'event',
	id: 'ai_4',
	number: 4,
	time: START + 3 * DAY,
	text: 'Kelp bridge hack $293M — chain TVL fell 11%'
}

beforeEach(() => {
	shapes = []
	live = []
	studies = []
	puts.length = 0
	nextEntity = 0
	marksRefreshed = 0
	setLayers({})
	setTerminalSymbol('AAVE')
	setTerminalWidget(recordingWidget())
})

afterEach(async () => {
	setTerminalWidget(null)
	resetTerminalDrawings()
	resetTerminalScripts()
	setLayers({})
	await drain()
	setTerminalSymbol('HYPE')
})

describe('the datafeed serves unlock badges and agent badges as one set', () => {
	const UNLOCK: TerminalTimescaleMark = {
		id: 'u1',
		time: START + 2 * DAY,
		color: '#f2994a',
		label: 'U',
		tooltip: ['Unlock']
	}
	const symbolInfo: TerminalSymbolInfo = { name: 'AAVE', ticker: 'AAVE' }

	// The bundle exports only the leaf class, and the datafeed extends the base above it.
	class UdfBase {
		getTimescaleMarks(
			_symbolInfo: TerminalSymbolInfo,
			_from: number,
			_to: number,
			onResult: (marks: Array<TerminalTimescaleMark>) => void
		) {
			onResult([UNLOCK])
		}
	}
	class UdfLeaf extends UdfBase {}

	beforeEach(() => {
		const script = { src: '', addEventListener: (name: string, run: () => void) => name === 'load' && run() }
		vi.stubGlobal('window', { Datafeeds: { UDFCompatibleDatafeed: UdfLeaf } })
		vi.stubGlobal('document', {
			createElement: () => script,
			head: { appendChild: () => undefined },
			documentElement: {}
		})
		vi.stubGlobal('getComputedStyle', () => ({
			getPropertyValue: (name: string) => (name === '--bg-brand' ? ' brand-token ' : '')
		}))
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	async function marksFor(from = START, to = START + 30 * DAY, fetchFn = settingsFetch) {
		const datafeed = await createTerminalDatafeed({ fetchFn })
		return new Promise<Array<TerminalTimescaleMark>>((resolve) =>
			datafeed.getTimescaleMarks(symbolInfo, from, to, resolve, '1D')
		)
	}

	test('both groups arrive, the agent badge in the brand color and numbered like the chat', async () => {
		await apply([event])

		const marks = await marksFor()

		expect(marks[0]).toEqual(UNLOCK)
		expect(marks.slice(1)).toMatchObject([{ time: START + 3 * DAY, label: '4', color: 'brand-token' }])
	})

	test('Unlocks off drops the server marks and keeps the agent badges', async () => {
		await apply([event])
		setLayers({ unlocks: false })

		expect((await marksFor()).map((mark) => mark.label)).toEqual(['4'])
	})

	test('a new terminal reads the layers from the settings again instead of keeping the last ones', async () => {
		await apply([event])
		setLayers({})
		const unlocksHidden = (async () => ({
			ok: true,
			json: async () => ({ settings: { terminalLayers: { unlocks: false } } })
		})) as unknown as typeof fetch

		expect((await marksFor(START, START + 30 * DAY, unlocksHidden)).map((mark) => mark.label)).toEqual(['4'])
	})

	test('Events off drops the agent badges and keeps the unlocks', async () => {
		await apply([event])
		setLayers({ events: false })

		expect(await marksFor()).toEqual([UNLOCK])
	})
})

describe('the time axis follows the badge set', () => {
	// Without a refresh a new event shows up only after the next pan; with one on every payload, a
	// saved script re-running on every pan refetches the unlocks each frame.
	test('a new badge refreshes the marks, and the same set applied again does not', async () => {
		await apply([event])
		expect(marksRefreshed).toBe(1)

		await apply([event])
		expect(marksRefreshed).toBe(1)
	})
})

describe('hiding a layer is visual only', () => {
	// The agent refers back to drawings it cannot see; a hidden one that dropped out of the context
	// would get redrawn under a new number, or denied.
	test('hidden AI drawings and trade markers stay in the agent context', async () => {
		await apply([hline, trades, event])
		setLayers({ drawings: false, trades: false, events: false })
		applyTerminalLayers()
		await drain()

		expect(live).toEqual([])
		expect(studies).toEqual([])
		expect(readTerminalContext().drawings.map((drawing) => drawing.id)).toEqual(['ai_1', 'ai_3', 'ai_4'])
	})

	test('AI drawings off then on puts back the same drawings, and leaves trade markers alone', async () => {
		await apply([zone, trendline, trades])
		const before = shapes.map(({ points, options }) => ({ points, options }))

		setLayers({ drawings: false })
		applyTerminalLayers()
		await drain()
		expect(live).toEqual([])
		expect(studies).toHaveLength(1)

		shapes = []
		setLayers({ drawings: true })
		applyTerminalLayers()
		await drain()
		expect(shapes.map(({ points, options }) => ({ points, options }))).toEqual(before)
		expect(live).toHaveLength(2)
		expect(studies).toHaveLength(1)
	})

	test('a drawing that arrives while its layer is hidden is not drawn, but is listed', async () => {
		setLayers({ drawings: false })
		await apply([hline])

		expect(shapes).toEqual([])
		expect(readTerminalContext().drawings).toEqual([{ id: 'ai_1', kind: 'hline', label: 'support' }])
	})
})

describe('Clear AI drawings', () => {
	test('empties the agent context and keeps the user’s own drawing', async () => {
		await apply([hline, trendline, trades, event])
		live.push('user_shape')

		clearTerminalAgentDrawings()
		await drain()

		expect(readTerminalContext().drawings).toEqual([])
		expect(live).toEqual(['user_shape'])
		expect(studies).toEqual([])
	})

	// A saved script re-applies its drawings on the next pan, which would undo the clear.
	test('forgets the saved scripts that would draw them again', async () => {
		registerTerminalScript('scripts/rsi.js', [])
		await apply([hline])

		clearTerminalAgentDrawings()

		expect(listTerminalScripts()).toEqual([])
	})
})

describe('the Layers menu', () => {
	test('marks exactly the layers that are on, and each item toggles its own layer', () => {
		const toggled: Array<string> = []
		const items = layerMenuItems({ ...ALL_ON, events: false }, (key) => toggled.push(key))

		expect(items.map((item) => [item.title, item.icon?.includes('<path')])).toEqual([
			['Unlocks', true],
			['Events', false],
			['AI drawings', true],
			['Trade markers', true]
		])
		for (const item of items) item.onSelect()
		expect(toggled).toEqual(['unlocks', 'events', 'drawings', 'trades'])
	})

	test('a toggle is saved to the user settings under terminalLayers', () => {
		setLayers({ trades: false })

		expect(puts.at(-1)).toEqual({ settings: { terminalLayers: { ...ALL_ON, trades: false } } })
	})
})

// Layer choices are one user's settings. A new terminal starts from the signed-in user's stored
// choices, never from whoever used the chart before, or toggling one layer would save the previous
// user's other choices into this user's settings.
describe('where the layer choices come from', () => {
	const settingsResponse = (terminalLayers: Partial<TerminalLayers>) =>
		({ ok: true, json: async () => ({ settings: { terminalLayers } }) }) as Response

	afterEach(() => setLayers({}))

	test("a new terminal loads the current user's layers and drops the previous user's", async () => {
		setLayers({ events: false })
		await reloadTerminalLayers((async () => settingsResponse({ trades: false })) as unknown as typeof fetch)
		expect(getTerminalLayers()).toEqual({ ...ALL_ON, trades: false })

		setLayers({ events: false })
		await reloadTerminalLayers((async () => ({ ok: false, status: 500 }) as Response) as unknown as typeof fetch)
		expect(getTerminalLayers()).toEqual(ALL_ON)
	})

	test('a failed load is asked once, not again on every pan', async () => {
		const failing = vi.fn(async () => ({ ok: false, status: 500 }) as Response)
		await reloadTerminalLayers(failing as unknown as typeof fetch)
		await loadTerminalLayers(failing as unknown as typeof fetch)
		await loadTerminalLayers(failing as unknown as typeof fetch)
		expect(failing).toHaveBeenCalledTimes(1)
		expect(getTerminalLayers()).toEqual(ALL_ON)
	})

	test("a slow load from the previous terminal does not overwrite this one's layers", async () => {
		let answerOld: (response: Response) => void = () => {}
		const old = reloadTerminalLayers((() => new Promise<Response>((resolve) => (answerOld = resolve))) as typeof fetch)
		await reloadTerminalLayers((async () => settingsResponse({ unlocks: false })) as unknown as typeof fetch)
		answerOld(settingsResponse({ drawings: false }))
		await old
		expect(getTerminalLayers()).toEqual({ ...ALL_ON, unlocks: false })
	})
})
