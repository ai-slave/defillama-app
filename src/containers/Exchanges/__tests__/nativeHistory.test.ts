import { describe, expect, it } from 'vitest'
import { clipSeriesValues, clipToNativeHistory, NATIVE_HISTORY_START } from '../nativeHistory'

const DAY = 86_400
const before = NATIVE_HISTORY_START - DAY
const at = NATIVE_HISTORY_START
const after = NATIVE_HISTORY_START + DAY

describe('clipToNativeHistory', () => {
	it('drops the backfill era and slices every column by the same index', () => {
		const clipped = clipToNativeHistory([before - DAY, before, at, after], {
			volume: [1, 2, 3, 4],
			oi: [null, 20, 30, 40]
		})
		expect(clipped.days).toEqual([at, after])
		expect(clipped.series).toEqual({ volume: [3, 4], oi: [30, 40] })
	})

	it('returns the input untouched when every day is already native', () => {
		const series = { volume: [1, 2] }
		const clipped = clipToNativeHistory([at, after], series)
		expect(clipped.series).toBe(series)
		expect(clipped.days).toEqual([at, after])
	})

	// A blank chart is worse than a stepped one, and the cutoff is hand-set: if it is
	// ever wrong, or a series just ends before it, show what we have.
	it('never clips a series down to nothing', () => {
		const clipped = clipToNativeHistory([before - DAY, before], { volume: [1, 2] })
		expect(clipped.days).toEqual([before - DAY, before])
		expect(clipped.series.volume).toEqual([1, 2])
		expect(clipToNativeHistory([], { volume: [] }).days).toEqual([])
	})
})

describe('clipSeriesValues', () => {
	it('clips each line’s own values against the shared day axis', () => {
		const clipped = clipSeriesValues(
			[before, at, after],
			[
				{ id: 'a', values: [1, 2, 3] },
				{ id: 'b', values: [null, null, 9] }
			]
		)
		expect(clipped.days).toEqual([at, after])
		expect(clipped.series).toEqual([
			{ id: 'a', values: [2, 3] },
			{ id: 'b', values: [null, 9] }
		])
	})

	it('leaves an all-backfill chart intact rather than blanking it', () => {
		const lines = [{ id: 'a', values: [1, 2] }]
		expect(clipSeriesValues([before - DAY, before], lines).series).toEqual(lines)
	})
})
