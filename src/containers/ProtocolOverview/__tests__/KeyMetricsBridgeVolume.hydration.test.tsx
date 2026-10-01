// @vitest-environment happy-dom

import { afterEach, expect, test, vi } from 'vitest'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { KeyMetrics } from '../KeyMetrics'
import type { IProtocolPageMetrics } from '../types'

vi.mock('~/components/ReportIncorrectData', () => ({ ReportIncorrectData: () => null }))
vi.mock('~/components/KeyMetricsPngExport/KeyMetricsPngExportButton', () => ({
	KeyMetricsPngExportButton: () => null
}))

const day = (date: number) => Date.UTC(2026, 6, date) / 1e3
const bridgePage = (bridgeVolume: Array<{ date: number; depositUSD: number; withdrawUSD: number }>) => (
	<KeyMetrics
		name="Example Bridge"
		metrics={{ bridge: true } as IProtocolPageMetrics}
		isOracleProtocol={false}
		oracleTvs={null}
		hasKeyMetrics
		openSmolStatsSummaryByDefault
		bridgeVolume={bridgeVolume as never}
		formatPrice={(value) => (value == null ? null : `$${value / 1e6}m`)}
	/>
)

// Built at noon on Jul 14, so Jul 13 is the data's last completed day.
const PAGE_CLOCK_SEC = Date.UTC(2026, 6, 14, 12) / 1e3
const page = bridgePage([
	{ date: day(12), depositUSD: 40_000_000, withdrawUSD: 40_000_000 },
	{ date: day(13), depositUSD: 100_000_000, withdrawUSD: 60_000_000 },
	{ date: day(14), depositUSD: 10_000_000, withdrawUSD: 10_000_000 }
])

const metricValue = (root: ParentNode, label: string) =>
	Array.from(root.querySelectorAll('[data-metric-label]'))
		.find((element) => element.textContent === label)
		?.closest('p')?.lastElementChild?.textContent

let rendered: HydrationResult | null = null

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

test('bridge volume opened days after the page was built keeps the totals of its data’s completed days', async () => {
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 17, 3) })
	rendered = await renderHydrated(page, { pageClockSec: PAGE_CLOCK_SEC })

	expect(rendered.errors).toEqual([])
	const serverDocument = new DOMParser().parseFromString(rendered.serverHtml, 'text/html')
	for (const root of [serverDocument, rendered.container]) {
		expect(metricValue(root, 'Bridge Volume last completed day')).toBe('$80m')
		expect(metricValue(root, 'Bridge Volume 7 completed days')).toBe('$120m')
	}
})

test('a protocol page reused for the next protocol totals the new data at its own clock', async () => {
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 14, 23) })
	rendered = await renderHydrated(page, { pageClockSec: PAGE_CLOCK_SEC })

	vi.setSystemTime(Date.UTC(2026, 6, 15, 1))
	// The next page's props were built after midnight, so Jul 14 is its last completed day.
	await rendered.update(
		bridgePage([
			{ date: day(14), depositUSD: 6_000_000, withdrawUSD: 2_000_000 },
			{ date: day(15), depositUSD: 1_000_000, withdrawUSD: 1_000_000 }
		]),
		Date.UTC(2026, 6, 15, 0, 30) / 1e3
	)

	expect(metricValue(rendered.container, 'Bridge Volume last completed day')).toBe('$4m')
})
