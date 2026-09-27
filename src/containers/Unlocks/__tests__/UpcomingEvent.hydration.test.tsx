// @vitest-environment happy-dom

import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import type { EmissionEvent } from '../api.types'
import { UpcomingEvent } from '../UpcomingEvent'

// The page was built at 09:00 UTC; the visitor opens it in New York, 40 minutes later.
const PAGE_CLOCK_SEC = Date.UTC(2026, 8, 26, 9) / 1e3
const VISIT_MS = (PAGE_CLOCK_SEC + 40 * 60) * 1e3
const EVENT_SEC = PAGE_CLOCK_SEC + 2 * 3600 + 30

const cliff: EmissionEvent = {
	description: 'of Team tokens will be unlocked',
	category: 'insiders',
	unlockType: 'cliff',
	timestamp: EVENT_SEC,
	noOfTokens: [100]
}

const originalTz = process.env.TZ
let rendered: HydrationResult | null = null

beforeEach(() => {
	vi.useFakeTimers({ now: VISIT_MS })
	process.env.TZ = 'America/New_York'
})

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	process.env.TZ = originalTz
	vi.useRealTimers()
})

const card = (
	<UpcomingEvent
		timestamp={EVENT_SEC}
		event={[cliff]}
		price={2}
		symbol="TOK"
		mcap={1000}
		maxSupply={1000}
		name="Token"
		isProtocolPage
		initialNowSec={PAGE_CLOCK_SEC}
	/>
)

const badge = () => rendered!.container.querySelector('.tabular-nums')?.textContent

test('stale HTML from another zone hydrates without a mismatch and keeps counting from the live clock', async () => {
	rendered = await renderHydrated(card, { pageClockSec: PAGE_CLOCK_SEC, serverTimeZone: 'UTC' })

	expect(rendered.errors).toEqual([])
	// The server counted 2h 0m 30s to the event; the date and time are UTC, so the zone cannot change them.
	expect(rendered.serverHtml).toContain('0D 2H 0M 30S')
	expect(rendered.serverHtml).toContain('26 Sep 2026')
	expect(rendered.serverHtml).toContain('11:00 UTC')

	// The live clock is 40 minutes on; the next tick counts from it.
	await act(async () => {
		vi.advanceTimersByTime(1000)
	})
	expect(badge()).toBe('0D 1H 20M 29S')
	expect(rendered.container.textContent).toContain('26 Sep 2026')
	expect(rendered.container.textContent).toContain('11:00 UTC')
})

test('a countdown seeded from the data keeps counting after hydration', async () => {
	rendered = await renderHydrated(card, { pageClockSec: PAGE_CLOCK_SEC })
	expect(rendered.errors).toEqual([])

	await act(async () => {
		vi.advanceTimersByTime(3000)
	})
	expect(badge()).toBe('0D 1H 20M 27S')
})
