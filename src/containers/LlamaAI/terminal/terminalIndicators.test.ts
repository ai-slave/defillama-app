import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetTerminalIndicatorRuns, runTerminalIndicators } from './terminalIndicators'
import { followTerminalSymbol, resetTerminalDrawings, restoreTerminalDrawings } from './terminalOps'
import {
	registerTerminalScript,
	resetTerminalScripts,
	setTerminalSymbol,
	setTerminalWidget,
	type TerminalChart,
	type TerminalWidget
} from './terminalViewStore'

/**
 * C5 chose "re-run on every symbol AND range change" over a manual button, so a panning user is
 * the normal case, not the edge case. What keeps that affordable is that an unchanged view costs
 * nothing at all, and what keeps it correct is that a failed run does not poison the view it
 * failed on. Both are here. The drawing-side cases live in terminalOpsScript.test.ts.
 */

const DAY = 86_400
const START = 1_700_000_000 - (1_700_000_000 % DAY)
const VIEW = { symbol: 'BTC', interval: '1D', from: START, to: START + 30 * DAY }

const created: Array<string> = []
const removed: Array<string> = []

function recordingWidget(): TerminalWidget {
	const chart = {
		createShape: async () => {
			const id = `entity_${created.length + 1}`
			created.push(id)
			return id
		},
		createMultipointShape: async () => null,
		createStudy: async () => null,
		removeEntity: (id: string) => {
			removed.push(id)
		},
		getAllShapes: () => [],
		getVisibleRange: () => ({ from: VIEW.from, to: VIEW.to }),
		resolution: () => VIEW.interval
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

function opsResponse(price: number) {
	return {
		ok: true,
		json: async () => ({
			symbol: 'BTC',
			interval: '1d',
			script: 'scripts/mid.js',
			inputs: ['candles'],
			ops: [
				{ type: 'clear', ids: ['sab12cd34_1'] },
				{ type: 'hline', id: 'sab12cd34_1', number: 1, price, text: 'Mid' }
			]
		})
	} as unknown as Response
}

let fetchFn: ReturnType<typeof vi.fn>

beforeEach(() => {
	created.length = 0
	removed.length = 0
	resetTerminalScripts()
	resetTerminalIndicatorRuns()
	resetTerminalDrawings()
	setTerminalSymbol('BTC')
	setTerminalWidget(recordingWidget())
	fetchFn = vi.fn(async () => opsResponse(100))
})

afterEach(() => {
	setTerminalWidget(null)
	resetTerminalDrawings()
	resetTerminalScripts()
})

describe('re-running saved indicators', () => {
	test('with no saved script, a pan costs no request at all', async () => {
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		expect(fetchFn).not.toHaveBeenCalled()
	})

	test('posts the view the chart is showing, so one script serves every symbol', async () => {
		registerTerminalScript('scripts/mid.js', ['candles'])
		await runTerminalIndicators({ ...VIEW, symbol: 'ARB' }, fetchFn as unknown as typeof fetch)

		expect(fetchFn).toHaveBeenCalledTimes(1)
		const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
		expect(url).toMatch(/\/terminal\/indicators\/run$/)
		expect(JSON.parse(String(init.body))).toEqual({
			script: 'scripts/mid.js',
			symbol: 'ARB',
			interval: '1D',
			from: VIEW.from,
			to: VIEW.to
		})
	})

	test('the returned ops reach the chart', async () => {
		registerTerminalScript('scripts/mid.js', ['candles'])
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		await Promise.resolve()
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(created.length).toBe(1)
	})

	test('an unchanged view is not re-requested — this is what a pan back and forth costs', async () => {
		registerTerminalScript('scripts/mid.js', ['candles'])
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		expect(fetchFn).toHaveBeenCalledTimes(1)
	})

	test('a changed range is a new run', async () => {
		registerTerminalScript('scripts/mid.js', ['candles'])
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		await runTerminalIndicators({ ...VIEW, to: VIEW.to + DAY }, fetchFn as unknown as typeof fetch)
		expect(fetchFn).toHaveBeenCalledTimes(2)
	})

	test('a failed run does not pin the view, so the next attempt at the same range still goes out', async () => {
		registerTerminalScript('scripts/mid.js', ['candles'])
		fetchFn.mockRejectedValueOnce(new Error('offline'))
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		expect(fetchFn).toHaveBeenCalledTimes(2)
	})

	test('a range the chart could not read is never sent', async () => {
		registerTerminalScript('scripts/mid.js', ['candles'])
		await runTerminalIndicators({ ...VIEW, to: VIEW.from }, fetchFn as unknown as typeof fetch)
		expect(fetchFn).not.toHaveBeenCalled()
	})

	test('every saved script runs, not just the newest one', async () => {
		registerTerminalScript('scripts/mid.js', ['candles'])
		registerTerminalScript('scripts/bands.js', ['candles'])
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		expect(fetchFn).toHaveBeenCalledTimes(2)
	})
})

// Scripts belong to the conversation that saved them. A chart chat's script left running in the next
// chat re-runs on every pan there, and its drawings land in that chat's context for the agent.
describe('saved scripts across chats', () => {
	const scriptTurn = (file: string) => ({
		terminalOps: { symbol: 'BTC', interval: '1D', ops: [{ type: 'script' as const, file, inputs: ['candles'] }] }
	})
	const postedScripts = () => fetchFn.mock.calls.map(([, init]) => JSON.parse(String(init.body)).script)

	test("opening another chat drops the first chat's scripts and runs only its own", async () => {
		restoreTerminalDrawings([scriptTurn('scripts/a.js')])
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		restoreTerminalDrawings([scriptTurn('scripts/b.js')])
		await runTerminalIndicators({ ...VIEW, to: VIEW.to + DAY }, fetchFn as unknown as typeof fetch)
		restoreTerminalDrawings([])
		await runTerminalIndicators({ ...VIEW, to: VIEW.to + 2 * DAY }, fetchFn as unknown as typeof fetch)
		expect(postedScripts()).toEqual(['scripts/a.js', 'scripts/b.js'])
	})

	test('the same script saved in the next chat still runs on the same view', async () => {
		restoreTerminalDrawings([scriptTurn('scripts/mid.js')])
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		restoreTerminalDrawings([scriptTurn('scripts/mid.js')])
		await runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		expect(fetchFn).toHaveBeenCalledTimes(2)
	})

	test('a run still in flight when the chat changes draws nothing into the new chat', async () => {
		let answer: (response: Response) => void = () => {}
		fetchFn.mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)))
		registerTerminalScript('scripts/mid.js', ['candles'])
		const run = runTerminalIndicators(VIEW, fetchFn as unknown as typeof fetch)
		restoreTerminalDrawings([])
		answer(opsResponse(100))
		await run
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(created.length).toBe(0)
	})

	test('a symbol change in the same chat keeps the scripts', async () => {
		restoreTerminalDrawings([scriptTurn('scripts/mid.js')])
		followTerminalSymbol({ symbol: () => 'ARB', symbolExt: () => null } as unknown as TerminalChart)
		await runTerminalIndicators({ ...VIEW, symbol: 'ARB' }, fetchFn as unknown as typeof fetch)
		expect(postedScripts()).toEqual(['scripts/mid.js'])
	})
})
