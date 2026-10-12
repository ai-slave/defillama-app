// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { BridgeVolumeChart } from '../BridgeVolumeChart'

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const LAST_DAY_SEC = Date.UTC(2026, 6, 13) / 1e3
const data = [{ date: LAST_DAY_SEC, depositUSD: 10, withdrawUSD: 5, depositTxs: 1, withdrawTxs: 1 }]
// The page was built late on the day after the last point, when the data still counts as fresh.
const PAGE_CLOCK_SEC = Date.UTC(2026, 6, 14, 22) / 1e3
const STALE_LABEL = 'Bridge volume data last updated'

let rendered: HydrationResult | null = null

beforeAll(async () => {
	// Production's server render waits for the lazy chart chunk; renderToString cannot, so load it once up front.
	const root = createRoot(document.createElement('div'))
	await act(async () =>
		root.render(
			<BridgeVolumeChart data={[]} exportButtons={{ chartInstance: () => null, handleChartReady: () => {} }} />
		)
	)
	act(() => root.unmount())
})

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

test('HTML built while the data was fresh hydrates cleanly, then warns that it is stale', async () => {
	vi.useFakeTimers({ now: Date.UTC(2026, 6, 15, 3) })
	rendered = await renderHydrated(
		<BridgeVolumeChart data={data} exportButtons={{ chartInstance: () => null, handleChartReady: () => {} }} />,
		{ pageClockSec: PAGE_CLOCK_SEC }
	)

	expect(rendered.errors).toEqual([])
	expect(rendered.serverHtml).not.toContain(STALE_LABEL)
	expect(rendered.container.textContent).toContain(STALE_LABEL)
})

test('an open page starts warning when the clock crosses into the stale day', async () => {
	vi.useFakeTimers({ now: Date.UTC(2026, 6, 14, 23, 59, 50) })
	rendered = await renderHydrated(
		<BridgeVolumeChart data={data} exportButtons={{ chartInstance: () => null, handleChartReady: () => {} }} />,
		{ pageClockSec: PAGE_CLOCK_SEC }
	)
	expect(rendered.container.textContent).not.toContain(STALE_LABEL)

	await act(async () => {
		vi.advanceTimersByTime(30_000)
	})
	expect(rendered.container.textContent).toContain(STALE_LABEL)
})
