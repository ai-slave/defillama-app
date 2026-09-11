// @vitest-environment happy-dom

import { Storage } from 'happy-dom'
import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PoolDetailView, type PoolDetailViewProps } from './PoolDetailView'
import { POOL_CHART_RANGE_PREF, POOL_CHART_WINDOW_PREFS } from './queryState'

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
vi.mock('./PoolApyChart', () => ({
	PoolApyChart: (props: { kind: string }) => {
		mocks.chart(props.kind, mocks.router.query)
		return (
			<div>{`${props.kind}:${mocks.router.query.range ?? 'max'}:${mocks.router.query[`${props.kind}Window`] ?? 'daily'}`}</div>
		)
	}
}))
vi.mock('./PoolHeader', () => ({ PoolHeader: () => <h1>Pool summary</h1>, PoolMetaInfo: () => null }))
vi.mock('./HoldersPanel', () => ({ HoldersPanel: () => null }))

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
	holders: null,
	details: { poolTokenAddress: null, url: null, protocolName: 'Lido', assets: [] }
}

beforeEach(() => {
	vi.stubGlobal('localStorage', new Storage())
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
		window.localStorage.setItem(POOL_CHART_RANGE_PREF.storageKey, '90d')
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
