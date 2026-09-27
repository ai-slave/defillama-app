// @vitest-environment happy-dom

import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { useDateRangeValidation } from '../useDateRangeValidation'
import { useNowSeconds } from '../useNowSeconds'

const DAY = 86_400
// Cached HTML from the 26th, opened on the 27th.
const PAGE_CLOCK_SEC = Date.UTC(2026, 8, 26, 12) / 1e3
const VISIT_SEC = Date.UTC(2026, 8, 27, 12) / 1e3

const dateOnly = (sec: number) => new Date(sec * 1e3).toISOString().slice(0, 10)

let api: ReturnType<typeof useDateRangeValidation>

/** A date range whose default is "the last week up to now", as the bridge and PnL pages build it. */
function RangeForm() {
	const nowSec = useNowSeconds()
	api = useDateRangeValidation({ defaultStartDate: dateOnly(nowSec - 7 * DAY), defaultEndDate: dateOnly(nowSec) })
	return (
		<form>
			<input name="start" value={api.startDate} readOnly />
			<input name="end" value={api.endDate} readOnly />
		</form>
	)
}

let rendered: HydrationResult | null = null

beforeEach(() => vi.useFakeTimers({ now: VISIT_SEC * 1e3 }))
afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

const values = () => [...rendered!.container.querySelectorAll('input')].map((input) => input.value)

test('defaults hydrate at the cached day and then follow the visitor’s day', async () => {
	rendered = await renderHydrated(<RangeForm />, { pageClockSec: PAGE_CLOCK_SEC })
	expect(rendered.errors).toEqual([])
	expect(rendered.serverHtml).toContain('value="2026-09-26"')

	// The live clock is one day on; untouched defaults move with it on the first tick after hydration.
	await act(async () => {
		vi.advanceTimersByTime(1000)
	})
	expect(values()).toEqual(['2026-09-20', '2026-09-27'])
})

test('a date the reader picked survives the clock moving on', async () => {
	rendered = await renderHydrated(<RangeForm />, { pageClockSec: PAGE_CLOCK_SEC })
	await act(async () => api.handleEndDateChange('2026-09-24'))
	expect(values()).toEqual(['2026-09-20', '2026-09-24'])

	await act(async () => {
		vi.advanceTimersByTime(60_000)
	})
	expect(values()).toEqual(['2026-09-20', '2026-09-24'])
})
