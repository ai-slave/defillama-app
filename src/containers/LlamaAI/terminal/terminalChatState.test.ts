import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { loadTerminalChatState, resetTerminalChat, startTerminalChatSaving } from './terminalChatState'
import {
	applyTerminalOps,
	clearTerminalAgentDrawings,
	pruneDeletedTerminalDrawings,
	readTerminalChatState,
	readTerminalContext,
	syncTerminalDrawing,
	type TerminalChatState,
	type TerminalOp,
	type TerminalOpsPayload
} from './terminalOps'
import {
	listTerminalScripts,
	setTerminalSymbol,
	setTerminalWidget,
	type TerminalChart,
	type TerminalShapeOptions,
	type TerminalWidget
} from './terminalViewStore'

/**
 * A chat's chart used to be rebuilt by replaying the agent's ops from its messages, which brought
 * back every drawing the user had cleared, deleted or moved. The chart is now saved as a snapshot per
 * chat, so these cases pin what a reload shows after each user action, and the two ways a snapshot
 * could be overwritten or lost: a failed read, and a switch to another chat.
 */

const DAY = 86_400
const START = 1_700_000_000 - (1_700_000_000 % DAY)

interface Shape {
	id: string
	points: Array<{ time: number; price?: number }>
	text?: string
}

let shapes: Array<Shape> = []
let resolution = '1D'
let nextEntity = 0
const resolutions: Array<string> = []
const calls: Array<{ url: string; method: string; state?: TerminalChatState }> = []
let answerGet: () => Promise<Response> = async () => reply({ state: null })

function reply(data: unknown, status = 200) {
	return { ok: status < 300, status, json: async () => data } as Response
}

const fakeFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
	const method = init?.method ?? 'GET'
	calls.push({ url: String(url), method, state: init?.body ? JSON.parse(String(init.body)).state : undefined })
	return method === 'GET' ? answerGet() : reply(null, 204)
}) as typeof fetch

function recordingWidget(): TerminalWidget {
	const record = (points: Array<{ time: number; price?: number }>, options: TerminalShapeOptions) => {
		const id = `entity_${++nextEntity}`
		shapes.push({ id, points, text: options.text })
		return id
	}
	const chart = {
		createShape: async (point: { time: number; price?: number }, options: TerminalShapeOptions) =>
			record([point], options),
		createMultipointShape: async (points: Array<{ time: number; price: number }>, options: TerminalShapeOptions) =>
			record(points, options),
		createStudy: async () => null,
		removeEntity: (id: string) => {
			shapes = shapes.filter((shape) => shape.id !== id)
		},
		getAllShapes: () => shapes.map(({ id }) => ({ id, name: 'shape' })),
		getShapeById: (id: string) => {
			const shape = shapes.find((entry) => entry.id === id)!
			return { getPoints: () => shape.points, getProperties: () => ({ text: shape.text }) }
		},
		getVisibleRange: () => ({ from: START, to: START + 30 * DAY }),
		resolution: () => resolution,
		setResolution: async (next: string) => {
			resolutions.push(next)
			resolution = next
			return true
		},
		clearMarks: () => undefined,
		refreshMarks: () => undefined
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

const hline = (id: string, number: number, price: number) =>
	({ type: 'hline', id, number, price, text: `level ${number}` }) as const

const turn = (ops: Array<TerminalOp>): TerminalOpsPayload => ({ symbol: 'BTC', interval: '1D', ops })

const settle = () => vi.advanceTimersByTimeAsync(1100)

const putsTo = (sessionId: string) =>
	calls.filter((call) => call.method === 'PUT' && call.url.endsWith(`/${sessionId}`)).map((call) => call.state!)

const lastPut = (sessionId: string) => putsTo(sessionId).at(-1)

const drawnIds = () => readTerminalContext().drawings.map((drawing) => drawing.id)

async function open(
	sessionId: string,
	snapshot: TerminalChatState | null,
	messages: Array<{ terminalOps?: TerminalOpsPayload }>
) {
	answerGet = async () => reply({ state: snapshot === null ? null : JSON.parse(JSON.stringify(snapshot)) })
	const symbol = loadTerminalChatState(sessionId, messages, fakeFetch, null)
	await settle()
	return symbol
}

async function reload(sessionId: string, messages: Array<{ terminalOps?: TerminalOpsPayload }>) {
	const saved = lastPut(sessionId)
	resetTerminalChat()
	await settle()
	await open(sessionId, saved ?? null, messages)
}

let stopSaving: () => void

beforeEach(() => {
	vi.useFakeTimers()
	vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} })
	shapes = []
	resolution = '1D'
	nextEntity = 0
	resolutions.length = 0
	calls.length = 0
	setTerminalSymbol('BTC')
	setTerminalWidget(recordingWidget())
	stopSaving = startTerminalChatSaving(fakeFetch)
})

afterEach(async () => {
	stopSaving()
	resetTerminalChat()
	setTerminalWidget(null)
	await vi.runAllTimersAsync()
	vi.useRealTimers()
	vi.unstubAllGlobals()
	setTerminalSymbol('HYPE')
})

