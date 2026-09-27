// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Storage } from 'happy-dom'
import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { PageClockProvider } from '~/hooks/usePageClock'
import { PoolDetailView, type PoolDetailViewProps } from '../PoolDetailView'
import { POOL_CHART_RANGE_PREFS, POOL_CHART_WINDOW_PREFS } from '../queryState'

const mocks = vi.hoisted(() => ({
	router: {
		events: { on: vi.fn(), off: vi.fn() },
		isReady: true,
		pathname: '/yields/pool/[pool]',
		query: {} as Record<string, string>,
		replace: vi.fn()
	},
	chart: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
// Heavy chart and header children; the stub reports the range and window the chart mounted with.
vi.mock('../PoolApyChart', async () => {
	const { getPoolRange } = await import('../queryState')
	return {
		PoolApyChart: (props: { kind: 'supply' | 'borrow' }) => {
			mocks.chart(props.kind)
			const range = getPoolRange(mocks.router.query, props.kind)
			return <div>{`${props.kind}:${range}:${mocks.router.query[`${props.kind}Window`] ?? 'daily'}`}</div>
		}
	}
})
vi.mock('../PoolHeader', () => ({ PoolHeader: () => <h1>Pool summary</h1>, PoolMetaInfo: () => null }))

const props: PoolDetailViewProps = {
	poolId: 'pool-1',
	mode: 'pool',
	hasRisk: false,
	exploited: false,
	initialRange: 'max',
	symbol: 'ETH',
	name: 'Ether',
	protocol: { slug: 'lido', name: 'Lido', category: null, has_audit: null },
	chain: { slug: 'ethereum', name: 'Ethereum' },
	supply: null,
	borrow: null,
	stability: null,
	supplyChart: { title: 'Supply APY', net: false, dates: [], bars: [], lines: [], netLine: null },
	borrowChart: { title: 'Borrow APY', net: false, dates: [], bars: [], lines: [], netLine: null },
	growthChart: null,
	intrinsicSeries: null,
	liquidityChart: null,
	exitReliability: null,
	liquidityDecimals: null,
	verified: null,
	apy: null,
	verifiedWindows: [],
	holders: null,
	details: { poolTokenAddress: null, url: null, protocolName: 'Lido', assets: [] }
}

// An anonymous reader: real auth and query providers with no session.
function Page() {
	return (
		<QueryClientProvider client={new QueryClient()}>
			<AuthProvider>
				<PoolDetailView {...props} />
			</AuthProvider>
		</QueryClientProvider>
	)
}

beforeEach(() => {
	vi.stubGlobal('localStorage', new Storage())
	mocks.chart.mockClear()
	mocks.router = { ...mocks.router, query: { pool: 'pool-1' }, replace: vi.fn().mockResolvedValue(true) }
})
afterEach(() => vi.unstubAllGlobals())

test.each([true, false])('never renders default charts before resolving preferences (saved: %s)', async (saved) => {
	const page = (
		<PageClockProvider pageClockSec={1_700_000_000}>
			<Page />
		</PageClockProvider>
	)
	const html = renderToString(page)
	expect(html).toContain('Pool summary')
	expect(html).toContain('Loading chart')
	expect(mocks.chart).not.toHaveBeenCalled()
	if (saved) {
		window.localStorage.setItem(POOL_CHART_RANGE_PREFS.supply.storageKey, '90d')
		window.localStorage.setItem(POOL_CHART_WINDOW_PREFS.supply.storageKey, '7d')
	}
	const container = document.createElement('div')
	container.innerHTML = html
	document.body.appendChild(container)
	const onRecoverableError = vi.fn()
	let root: Root | undefined
	try {
		await act(async () => {
			root = hydrateRoot(container, page, { onRecoverableError })
		})
		expect(onRecoverableError).not.toHaveBeenCalled()
		expect(container.textContent.includes('Loading chart')).toBe(saved)
		// Saved preferences are restored into the URL in one replace; the router then applies it.
		const destinations = mocks.router.replace.mock.calls.map(([destination]) => destination.query)
		expect(destinations).toEqual(
			saved ? [{ pool: 'pool-1', range: '90d', borrowRange: '90d', supplyWindow: '7d' }] : []
		)
		if (saved) {
			mocks.router = { ...mocks.router, query: destinations[0] }
			await act(async () => root!.render(<Page />))
		}
		// Both charts mount; saved preferences mount them on the restored range and window.
		expect(container.textContent).toContain(saved ? 'supply:90d:7d' : 'supply:')
		expect(container.textContent).toContain(saved ? 'borrow:90d:daily' : 'borrow:')
		expect(container.textContent).not.toContain('Loading chart')
	} finally {
		await act(async () => root?.unmount())
		container.remove()
	}
})
