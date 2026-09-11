// @vitest-environment happy-dom

import { Storage } from 'happy-dom'
import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PoolDetailView, type PoolDetailViewProps } from './PoolDetailView'
import { POOL_CHART_RANGE_PREFS, POOL_CHART_WINDOW_PREFS } from './queryState'
import { EMPTY_POOL_VERIFIED_PROPS } from './verifiedProps'

const mocks = vi.hoisted(() => ({
	router: {
		events: { on: vi.fn(), off: vi.fn() },
		isReady: true,
		pathname: '/yields/pool/[pool]',
		query: {} as Record<string, string>,
		replace: vi.fn()
	},
	access: { hasAccess: false, isDenied: true },
	paidLoading: false,
	chart: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
vi.mock('./PoolApyChart', () => ({
	PoolApyChart: (props: { kind: string; model: { bars: Array<{ key: string }> } }) => {
		mocks.chart(
			props.kind,
			mocks.router.query,
			props.model.bars.map((bar) => bar.key)
		)
		return (
			<div>{`${props.kind}:${mocks.router.query.range ?? 'max'}:${mocks.router.query[`${props.kind}Window`] ?? 'daily'}`}</div>
		)
	}
}))
vi.mock('./PoolHeader', () => ({ PoolHeader: () => <h1>Pool summary</h1>, PoolMetaInfo: () => null }))
vi.mock('./HoldersPanel', () => ({ HoldersPanel: () => null }))
vi.mock('../useVerifiedAccess', () => ({ useVerifiedAccess: () => mocks.access }))
vi.mock('../VerifiedApyAnnouncement', () => ({ VerifiedApyAnnouncement: () => <div>Upgrade banner</div> }))
vi.mock('./VerifiedSnapshotCard', async (importOriginal) => ({
	...(await importOriginal<typeof import('./VerifiedSnapshotCard')>()),
	LockedVerifiedSection: () => <div>Upgrade offer</div>
}))
vi.mock('./useVerifiedProps', () => ({
	usePoolVerifiedProps: () => ({ props: EMPTY_POOL_VERIFIED_PROPS, isLoading: mocks.paidLoading })
}))

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
	liquidityChart: null,
	exitReliability: null,
	liquidityDecimals: null,
	verified: null,
	apy: null,
	verifiedWindows: [],
	holders: null,
	details: { poolTokenAddress: null, url: null, protocolName: 'Lido', assets: [] }
}

beforeEach(() => {
	vi.stubGlobal('localStorage', new Storage())
	mocks.access = { hasAccess: false, isDenied: true }
	mocks.paidLoading = false
	mocks.chart.mockClear()
	mocks.router = { ...mocks.router, query: { pool: 'pool-1' }, replace: vi.fn().mockResolvedValue(true) }
})
afterEach(() => vi.unstubAllGlobals())

test.each([true, false])('never renders default charts before resolving preferences (saved: %s)', async (saved) => {
	const html = renderToString(<PoolDetailView {...props} />)
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
			root = hydrateRoot(container, <PoolDetailView {...props} />, { onRecoverableError })
		})
		expect(onRecoverableError).not.toHaveBeenCalled()
		expect(mocks.chart.mock.calls.length > 0).toBe(!saved)
		expect(container.textContent.includes('Loading chart')).toBe(saved)
		if (saved) {
			mocks.router = { ...mocks.router, query: { pool: 'pool-1', range: '90d', supplyWindow: '7d' } }
			await act(async () => root!.render(<PoolDetailView {...props} />))
		}
		expect(container.textContent).toContain(saved ? 'supply:90d:7d' : 'supply:max:daily')
		expect(container.textContent).toContain(saved ? 'borrow:90d:daily' : 'borrow:max:daily')
		expect(container.textContent).not.toContain('Loading chart')
	} finally {
		await act(async () => root?.unmount())
		container.remove()
	}
})

test('keeps unknown SSR access neutral until the client confirms denial', () => {
	mocks.access = { hasAccess: false, isDenied: false }
	const pending = renderToString(<PoolDetailView {...props} verifiedLocked={null} />)
	expect(pending).toContain('Verified APY is temporarily unavailable')
	expect(pending).not.toContain('Upgrade')
	mocks.access = { hasAccess: false, isDenied: true }
	const denied = renderToString(<PoolDetailView {...props} verifiedLocked={null} />)
	expect(denied).toContain('Upgrade offer')
	expect(denied).not.toContain('temporarily unavailable')
})
test('keeps anonymous SSR offers visible while client auth initializes', () => {
	mocks.access = { hasAccess: false, isDenied: false }
	expect(renderToString(<PoolDetailView {...props} verifiedLocked />)).toContain('Upgrade offer')
})
test.each([true, false])('shows unavailable copy only after the paid fetch settles (loading: %s)', (loading) => {
	mocks.access = { hasAccess: true, isDenied: false }
	mocks.paidLoading = loading
	const html = renderToString(<PoolDetailView {...props} verifiedLocked={null} />)
	expect(html).not.toContain('Upgrade')
	expect(html.includes('Verified APY is temporarily unavailable')).toBe(!loading)
})

// Signed out in another tab: the page keeps the chart, minus the verified base it can no longer show.
test('falls back to the reported supply chart when a seeded subscriber is denied', () => {
	const bar = { values: [3.5], avg7: [3.6], avg30: [3.7] }
	const html = renderToString(
		<PoolDetailView
			{...props}
			supplyChart={{
				title: 'Supply APY',
				net: false,
				dates: [1_701_561_600_000],
				bars: [
					{ key: 'verifiedApy', label: 'Verified Base', colorKey: 'verified', replaces: 'base', ...bar },
					{ key: 'base', label: 'Base', colorKey: 'accent', ...bar }
				],
				lines: [],
				netLine: null
			}}
		/>
	)
	// The server renders the chart's placeholder, so the slot is what proves the chart survived.
	expect(html).toContain('Supply APY')
	expect(html).not.toContain('No history available')
})
