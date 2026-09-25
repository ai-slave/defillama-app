import { describe, expect, test } from 'vitest'
import { answerExitCapacity, answerQueueFlow } from '../exitCapacity'
import type { LiquidityChartModel } from '../liquidityChart'

const RANGE = { start: 0, end: 100 }

function model(available: Array<number | null>, uncappedQueue = false): LiquidityChartModel {
	return {
		dates: available.map((_, i) => i),
		usd: { total: available.map(() => 1e9), available, remainder: available.map(() => null) },
		units: { total: [], available: [], remainder: [] },
		classes: [],
		symbol: null,
		hasUnits: false,
		uncappedQueue
	} as unknown as LiquidityChartModel
}

describe('answerExitCapacity', () => {
	test('counts the days the position would not have cleared', () => {
		const answer = answerExitCapacity(model([100, 50, 200, 40, 500]), 100, RANGE)

		expect(answer).toMatchObject({ measuredDays: 5, shortDays: 2 })
		expect(answer!.clearedShare).toBeCloseTo(0.6)
	})

	// A queue has no instant lane to size against, and a zero here would read as "you cannot get
	// out" rather than "size is not the constraint".
	test('answers nothing for an uncapped queue', () => {
		expect(answerExitCapacity(model([100, 200], true), 100, RANGE)).toBeNull()
	})

	test('answers nothing when no day in the window was measured', () => {
		expect(answerExitCapacity(model([null, null]), 100, RANGE)).toBeNull()
		expect(answerExitCapacity(model([100, 200]), 100, { start: 50, end: 60 })).toBeNull()
	})

	test('reports the thinnest day', () => {
		const answer = answerExitCapacity(model([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]), 1, RANGE)

		expect(answer!.floorUsd).toBe(10)
	})
})

const DAY = 24 * 60 * 60 * 1000

/** A queued pool: no instant lane at all, so only `total` carries a series. */
// Flows are read in token units; the dollar series is present but must not be what is read.
function queued(totals: Array<number | null>): LiquidityChartModel {
	return {
		dates: totals.map((_, i) => i * DAY),
		usd: { total: totals.map((t) => (t == null ? null : t * 2)), available: totals.map(() => null), remainder: [] },
		units: { total: totals, available: totals.map(() => null), remainder: totals },
		classes: [],
		symbol: 'stETH',
		hasUnits: true,
		uncappedQueue: true
	} as unknown as LiquidityChartModel
}

const FULL = { start: 0, end: 400 * DAY }

describe('answerQueueFlow', () => {
	test('answers nothing when there is an instant lane to size against instead', () => {
		expect(answerQueueFlow(model([100, 200]), FULL, 'queued')).toBeNull()
	})

	// Holding 100 tokens while their price halves is not a withdrawal; without units there is no flow.
	test('answers nothing without token units, since a dollar fall may be price alone', () => {
		const usdOnly = { ...queued([1000, 500]), units: { total: [], available: [], remainder: [] }, hasUnits: false }
		expect(answerQueueFlow(usdOnly as LiquidityChartModel, FULL, 'queued')).toBeNull()
	})

	test('reports the net move across the measured window', () => {
		expect(answerQueueFlow(queued([1000, 900, 800, 700]), FULL, 'queued')).toMatchObject({
			measuredDays: 4,
			from: 1000,
			to: 700
		})
	})

	// The queue's measured floor: the deepest fall inside any seven days.
	test('finds the largest weekly fall and dates it', () => {
		const answer = answerQueueFlow(queued([1000, 990, 980, 500, 495, 490, 485, 480]), FULL, 'queued')

		expect(answer!.worstWeek).toBe(520)
		expect(answer!.worstWeekFrom).toBe(0)
		expect(answer!.worstWeekTo).toBe(7 * DAY)
	})

	// Gaps must not let a fall spanning months pass for a fall inside a week.
	test('measures the week by date, not by index', () => {
		const gapped = queued([1000, 200])
		gapped.dates = [0, 60 * DAY]

		expect(answerQueueFlow(gapped, FULL, 'queued')!.worstWeek).toBe(0)
	})

	test('reports no fall for a pool that only grew', () => {
		expect(answerQueueFlow(queued([100, 200, 300]), FULL, 'queued')!.worstWeek).toBe(0)
	})

	test('answers nothing without two measured days', () => {
		expect(answerQueueFlow(queued([null, 100]), FULL, 'queued')).toBeNull()
	})
})

// A missing capacity series is not itself a live queue.
describe('queue flow requires a live queue, not just a missing capacity series', () => {
	test('answers nothing for a pool that is not queued right now', () => {
		for (const status of ['instant', 'partial', 'blocked', 'unavailable', null] as const) {
			expect(answerQueueFlow(queued([1000, 900, 800]), FULL, status), `status ${status}`).toBeNull()
		}
	})
})
