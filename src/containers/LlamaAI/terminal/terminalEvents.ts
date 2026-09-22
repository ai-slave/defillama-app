import type { AgentMark } from './terminalData'

export interface TerminalEventOp {
	type: 'event'
	id: string
	number: number
	time: number
	text: string
}

const REASON_SEPARATOR = ' — '

export function normalizeEventOp(
	value: Record<string, unknown>,
	base: { id: string; number: number }
): TerminalEventOp | null {
	if (typeof value.time !== 'number' || !Number.isFinite(value.time)) return null
	const text = typeof value.text === 'string' ? value.text.trim() : ''
	if (!text) return null
	return { type: 'event', ...base, time: value.time, text }
}

// The backend joins what happened and why into one label; the badge tooltip gives each its own line.
export function eventMark(op: TerminalEventOp): AgentMark {
	const at = op.text.indexOf(REASON_SEPARATOR)
	if (at < 0) return { time: op.time, number: op.number, title: op.text }
	return {
		time: op.time,
		number: op.number,
		title: op.text.slice(0, at),
		reason: op.text.slice(at + REASON_SEPARATOR.length)
	}
}
