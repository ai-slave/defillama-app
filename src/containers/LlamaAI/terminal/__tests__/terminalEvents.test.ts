import { describe, expect, test } from 'vitest'
import { eventMark, normalizeEventOp, type TerminalEventOp } from '../terminalEvents'

const EVENT: TerminalEventOp = {
	type: 'event',
	id: 'ai_3',
	number: 3,
	time: 1_690_848_000,
	text: 'Curve reentrancy hack $70M — the drop starts here'
}

describe('normalizeEventOp', () => {
	// normalizeOp drops a shape it cannot read with no error anywhere, so an event whose label lost
	// its reason must not reach the chart as a bare unexplained line.
	test('rejects an event with no label', () => {
		expect(normalizeEventOp({ time: EVENT.time, text: '   ' }, { id: 'ai_1', number: 1 })).toBeNull()
		expect(normalizeEventOp({ time: EVENT.time }, { id: 'ai_1', number: 1 })).toBeNull()
	})

	test('rejects an event with no time, which would anchor on the wrong bar', () => {
		expect(normalizeEventOp({ text: 'Hack $70M — why' }, { id: 'ai_1', number: 1 })).toBeNull()
		expect(normalizeEventOp({ time: Number.NaN, text: 'Hack $70M — why' }, { id: 'ai_1', number: 1 })).toBeNull()
	})

	test('keeps the label and the bar the backend chose', () => {
		expect(normalizeEventOp({ time: EVENT.time, text: EVENT.text }, { id: 'ai_3', number: 3 })).toEqual(EVENT)
	})
})

describe('eventMark', () => {
	// The badge tooltip is a list of lines: what happened first, why it is on this chart second.
	test('splits the backend label into the title and the reason', () => {
		expect(eventMark(EVENT)).toEqual({
			time: EVENT.time,
			number: 3,
			title: 'Curve reentrancy hack $70M',
			reason: 'the drop starts here'
		})
	})

	// A hyphen inside the title is not the separator; only the spaced em dash the backend writes is.
	test('keeps a label with no reason whole', () => {
		expect(eventMark({ ...EVENT, text: 'Curve-Vyper hack $70M' })).toEqual({
			time: EVENT.time,
			number: 3,
			title: 'Curve-Vyper hack $70M'
		})
	})
})
