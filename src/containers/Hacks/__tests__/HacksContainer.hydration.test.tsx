// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { buildHacksPageSummary } from '../data'
import { HacksContainer } from '../index'
import type { IHackRow } from '../types'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/hacks', asPath: '/hacks?time=7d', query: { time: '7d' }, push: vi.fn() })
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const day = (date: number) => Date.UTC(2026, 6, date) / 1e3
const hack = (name: string, date: number, amountUsd: number): IHackRow => ({
	name,
	chains: ['Ethereum'],
	classification: 'Protocol Logic',
	technique: 'Key Compromise',
	date,
	target: 'DeFi Protocol',
	amountUsd,
	bridge: false,
	language: ''
})

// Built at noon on Jul 14: the 7d window covers Jul 7 noon to Jul 14 noon.
const PAGE_CLOCK_SEC = Date.UTC(2026, 6, 14, 12) / 1e3
const DATA = [hack('Older hack', day(5), 50_000_000), hack('Recent hack', day(9), 30_000_000)]
const page = <HacksContainer data={DATA} {...buildHacksPageSummary(DATA)} />

const totalHacked = (root: ParentNode) =>
	Array.from(root.querySelectorAll('h1')).find((heading) => heading.textContent === 'Total Value Hacked (USD)')
		?.nextElementSibling?.textContent

let rendered: HydrationResult | null = null

beforeAll(async () => {
	// Production's server render waits for the lazy chart chunk; renderToString cannot, so load it once up front.
	const root = createRoot(document.createElement('div'))
	await act(async () => root.render(<PageClockProvider pageClockSec={PAGE_CLOCK_SEC}>{page}</PageClockProvider>))
	act(() => root.unmount())
})

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

test('the 7d filter opened days after the page was built keeps the hacks of the week the list ends on', async () => {
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 18, 3) })
	rendered = await renderHydrated(page, { pageClockSec: PAGE_CLOCK_SEC })

	expect(rendered.errors).toEqual([])
	const serverDocument = new DOMParser().parseFromString(rendered.serverHtml, 'text/html')
	expect(totalHacked(serverDocument)).toBe('$30m')
	expect(totalHacked(rendered.container)).toBe('$30m')
})
