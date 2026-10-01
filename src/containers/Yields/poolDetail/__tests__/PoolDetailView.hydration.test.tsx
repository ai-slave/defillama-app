// @vitest-environment happy-dom

// A pool page reaches readers hours or days after it was built. Whether its measured APY is still
// current, and whether its last day is still a partial reading, are questions about that build,
// so neither may change once the reader's browser takes over.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { renderHydrated, type HydrationResult } from '~/utils/testing/hydration'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PoolDetailView, type PoolDetailViewProps } from '../PoolDetailView'
import type { PoolHistory } from '../types'

const mocks = vi.hoisted(() => ({
	router: {
		events: { on: vi.fn(), off: vi.fn() },
		isReady: true,
		pathname: '/yields/pool/[pool]',
		query: {} as Record<string, string>,
		replace: vi.fn()
	}
}))
vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))
vi.mock('../PoolHeader', () => ({ PoolHeader: () => <h1>Pool summary</h1>, PoolMetaInfo: () => null }))

const session = installSubscriberSession('subscriber-1')

const DAY = 86_400_000
const BROWSER_MS = Date.parse('2026-09-24T12:00:00Z')

/**
 * A subscriber's pool page built at noon on `buildDay`. Its reading was measured that morning, and
 * the chart's only verified bar is that build day's partial one.
 */
function poolPage(poolId: string, buildDay: string): { props: PoolDetailViewProps; clockSec: number } {
	const buildMs = Date.parse(`${buildDay}T12:00:00Z`)
	const midnight = buildMs - (buildMs % DAY)
	const verified = {
		apy: { avg_1d: 3.5, avg_7d: null, avg_30d: null },
		apy_as_of: `${buildDay}T06:00:00.000Z`,
		apy_confidence: 'high' as const,
		exit: null,
		exit_liquidity: null,
		tvl: null
	}
	const values = (today: number | null) => [null, null, today]
	return {
		clockSec: buildMs / 1000,
		props: {
			poolId,
			mode: 'pool',
			hasRisk: false,
			exploited: false,
			initialRange: 'max',
			symbol: 'stETH',
			name: 'Lido stETH',
			protocol: { slug: 'lido', name: 'Lido', category: null, has_audit: null },
			chain: { slug: 'ethereum', name: 'Ethereum' },
			supply: {
				apyLabel: 'Supply APY',
				apy: { total: 2.3, base: 2.3, reward: null, intrinsic: null, rewardTokens: [], intrinsicSource: null },
				metrics: []
			},
			borrow: null,
			stability: null,
			supplyChart: {
				title: 'Supply APY',
				net: false,
				dates: [midnight - 2 * DAY, midnight - DAY, midnight],
				bars: [
					{
						key: 'verifiedApy',
						label: 'Verified Base',
						colorKey: 'verified',
						replaces: 'base',
						values: values(3.5),
						avg7: values(null),
						avg30: values(null)
					},
					{
						key: 'base',
						label: 'Base',
						colorKey: 'accent',
						values: [2.1, 2.2, 2.3],
						avg7: values(null),
						avg30: values(null)
					}
				],
				lines: [],
				netLine: null
			},
			borrowChart: null,
			growthChart: null,
			intrinsicSeries: null,
			intrinsicApy: null,
			liquidityChart: null,
			exitReliability: null,
			liquidityDecimals: null,
			verified,
			apy: null,
			verifiedWindows: [{ label: '24h', verified: 3.5 }],
			holders: null,
			details: { poolTokenAddress: null, url: null, protocolName: 'Lido', assets: [] }
		}
	}
}

function Page(props: PoolDetailViewProps) {
	const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
	return (
		<QueryClientProvider client={client}>
			<AuthProvider>
				<PoolDetailView {...props} />
			</AuthProvider>
		</QueryClientProvider>
	)
}

/** The measured hero's stamp prefix: "Measured" while current, "Last measured" once it is history. */
const heroStamp = (root: ParentNode) =>
	Array.from(root.querySelectorAll('span[title]'))
		.map((span) => /^(Last measured|Measured) /.exec(span.textContent)?.[1])
		.find(Boolean)

/** The series the APY chart draws, as its removable chips name them. */
const chartSeries = (root: ParentNode) =>
	Array.from(root.querySelectorAll('button')).flatMap((button) => {
		const name = /Remove (.+)$/.exec(button.textContent)?.[1]
		return name ? [name] : []
	})

let rendered: HydrationResult | null = null

beforeEach(() => {
	mocks.router = { ...mocks.router, query: { pool: 'pool-a' }, replace: vi.fn().mockResolvedValue(true) }
	vi.useFakeTimers({ toFake: ['Date'], now: BROWSER_MS })
})

afterEach(async () => {
	await rendered?.unmount()
	rendered = null
	vi.useRealTimers()
})

test('a page opened days after its build keeps its current reading and leaves the partial day undrawn', async () => {
	const pool = poolPage('pool-a', '2026-09-20')
	rendered = await renderHydrated(<Page {...pool.props} />, { pageClockSec: pool.clockSec })

	expect(rendered.errors).toEqual([])
	const serverDocument = new DOMParser().parseFromString(rendered.serverHtml, 'text/html')
	expect(heroStamp(serverDocument)).toBe('Measured')
	expect(heroStamp(rendered.container)).toBe('Measured')
	// The verified bar's only reading is the build day's, so the chart opens on the reported base.
	expect(chartSeries(rendered.container)).toEqual(['Base'])
})

test('navigating to another pool judges it at that page’s own build', async () => {
	const first = poolPage('pool-a', '2026-09-20')
	rendered = await renderHydrated(<Page {...first.props} />, { pageClockSec: first.clockSec })

	// An older build: its reading is days old by the first page's clock, and current by its own.
	const second = poolPage('pool-b', '2026-09-16')
	mocks.router = { ...mocks.router, query: { pool: 'pool-b' } }
	await rendered.update(<Page {...second.props} />, second.clockSec)

	expect(heroStamp(rendered.container)).toBe('Measured')
	expect(chartSeries(rendered.container)).toEqual(['Base'])
})

test('a wider range read today judges its last day by that read, not by the page build', async () => {
	const pool = poolPage('pool-a', '2026-09-20')
	// The reader asks for more than the page carried, so the chart reads the history again today.
	mocks.router = { ...mocks.router, query: { pool: 'pool-a', range: 'max' } }
	const reading = (date: string): PoolHistory[number] => ({
		date,
		tvl_usd: 1_000_000,
		apy: {
			avg_1d: { base: 2.3, reward: null, total: 2.3 },
			avg_7d: { base: null, reward: null, total: null },
			avg_30d: { base: null, reward: null, total: null }
		},
		intrinsic: null,
		price_per_share: null,
		verified: {
			apy: { avg_1d: 3.5, avg_7d: null, avg_30d: null },
			price_per_share: null,
			liquidity_available: null,
			tvl: null,
			liquidity_available_usd: null,
			tvl_usd: null,
			exit: null
		}
	})
	// Measured from the page's build day on: days that were partial at the build are complete by now.
	session.serve({
		'/api/private/yields/pool/pool-a/history': {
			data: ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'].map(reading)
		}
	})
	rendered = await renderHydrated(<Page {...pool.props} initialRange="30d" />, { pageClockSec: pool.clockSec })

	await waitForUi(() => expect(chartSeries(rendered!.container)).toEqual(['Verified Base']))
})
