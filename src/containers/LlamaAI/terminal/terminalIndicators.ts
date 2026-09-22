import { AI_SERVER } from '~/constants'
import { applyTerminalOps, normalizeTerminalOpsPayload } from './terminalOps'
import { listTerminalScripts } from './terminalViewStore'

const RUN_URL = `${AI_SERVER}/terminal/indicators/run`

export interface TerminalRunContext {
	symbol: string
	interval: string
	from: number
	to: number
}

// A run is keyed by everything the backend keys its cache on, so a pan that lands back where it
// started, or a second subscriber firing for the same frame, costs nothing.
function runKey(script: string, context: TerminalRunContext): string {
	return [script, context.symbol, context.interval, context.from, context.to].join('|')
}

const lastRun = new Map<string, string>()
const inFlight = new Map<string, Promise<void>>()
let generation = 0

export function resetTerminalIndicatorRuns() {
	generation++
	lastRun.clear()
	inFlight.clear()
}

async function runOne(script: string, context: TerminalRunContext, fetchFn: typeof fetch): Promise<void> {
	const startedIn = generation
	const response = await fetchFn(RUN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			script,
			symbol: context.symbol,
			interval: context.interval,
			from: context.from,
			to: context.to
		})
	})
	if (!response.ok) return
	const payload = normalizeTerminalOpsPayload(await response.json())
	if (payload && startedIn === generation) applyTerminalOps(payload)
}

export async function runTerminalIndicators(context: TerminalRunContext, fetchFn: typeof fetch): Promise<void> {
	if (!context.symbol || !context.interval || context.to <= context.from) return
	await Promise.all(
		listTerminalScripts().map((script) => {
			const key = runKey(script, context)
			if (lastRun.get(script) === key) return inFlight.get(script) ?? Promise.resolve()
			lastRun.set(script, key)
			const run = runOne(script, context, fetchFn)
				.catch(() => {
					// A failed run must not pin the key, or the next identical range is never retried.
					if (lastRun.get(script) === key) lastRun.delete(script)
				})
				.finally(() => {
					if (inFlight.get(script) === run) inFlight.delete(script)
				})
			inFlight.set(script, run)
			return run
		})
	)
}
