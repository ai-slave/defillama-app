import { afterEach, describe, expect, test, vi } from 'vitest'
import { createAgenticMutationEnvelope } from '~/containers/LlamaAI/mutationProtocol'
import { applyTerminalOps, readTerminalContext, resetTerminalDrawings, restoreTerminalDrawings } from './terminalOps'
import { setTerminalSymbol, setTerminalWidget, type TerminalChart, type TerminalWidget } from './terminalViewStore'

/**
 * Without terminalContext the backend sees no terminal surface at all, so draw_on_chart and
 * get_chart_image both refuse. These cases pin the three things that make it usable: the agent's
 * own ai_* ids come from the live drawing map, the snapshot is taken once so a retry replays it
 * byte for byte, and a user who cannot see a chart is never told there is one.
 */

const RANGE = { from: 1_750_000_000, to: 1_757_000_000 }

function fakeWidget(chart: Partial<TerminalChart>): TerminalWidget {
	return {
		activeChart: () => ({ createShape: async () => null, removeEntity: () => undefined, ...chart }) as TerminalChart
	} as unknown as TerminalWidget
}

function readyWidget(range = RANGE, resolution = '60') {
	return fakeWidget({ getVisibleRange: () => range, resolution: () => resolution })
}

function drawn(id: string, price: number, text?: string) {
	return {
		symbol: 'HYPE',
		interval: '60',
		ops: [{ type: 'hline' as const, id, number: Number(id.slice(3)), price, ...(text && { text }) }]
	}
}

afterEach(async () => {
	vi.restoreAllMocks()
	setTerminalWidget(null)
	resetTerminalDrawings()
	// The ops queue is a module-level promise chain; let it drain before the next case reads the map.
	await new Promise((resolve) => setTimeout(resolve, 0))
	setTerminalSymbol('HYPE')
})

describe('readTerminalContext', () => {
	// A symbol change runs the saved scripts before the new chart has painted, so the fallback
	// branch is taken twice about a second apart. On a wall-clock `now` those two differ by that
	// second, which is a different run key — the client dedupe misses, and because the two overlap
	// in flight the server cache is cold too, so one symbol change really did run a script three
	// times. Measured on the dev server: 1782142054/1789918054 then 1782142055/1789918055.
	test('the fallback range is stable across calls a second apart', () => {
		setTerminalWidget(null)
		setTerminalSymbol('BTC')

		const now = Date.UTC(2026, 8, 22, 12)
		const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
		const first = readTerminalContext()
		clock.mockReturnValue(now + 1000)
		const later = readTerminalContext()

		expect(later.from).toBe(first.from)
		expect(later.to).toBe(first.to)
		// Floored to the bar it claims, so the window it reports is one the chart could actually draw.
		expect(first.to % 86_400).toBe(0)
	})

	test('reports the live symbol, resolution and visible range in unix seconds', () => {
		setTerminalSymbol('BTC')
		setTerminalWidget(readyWidget())

		expect(readTerminalContext()).toEqual({
			symbol: 'BTC',
			interval: '60',
			from: RANGE.from,
			to: RANGE.to,
			drawings: []
		})
	})

	test('carries the ai_* ids of the drawings the agent currently owns', () => {
		setTerminalWidget(readyWidget())
		applyTerminalOps(drawn('ai_1', 42, 'support'))
		applyTerminalOps(drawn('ai_2', 51))

		expect(readTerminalContext().drawings).toEqual([
			{ id: 'ai_1', kind: 'hline', label: 'support' },
			{ id: 'ai_2', kind: 'hline' }
		])
	})

	// Both chats drew on HYPE, so no symbol change clears the first one's lines. The agent in the
	// reopened chat would otherwise be told it owns drawings it never made.
	test('reopening a chat shows only that chat’s drawings', () => {
		setTerminalWidget(readyWidget())
		applyTerminalOps(drawn('ai_1', 42, 'from the other chat'))
		applyTerminalOps(drawn('ai_3', 60))

		restoreTerminalDrawings([{ terminalOps: drawn('ai_1', 51, 'this chat') }, {}])

		expect(readTerminalContext().drawings).toEqual([{ id: 'ai_1', kind: 'hline', label: 'this chat' }])
	})

	test('still sends a usable range while the chart is not ready, so the prompt goes out', () => {
		setTerminalWidget(fakeWidget({}))

		const context = readTerminalContext()

		expect(context.symbol).toBe('HYPE')
		expect(context.interval).toBe('1D')
		// The backend drops any context whose range is not strictly increasing.
		expect(context.to).toBeGreaterThan(context.from)
	})
})

describe('terminalContext on the mutation envelope', () => {
	function envelope(terminalContext?: ReturnType<typeof readTerminalContext>) {
		return createAgenticMutationEnvelope({
			clientMutationId: 'mutation-1',
			message: 'Where is support?',
			sessionId: 'session-1',
			mode: 'quick',
			enablePremiumTools: false,
			terminalContext
		})
	}

	test('carries the snapshot it was built from', () => {
		setTerminalWidget(readyWidget())
		applyTerminalOps(drawn('ai_1', 42))

		expect(envelope(readTerminalContext()).terminalContext).toEqual({
			symbol: 'HYPE',
			interval: '60',
			from: RANGE.from,
			to: RANGE.to,
			drawings: [{ id: 'ai_1', kind: 'hline' }]
		})
	})

	test('omits the key entirely when there is no terminal surface', () => {
		expect('terminalContext' in envelope(undefined)).toBe(false)
	})
})
