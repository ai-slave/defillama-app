// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { IChainOverviewData } from '../types'

installSubscriberSession('chain-tvl-change', { account: 'signed-out' })
vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/chain/ethereum', pathname: '/chain/[chain]', query: {} })
}))
vi.mock('../ChainChartPanel', () => ({ ChainChartPanel: () => null }))
vi.mock('../KeyMetrics', () => ({ KeyMetrics: () => null }))
import { Stats } from '../Stats'

const dayMs = (date: number) => Date.UTC(2026, 6, date)
const emptyExtras = {
	staking: {},
	borrowed: {},
	pool2: {},
	vesting: {},
	offers: {},
	doublecounted: {},
	liquidstaking: {},
	dcAndLsOverlap: {}
}
const chainPage = (tvlChart: Array<[number, number]>, staking: Record<string, number>, computedAtMs: number) => {
	const props = {
		chain: 'Ethereum',
		metadata: { name: 'Ethereum' },
		protocols: [{ name: 'Aave' }],
		charts: ['TVL'],
		tvlChart,
		// The server's summary leaves staking out, as the TVL settings start off.
		tvlChartSummary: {
			totalValueUSD: 200_000_000,
			tvlPrevDay: 100_000_000,
			valueChange24hUSD: 1,
			change24h: 100,
			computedAtMs
		},
		extraTvlCharts: { ...emptyExtras, staking },
		chainTokenInfo: null
	} as unknown as IChainOverviewData
	return <Tree props={props} />
}

// Per-render client: one shared by the server and browser renders would hand the browser the server's cache.
function Tree({ props }: { props: IChainOverviewData }) {
	const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
	return (
		<QueryClientProvider client={client}>
			<AuthProvider>
				<Stats {...props} hideChart />
			</AuthProvider>
		</QueryClientProvider>
	)
}

// Built at noon on Jul 14, so Jul 14 is the TVL chart's current day.
const PAGE_CLOCK_SEC = Date.UTC(2026, 6, 14, 12) / 1e3
const ethereum = chainPage(
	[
		[dayMs(13), 100_000_000],
		[dayMs(14), 200_000_000]
	],
	{ [dayMs(13)]: 100_000_000, [dayMs(14)]: 20_000_000 },
	PAGE_CLOCK_SEC * 1000
)

const tvlChange = (root: ParentNode) =>
	Array.from(root.querySelectorAll('span')).find((element) => /^[+-]?\d+(\.\d+)?%$/.test(element.textContent ?? ''))
		?.textContent ?? null

let rendered: HydrationResult | null = null

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

test('with staking counted, a chain page opened days after it was built shows the 24h change of its data', async () => {
	localStorage.setItem('DEFILLAMA', JSON.stringify({ staking: true }))
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 17, 3) })
	rendered = await renderHydrated(ethereum, { pageClockSec: PAGE_CLOCK_SEC })

	expect(rendered.errors).toEqual([])
	const serverDocument = new DOMParser().parseFromString(rendered.serverHtml, 'text/html')
	expect(tvlChange(serverDocument)).toBe('+100.00%')
	// 100m + 100m staking on Jul 13 to 200m + 20m on Jul 14.
	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+10.00%'))
})

test('switching chains after UTC midnight measures the new chain’s change at its own clock', async () => {
	localStorage.setItem('DEFILLAMA', JSON.stringify({ staking: true }))
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 14, 23) })
	rendered = await renderHydrated(ethereum, { pageClockSec: PAGE_CLOCK_SEC })
	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+10.00%'))

	vi.setSystemTime(Date.UTC(2026, 6, 15, 1))
	// The next chain's props were built after midnight, so Jul 15 is its current day.
	await rendered.update(
		chainPage(
			[
				[dayMs(14), 100_000_000],
				[dayMs(15), 150_000_000]
			],
			{ [dayMs(14)]: 0, [dayMs(15)]: 30_000_000 },
			Date.UTC(2026, 6, 15, 0, 30)
		),
		Date.UTC(2026, 6, 15, 0, 30) / 1e3
	)

	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+80.00%'))
})

test('chain data fetched after the page was built measures its change at its own clock, as on the compare page', async () => {
	localStorage.setItem('DEFILLAMA', JSON.stringify({ staking: true }))
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 15, 3) })
	// The page was built on Jul 14; the chain's data came from the cache API after midnight, with Jul 15 as its day.
	rendered = await renderHydrated(
		chainPage(
			[
				[dayMs(14), 100_000_000],
				[dayMs(15), 150_000_000]
			],
			{ [dayMs(14)]: 0, [dayMs(15)]: 30_000_000 },
			Date.UTC(2026, 6, 15, 0, 30)
		),
		{ pageClockSec: PAGE_CLOCK_SEC }
	)

	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+80.00%'))
})
