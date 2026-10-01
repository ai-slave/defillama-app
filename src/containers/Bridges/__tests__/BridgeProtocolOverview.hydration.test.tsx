// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { BridgeInfo } from '../BridgeProtocolOverview'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/bridge/[bridge]', asPath: '/bridge/example', query: {}, push: vi.fn() })
}))

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const fixtures = installFixtureFetch()

const day = (date: number) => Date.UTC(2026, 6, date) / 1e3
// Built at noon on Jul 14, while the rolling 24h totals stamped that morning are still fresh.
const PAGE_CLOCK_SEC = Date.UTC(2026, 6, 14, 12) / 1e3

type Volumes = Array<{ date: number; Deposited: number; Withdrawn: number }>
const volumes: Volumes = [
	{ date: day(12), Deposited: 3_000_000, Withdrawn: -1_000_000 },
	{ date: day(13), Deposited: 4_000_000, Withdrawn: -1_500_000 },
	{ date: day(14), Deposited: 6_000_000, Withdrawn: -2_500_000 }
]
const tableData = (dataTimestamp: number) => ({
	tokensTableData: [],
	addressesTableData: [],
	tokenDeposits: null,
	tokenWithdrawals: null,
	totalDepositedUSD: 5_000_000,
	totalWithdrawnUSD: 2_000_000,
	totalDepositTxs: 10,
	totalWithdrawalTxs: 5,
	dataTimestamp
})
const STATS_STAMPED_SEC = Date.UTC(2026, 6, 14, 8) / 1e3

// The server and the browser each build their own query cache, as they do in production.
function Page({
	defaultChain,
	chainVolumes = volumes,
	statsStampedSec = STATS_STAMPED_SEC
}: {
	defaultChain: string
	chainVolumes?: Volumes
	statsStampedSec?: number
}) {
	const [client] = useState(() => new QueryClient())
	return (
		<QueryClientProvider client={client}>
			<BridgeInfo
				displayName="Example Bridge"
				logo=""
				chains={['All Chains', 'Ethereum']}
				defaultChain={defaultChain}
				volumeDataByChain={{ 'All Chains': chainVolumes, Ethereum: chainVolumes }}
				tableDataByChain={{ 'All Chains': tableData(statsStampedSec), Ethereum: tableData(statsStampedSec) }}
				config={{
					id: 1,
					name: 'example',
					displayName: 'Example Bridge',
					icon: '',
					volumePrevDay: 0,
					volumePrev2Day: 0,
					lastHourlyVolume: 0,
					last24hVolume: 0,
					lastDailyVolume: 0,
					dayBeforeLastVolume: 0,
					weeklyVolume: 0,
					monthlyVolume: 0,
					chains: ['Ethereum'],
					destinationChain: 'Ethereum'
				}}
			/>
		</QueryClientProvider>
	)
}

const statValue = (root: ParentNode, label: string) =>
	Array.from(root.querySelectorAll('p')).find((stat) => stat.firstElementChild?.textContent === label)?.lastElementChild
		?.textContent

let rendered: HydrationResult | null = null

beforeAll(async () => {
	// Production's server render waits for the lazy chart chunk; renderToString cannot, so load it once up front.
	const root = createRoot(document.createElement('div'))
	await act(async () =>
		root.render(
			<PageClockProvider pageClockSec={PAGE_CLOCK_SEC}>
				<Page defaultChain="All Chains" />
			</PageClockProvider>
		)
	)
	act(() => root.unmount())
})

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

test('a bridge page opened days after it was built keeps the stats its data was built with', async () => {
	fixtures.serve({ '/blockExplorers.json': [] })
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 17, 3) })
	rendered = await renderHydrated(<Page defaultChain="Ethereum" />, { pageClockSec: PAGE_CLOCK_SEC })

	expect(rendered.errors).toEqual([])
	const serverDocument = new DOMParser().parseFromString(rendered.serverHtml, 'text/html')
	expect(statValue(serverDocument, 'Deposited to Ethereum (24h)')).toBe('$5m')
	expect(statValue(serverDocument, 'Volume Change (prev day)')).toBe('+37.50%')
	expect(statValue(rendered.container, 'Deposited to Ethereum (24h)')).toBe('$5m')
	expect(statValue(rendered.container, 'Volume Change (prev day)')).toBe('+37.50%')
})

test('a bridge whose props were built after UTC midnight falls back to its own last completed day', async () => {
	fixtures.serve({ '/blockExplorers.json': [] })
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 14, 23) })
	rendered = await renderHydrated(<Page defaultChain="Ethereum" />, { pageClockSec: PAGE_CLOCK_SEC })

	vi.setSystemTime(Date.UTC(2026, 6, 15, 1))
	// The next bridge's props were built on Jul 15, after its rolling totals from Jul 14 went stale.
	await rendered.update(<Page defaultChain="Ethereum" />, Date.UTC(2026, 6, 15, 0, 30) / 1e3)

	expect(statValue(rendered.container, 'Deposited to Ethereum (24h)')).toBe('$6m')
	expect(statValue(rendered.container, 'Withdrawn from Ethereum (24h)')).toBe('$2.5m')
	expect(statValue(rendered.container, 'Volume Change (prev day)')).toBe('+54.55%')
})

test('an all-chains bridge whose data has no current stats says its volume is unavailable', async () => {
	fixtures.serve({ '/blockExplorers.json': [] })
	rendered = await renderHydrated(
		<Page
			defaultChain="All Chains"
			chainVolumes={volumes.slice(0, 1)}
			statsStampedSec={Date.UTC(2026, 6, 13, 8) / 1e3}
		/>,
		{ pageClockSec: PAGE_CLOCK_SEC }
	)

	expect(rendered.errors).toEqual([])
	// Neither Jul 13's rolling totals nor a Jul 13 row cover the data's last completed day.
	expect(statValue(rendered.container, 'Total Volume (24h)')).toBe('N/A')
})
