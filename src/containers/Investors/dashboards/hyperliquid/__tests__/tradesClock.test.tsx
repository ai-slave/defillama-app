// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import Trades from '../Trades'

// The depth picker is the shared Select, which reads the router.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }))

const http = installFixtureFetch()

class FakeWebSocket extends EventTarget {
	static OPEN = 1
	static CONNECTING = 0
	static latest: FakeWebSocket
	readyState = FakeWebSocket.CONNECTING
	constructor() {
		super()
		FakeWebSocket.latest = this
	}
	send() {}
	close() {}
}

let container: HTMLDivElement
let root: Root
let client: QueryClient

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers({ now: new Date('2026-09-29T12:00:00Z') })
	vi.stubGlobal('WebSocket', FakeWebSocket)
	const never = () => new Promise<Response>(() => {})
	http.serve({ '/api/public/hyperliquid/perps': never, '/api/public/hyperliquid/l2-book': never })
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

async function receiveTrade(side: 'B' | 'A') {
	const data = [{ coin: 'BTC', side, px: '65000', sz: '1', time: Date.now(), tid: Date.now() }]
	await act(async () => {
		FakeWebSocket.latest.dispatchEvent(
			new MessageEvent('message', { data: JSON.stringify({ channel: 'trades', data }) })
		)
	})
}

const buyRatio1m = () =>
	[...container.querySelectorAll('div')].find((el) => el.textContent === 'Buy Ratio 1m')?.nextElementSibling
		?.textContent

test('a trade leaves the 1m buy ratio a minute later, even while new trades keep arriving', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Trades />
			</QueryClientProvider>
		)
	)
	FakeWebSocket.latest.readyState = FakeWebSocket.OPEN
	await act(async () => FakeWebSocket.latest.dispatchEvent(new Event('open')))

	await receiveTrade('B')
	expect(buyRatio1m()).toBe('100.0%')
	for (let i = 0; i < 80; i++) {
		await act(async () => vi.advanceTimersByTime(800))
		await receiveTrade('A')
	}

	// 64s later only the sells, one every 800ms, are inside the last minute.
	expect(buyRatio1m()).toBe('0.0%')
})
