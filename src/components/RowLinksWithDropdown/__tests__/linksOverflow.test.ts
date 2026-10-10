import { expect, test } from 'vitest'
import { needsMeasuring, overflowReducer } from '../LinksWithDropdown'

const START = {
	renderMenuOnly: false,
	firstOverflowIndex: null,
	isMeasuring: true,
	measureAllSignature: null,
	measuredSignature: null
}

test('a measured link set renders from its measurement, and a different link set measures again', () => {
	const measured = overflowReducer(START, {
		type: 'MEASURED',
		result: { renderMenuOnly: false, firstOverflowIndex: 1 },
		signature: 'a\u0001b'
	})
	expect(needsMeasuring(measured, 'a\u0001b')).toBe(false)
	expect(needsMeasuring(measured, 'a\u0001b\u0001c')).toBe(true)

	// Measuring the new set with the same split still records that it was measured.
	const remeasured = overflowReducer(measured, {
		type: 'MEASURED',
		result: { renderMenuOnly: false, firstOverflowIndex: 1 },
		signature: 'a\u0001b\u0001c'
	})
	expect(needsMeasuring(remeasured, 'a\u0001b\u0001c')).toBe(false)
})

test('a resize recalculation keeps the link set it was measured for', () => {
	const measured = overflowReducer(START, {
		type: 'MEASURED',
		result: { renderMenuOnly: false, firstOverflowIndex: null },
		signature: 'a\u0001b'
	})
	const resized = overflowReducer(measured, {
		type: 'RESIZED',
		result: { renderMenuOnly: false, firstOverflowIndex: 1 }
	})

	expect(resized).toEqual({
		renderMenuOnly: false,
		firstOverflowIndex: 1,
		isMeasuring: false,
		measureAllSignature: null,
		measuredSignature: 'a\u0001b'
	})
	expect(needsMeasuring(resized, 'a\u0001b')).toBe(false)
})
