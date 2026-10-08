// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { waitForUi } from '~/utils/testing/waitForUi'
import { CalendarView } from '../CalendarView'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/unlocks/calendar', query: { view: 'TreeMap' }, push: vi.fn() })
}))

const page = <CalendarView initialUnlocksData={{}} />

let rendered: HydrationResult | null = null
let root: Root | null = null
let container: HTMLDivElement | null = null

const host = () => (rendered?.container ?? container)!
const click = (element: HTMLElement) =>
	act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
// The calendar and the treemap both offer "Month"; the treemap's period picker comes second.
const openTreemapMonth = () => click(Array.from(host().querySelectorAll<HTMLElement>('input[value="Month"]')).at(-1)!)
const shownMonth = () => host().querySelector('[aria-label="Previous month"]')?.nextElementSibling?.textContent
const tick = () => act(async () => vi.advanceTimersByTime(30_000))

async function mountAt(nowMs: number) {
	vi.setSystemTime(nowMs)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	await act(async () =>
		root!.render(<PageClockProvider pageClockSec={Math.floor(nowMs / 1000)}>{page}</PageClockProvider>)
	)
}

beforeAll(async () => {
	// Production's server render waits for the lazy treemap chunk; renderToString cannot, so load it once up front.
	installChartCanvas()
	const preload = document.createElement('div')
	const preloadRoot = createRoot(preload)
	await act(async () => preloadRoot.render(<PageClockProvider pageClockSec={0}>{page}</PageClockProvider>))
	await waitForUi(
		() => {
			if (!preload.querySelector('[_echarts_instance_]')) throw new Error('The treemap chunk has not loaded yet')
		},
		{ timeout: 1000 }
	)
	act(() => preloadRoot.unmount())
	vi.restoreAllMocks()
})

beforeEach(() => {
	installChartCanvas()
	// The calendar's clock ticks on an interval, so the tests drive it along with the date.
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
})

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	if (root) await act(async () => root!.unmount())
	container?.remove()
	root = null
	container = null
	vi.useRealTimers()
	vi.restoreAllMocks()
})

test('a calendar built in September and opened in October shows October in the treemap month view', async () => {
	vi.setSystemTime(Date.UTC(2026, 9, 2, 12))
	rendered = await renderHydrated(page, { pageClockSec: Date.UTC(2026, 8, 28, 12) / 1e3 })

	expect(rendered.errors).toEqual([])
	await openTreemapMonth()
	expect(shownMonth()).toBe('October 2026')
})

test('the treemap month view follows the calendar into the next month', async () => {
	await mountAt(Date.UTC(2026, 9, 31, 23, 59, 50))
	await openTreemapMonth()
	expect(shownMonth()).toBe('October 2026')

	await tick()
	expect(shownMonth()).toBe('November 2026')
})

test('a month the reader stepped to stays when the calendar crosses into the next month', async () => {
	await mountAt(Date.UTC(2026, 9, 31, 23, 59, 50))
	await openTreemapMonth()
	await click(host().querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!)
	expect(shownMonth()).toBe('September 2026')

	await tick()
	expect(shownMonth()).toBe('September 2026')
})
