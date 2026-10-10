// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { IChainOverviewData } from '../types'

const http = installSubscriberSession('chain-tvl-change', { account: 'signed-out' })
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
// The TVL settings series load from the chain charts API once a setting is on.
const serveStaking = (
	chain: string,
	tvlChart: Array<[number, number]>,
	staking: Record<string, number>,
	computedAtMs: number
) =>
	http.serve({
		[`http://localhost:3000/api/public/chains/charts?kind=extra-tvl&chain=${chain}`]: {
			tvlChart,
			extraTvlCharts: { ...emptyExtras, staking },
			computedAtMs
		}
	})
const chainPage = (chain: string, tvlChart: Array<[number, number]>, computedAtMs: number) => {
	const props = {
		chain,
		metadata: { name: chain },
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
		chainTokenInfo: null,
		extraTvlCharts: null
	} as unknown as IChainOverviewData
	return <Tree props={props} />
}

// Per-render client: one shared by the server and browser renders would hand the browser the server's cache.
function Tree({
	props
}: {
	props: Omit<IChainOverviewData, 'extraTvlCharts'> & { extraTvlCharts: IChainOverviewData['extraTvlCharts'] | null }
}) {
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
const ethereumTvl: Array<[number, number]> = [
	[dayMs(13), 100_000_000],
	[dayMs(14), 200_000_000]
]
const ethereum = chainPage('Ethereum', ethereumTvl, PAGE_CLOCK_SEC * 1000)
const baseTvl: Array<[number, number]> = [
	[dayMs(14), 100_000_000],
	[dayMs(15), 150_000_000]
]
const ethereumStaking = { [dayMs(13)]: 100_000_000, [dayMs(14)]: 20_000_000 }

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
	serveStaking('Ethereum', ethereumTvl, ethereumStaking, PAGE_CLOCK_SEC * 1000)
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
	serveStaking('Ethereum', ethereumTvl, ethereumStaking, PAGE_CLOCK_SEC * 1000)
	serveStaking('Base', baseTvl, { [dayMs(14)]: 0, [dayMs(15)]: 30_000_000 }, Date.UTC(2026, 6, 15, 0, 30))
	rendered = await renderHydrated(ethereum, { pageClockSec: PAGE_CLOCK_SEC })
	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+10.00%'))

	vi.setSystemTime(Date.UTC(2026, 6, 15, 1))
	// The next chain's props were built after midnight, so Jul 15 is its current day.
	await rendered.update(
		chainPage(
			'Base',
			[
				[dayMs(14), 100_000_000],
				[dayMs(15), 150_000_000]
			],
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
	serveStaking('Ethereum', baseTvl, { [dayMs(14)]: 0, [dayMs(15)]: 30_000_000 }, Date.UTC(2026, 6, 15, 0, 30))
	rendered = await renderHydrated(
		chainPage(
			'Ethereum',
			[
				[dayMs(14), 100_000_000],
				[dayMs(15), 150_000_000]
			],
			Date.UTC(2026, 6, 15, 0, 30)
		),
		{ pageClockSec: PAGE_CLOCK_SEC }
	)

	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+80.00%'))
})

test('when the staking series fails to load, TVL keeps the change the page was built with', async () => {
	localStorage.setItem('DEFILLAMA', JSON.stringify({ staking: true }))
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 14, 13) })
	const stakingUrl = 'http://localhost:3000/api/public/chains/charts?kind=extra-tvl&chain=Ethereum'
	http.serve({ [stakingUrl]: fixtureStatus(502, { error: 'Failed to load chain chart data' }) })
	rendered = await renderHydrated(ethereum, { pageClockSec: PAGE_CLOCK_SEC })
	await waitForUi(() => expect(http.urls()).toContain(stakingUrl))
	await act(() => new Promise((resolve) => setTimeout(resolve, 50)))

	expect(tvlChange(rendered.container)).toBe('+100.00%')
})

test('with staking counted, TVL comes from one snapshot even when the API is fresher than the page', async () => {
	localStorage.setItem('DEFILLAMA', JSON.stringify({ staking: true }))
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 14, 13) })
	// Since the page was built, Jul 14 moved from 200m to 300m; the staking series is from the same later response.
	serveStaking(
		'Ethereum',
		[
			[dayMs(13), 100_000_000],
			[dayMs(14), 300_000_000]
		],
		ethereumStaking,
		Date.UTC(2026, 6, 14, 12, 50)
	)
	rendered = await renderHydrated(ethereum, { pageClockSec: PAGE_CLOCK_SEC })

	// 100m + 100m staking on Jul 13 to 300m + 20m on Jul 14, not the page's 200m mixed with the newer staking.
	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+60.00%'))
})

test('series loaded after UTC midnight measure their 24h change on their own day, not the page’s', async () => {
	localStorage.setItem('DEFILLAMA', JSON.stringify({ staking: true }))
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 15, 1) })
	// The page was built on Jul 14; the API answered after midnight, with Jul 15 as its day.
	serveStaking(
		'Ethereum',
		[
			[dayMs(13), 100_000_000],
			[dayMs(14), 110_000_000],
			[dayMs(15), 90_000_000]
		],
		{},
		Date.UTC(2026, 6, 15, 0, 30)
	)
	rendered = await renderHydrated(ethereum, { pageClockSec: PAGE_CLOCK_SEC })

	// 110m on Jul 14 to 90m on Jul 15; the page's Jul 14 clock would compare against Jul 13 instead.
	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('-18.18%'))
})

test('compare chains applies the setting series its data already carries, without asking again', async () => {
	localStorage.setItem('DEFILLAMA', JSON.stringify({ staking: true }))
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 6, 14, 13) })
	const compared = {
		...(ethereum.props as { props: Record<string, unknown> }).props,
		extraTvlCharts: { ...emptyExtras, staking: ethereumStaking }
	} as unknown as IChainOverviewData
	// The card never requests these: its query is off while the data carries them. An earlier test in this file can
	// still issue a late Ethereum request, so it gets a fixture, one whose staking would show +50% if it were used.
	serveStaking('Ethereum', ethereumTvl, { [dayMs(13)]: 100_000_000, [dayMs(14)]: 100_000_000 }, PAGE_CLOCK_SEC * 1000)
	rendered = await renderHydrated(<Tree props={compared} />, { pageClockSec: PAGE_CLOCK_SEC })

	await waitForUi(() => expect(tvlChange(rendered!.container)).toBe('+10.00%'))
})