const twoLevels = [{ terminalOps: turn([hline('ai_1', 1, 100), hline('ai_2', 2, 200)]) }]

describe('the per-chat chart snapshot', () => {
	test('round trips the drawings, the scripts and the interval through the server', async () => {
		resolution = '240'
		applyTerminalOps(
			turn([
				hline('ai_1', 1, 100),
				{ type: 'zone', id: 'ai_2', number: 2, from: START, to: START + DAY, low: 90, high: 110 },
				{ type: 'script', file: 'scripts/mid.js', inputs: ['candles'] }
			])
		)
		await settle()
		const saved = readTerminalChatState()
		expect(saved.interval).toBe('240')

		resetTerminalChat()
		resolution = '1D'
		await settle()
		expect(shapes).toEqual([])

		await expect(open('chat-a', saved, [])).resolves.toBe('BTC')

		expect(readTerminalChatState()).toEqual(saved)
		expect(listTerminalScripts()).toEqual(['scripts/mid.js'])
		expect(resolutions).toEqual(['240'])
		expect(shapes.map((shape) => shape.text)).toEqual(['1 level 1', '2'])
	})

	test('"Clear AI drawings" survives a reload instead of the messages drawing everything again', async () => {
		await open('chat-a', null, twoLevels)
		expect(drawnIds()).toEqual(['ai_1', 'ai_2'])

		clearTerminalAgentDrawings()
		await settle()
		await reload('chat-a', twoLevels)

		expect(drawnIds()).toEqual([])
		expect(shapes).toEqual([])
	})

	test('a drawing the user deleted stays deleted after a reload, and only that one', async () => {
		await open('chat-a', null, twoLevels)
		shapes = shapes.filter((shape) => shape.text !== '1 level 1')

		pruneDeletedTerminalDrawings()
		await settle()
		await reload('chat-a', twoLevels)

		expect(drawnIds()).toEqual(['ai_2'])
	})

	test('a drawing the user moved reloads where they left it', async () => {
		await open('chat-a', null, twoLevels)
		const moved = shapes.find((shape) => shape.text === '2 level 2')!
		moved.points = [{ time: START, price: 250 }]

		syncTerminalDrawing(moved.id)
		await settle()
		await reload('chat-a', twoLevels)

		expect(readTerminalChatState().ops).toEqual([hline('ai_1', 1, 100), hline('ai_2', 2, 250)])
	})

	test('an old chat with no snapshot replays its messages once and saves the result', async () => {
		await open('chat-a', null, twoLevels)

		expect(drawnIds()).toEqual(['ai_1', 'ai_2'])
		expect(putsTo('chat-a')).toEqual([
			{ symbol: 'BTC', interval: '1D', ops: [hline('ai_1', 1, 100), hline('ai_2', 2, 200)], scripts: [] }
		])
	})

	test.each([
		['a server error', async () => reply({ error: 'boom' }, 500)],
		['a network error', async () => Promise.reject(new Error('offline'))]
	])('%s on the read replays the messages but never overwrites the snapshot', async (_, failure) => {
		answerGet = failure as () => Promise<Response>
		await loadTerminalChatState('chat-a', twoLevels, fakeFetch, null)
		expect(drawnIds()).toEqual(['ai_1', 'ai_2'])

		applyTerminalOps(turn([hline('ai_3', 3, 300)]))
		clearTerminalAgentDrawings()
		await settle()

		expect(putsTo('chat-a')).toEqual([])
	})

	test('switching chats saves the pending change to the chat it was made in', async () => {
		await open('chat-a', { symbol: 'BTC', interval: '1D', ops: [hline('ai_1', 1, 100)], scripts: [] }, [])
		applyTerminalOps(turn([hline('ai_2', 2, 200)]))

		await open('chat-b', { symbol: 'BTC', interval: '1D', ops: [hline('ai_7', 7, 700)], scripts: [] }, [])
		await settle()

		expect(lastPut('chat-a')?.ops.map((op) => op.id)).toEqual(['ai_1', 'ai_2'])
		expect(putsTo('chat-b').flatMap((state) => state.ops.map((op) => op.id))).not.toContain('ai_2')
		expect(drawnIds()).toEqual(['ai_7'])
	})

	test('agent ops that stream in while the snapshot loads land on top of it', async () => {
		let answer: (response: Response) => void = () => undefined
		answerGet = () => new Promise((resolve) => (answer = resolve))
		const loaded = loadTerminalChatState('chat-a', [], fakeFetch, null)
		await settle()

		applyTerminalOps(turn([hline('ai_9', 9, 900)]))
		answer(reply({ state: { symbol: 'BTC', interval: '1D', ops: [hline('ai_1', 1, 100)], scripts: [] } }))
		await loaded
		await settle()

		expect(drawnIds()).toEqual(['ai_1', 'ai_9'])
		expect(lastPut('chat-a')?.ops.map((op) => op.id)).toEqual(['ai_1', 'ai_9'])
	})
})
