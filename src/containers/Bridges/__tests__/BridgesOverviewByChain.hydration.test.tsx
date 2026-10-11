// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { BridgesOverviewByChain } from '../BridgesOverviewByChain'
import { BridgeVolumeChart } from '../BridgeVolumeChart'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/bridges/[chain]', asPath: '/bridges/ethereum', query: {}, push: vi.fn() })
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const DAY_TOTAL_LABEL = 'Total Volume (last completed day)'
const day = (date: number) => Date.UTC(2026, 6, date) / 1e3

const chainPage = (
	selectedChain: string,
	chainVolumeData: Array<{ date: number; Deposits: number; Withdrawals: number }>
) => (
	<BridgesOverviewByChain
		selectedChain={selectedChain}
		chains={['Ethereum', 'Polygon']}
		filteredBridges={[]}
		messagingProtocols={[]}
		bridgeNames={[]}
		bridgeNameToChartDataIndex={{}}
		chartDataByBridge={[]}
		chainVolumeData={chainVolumeData}
		rawBridgeVolumeData={[]}
		netflowsData={null}
		bridgeStatsCurrentDay={null}
		largeTxsData={[]}
	/>
)

// Built at noon on Jul 14, so Jul 13 is the data's last completed day.
const ethereum = chainPage('Ethereum', [
	{ date: day(13), Deposits: 800_000_000, Withdrawals: -400_000_000 },
	{ date: day(14), Deposits: 100_000_000, Withdrawals: -60_000_000 }
])
const ETHEREUM_CLOCK_SEC = Date.UTC(2026, 6, 14, 12) / 1e3

const dayTotal = (root: ParentNode) =>
	Array.from(root.querySelectorAll('h1')).find((heading) => heading.textContent === DAY_TOTAL_LABEL)?.nextElementSibling
		?.textContent

let rendered: HydrationResult | null = null

beforeAll(async () => {
	// Production's server render waits for the lazy chart chunk; renderToString cannot, so load it once up front.
	const root = createRoot(document.createElement('div'))
	await act(async () => root.render(<BridgeVolumeChart data={[]} />))
	act(() => root.unmount())
})

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

test('a chain page opened days after it was built keeps the totals of its data’s last completed day', async () => {
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 17, 3) })
	rendered = await renderHydrated(ethereum, { pageClockSec: ETHEREUM_CLOCK_SEC })

	expect(rendered.errors).toEqual([])
	const serverDocument = new DOMParser().parseFromString(rendered.serverHtml, 'text/html')
	expect(dayTotal(serverDocument)).toBe('$600m')
	expect(dayTotal(rendered.container)).toBe('$600m')
})

test('switching chains after UTC midnight totals the new chain’s data at its own clock', async () => {
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 14, 23) })
	rendered = await renderHydrated(ethereum, { pageClockSec: ETHEREUM_CLOCK_SEC })

	vi.setSystemTime(Date.UTC(2026, 6, 15, 1))
	// Polygon's props were built after midnight, so Jul 14 is its last completed day.
	await rendered.update(
		chainPage('Polygon', [
			{ date: day(14), Deposits: 90_000_000, Withdrawals: -30_000_000 },
			{ date: day(15), Deposits: 5_000_000, Withdrawals: -1_000_000 }
		]),
		Date.UTC(2026, 6, 15, 0, 30) / 1e3
	)

	expect(dayTotal(rendered.container)).toBe('$60m')
})
