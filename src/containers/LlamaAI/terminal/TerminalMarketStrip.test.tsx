// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import {
	formatCountdown,
	formatDayChange,
	formatHourlyFunding,
	formatPrice,
	mergeLiveStats,
	pairName,
	priceDecimals,
	secondsToNextFunding,
	TerminalMarketStrip
} from './TerminalMarketStrip'
import { closeTerminalSocket } from './terminalSocket'

/**
 * Hyperliquid pays funding at every UTC top of the hour. A countdown that shows 60:00 or a
 * negative number at the boundary tells a trader the wrong thing about when they next pay.
 */
const hour = Date.UTC(2026, 8, 21, 14)

test('the countdown restarts at 59:59 on the hour and never reads 60:00 or negative', () => {
	expect(formatCountdown(secondsToNextFunding(hour))).toBe('59:59')
	expect(formatCountdown(secondsToNextFunding(hour + 999))).toBe('59:59')
	expect(formatCountdown(secondsToNextFunding(hour - 2000))).toBe('00:01')
	expect(formatCountdown(secondsToNextFunding(hour - 1))).toBe('00:00')
	for (let ms = hour - 5000; ms < hour + 5000; ms += 250) {
		const seconds = secondsToNextFunding(ms)
		expect(seconds).toBeGreaterThanOrEqual(0)
		expect(seconds).toBeLessThan(3600)
	}
})

test('a tiny hourly funding fraction keeps its sign and digits instead of rounding to 0%', () => {
	expect(formatHourlyFunding(0.0000125, 10.95)).toEqual({ rate: '+0.0013%', apr: '11% APR' })
	expect(formatHourlyFunding(-0.0000125, -10.95)).toEqual({ rate: '-0.0013%', apr: '-11% APR' })
	expect(formatHourlyFunding(0.00013, 113.88)).toEqual({ rate: '+0.0130%', apr: '113.9% APR' })
})

test('the 24h change pairs the price move since the prior day with its percent, signed by direction', () => {
	expect(formatDayChange({ markPx: 95.66, prevDayPx: 93.1, dayChangePct: 2.7497 })).toBe('+2.560 / +2.75%')
	expect(formatDayChange({ markPx: 93.1, prevDayPx: 95.66, dayChangePct: -2.6762 })).toBe('-2.560 / -2.68%')
})

// The strip updates several times a second. A price that drops a trailing zero on one tick and
// grows a digit on the next changes width, and every cell after it jumps sideways.
test('a live price keeps the same width from tick to tick', () => {
	const decimals = priceDecimals(91.45)
	const widths = [94.1242, 94.124, 94.12, 94.1, 94].map((price) => formatPrice(price, decimals).length)
	expect(new Set(widths).size).toBe(1)
	expect(formatPrice(94.1, decimals)).toBe('$94.100')
	expect(priceDecimals(80_400)).toBe(0)
	expect(priceDecimals(0.0123)).toBe(6)
	expect(formatHourlyFunding(0.00002, 17.5).rate.length).toBe(formatHourlyFunding(0.0000145, 12.7).rate.length)
})

test('a market is named as the USDC pair it settles in, without a HIP-3 dex prefix', () => {
	expect(pairName('HYPE')).toBe('HYPE-USDC')
	expect(pairName('xyz:TSLA')).toBe('TSLA-USDC')
})

const fixtures = installFixtureFetch()

let root: ReturnType<typeof createRoot> | null = null

async function renderStrip(symbol: string, fetchFn: typeof fetch, until: (text: string) => boolean) {
	const container = document.createElement('div')
	root = createRoot(container)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	await act(async () => {
		root!.render(
			<QueryClientProvider client={client}>
				<TerminalMarketStrip symbol={symbol} fetchFn={fetchFn} />
			</QueryClientProvider>
		)
	})
	for (let i = 0; i < 50 && !until(container.textContent ?? ''); i++) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
	}
	return container
}

beforeEach(() => {
	FakeSocket.instances = []
	vi.stubGlobal('WebSocket', FakeSocket)
	pb.authStore.save(`e30.${btoa(JSON.stringify({ id: 'user', exp: 4_102_444_800 }))}.signature`, null)
	fixtures.serve({ [`${AI_SERVER}/terminal/ws-ticket`]: { ticket: 't' } })
})

afterEach(() => {
	act(() => root?.unmount())
	root = null
	closeTerminalSocket()
	vi.unstubAllGlobals()
})

test('a symbol that is not a Hyperliquid perp says so rather than showing zeros', async () => {
	const fetchFn = (async () => new Response('not found', { status: 404 })) as typeof fetch
	const container = await renderStrip('AAVE', fetchFn, (text) => text.includes('not a Hyperliquid perp'))
	expect(container.textContent).toContain('AAVE is not a Hyperliquid perp')
	expect(container.textContent).not.toMatch(/\$|Open interest|could not be loaded/)
})

test('a backend that does not send the oracle price yet shows a dash there instead of breaking the strip', async () => {
	const stats = {
		symbol: 'HYPE',
		markPx: 44.12,
		prevDayPx: 43,
		dayChangePct: 2.6,
		dayNtlVlm: 1.81e9,
		openInterest: 3.55e9,
		funding: 0.0000125,
		fundingAprPct: 10.95,
		maxLeverage: 10
	}
	const fetchFn = (async () => Response.json(stats)) as typeof fetch
	const container = await renderStrip('HYPE', fetchFn, (text) => text.includes('$44.12'))
	const oracle = [...container.querySelectorAll('dl > div')].find(
		(cell) => cell.querySelector('dt')?.textContent === 'Oracle'
	)
	expect(oracle?.querySelector('dd')?.textContent).toBe('—')
	expect(container.textContent).toContain('HYPE-USDC')
	expect(container.textContent).toContain('10x')
	expect(container.textContent).not.toContain('NaN')
})

test('a HIP-3 market keeps its dex beside the pair, and its icon is fetched by the full coin id', async () => {
	const requested: Array<string> = []
	const fetchFn = (async (url: string) => {
		requested.push(url)
		return Response.json({ ...restStats('xyz:TSLA', 369.1, 363.24), maxLeverage: 20 })
	}) as typeof fetch
	const container = await renderStrip('xyz:TSLA', fetchFn, (text) => text.includes('TSLA-USDC') && text.includes('20x'))
	expect(requested[0]).toContain('symbol=xyz%3ATSLA')
	const identity = container.querySelector('dl > div dd')
	expect(identity?.textContent).toContain('xyz')
	expect(identity?.textContent).toContain('20x')
	expect(identity?.querySelector('img')?.getAttribute('src')).toBe('https://app.hyperliquid.xyz/coins/xyz%3ATSLA.svg')
})

class FakeSocket {
	static instances: Array<FakeSocket> = []
	static readonly OPEN = 1
	readyState = 0
	sent: Array<Record<string, string>> = []
	private handlers = new Map<string, Array<(event: any) => void>>()
	constructor(public url: string) {
		FakeSocket.instances.push(this)
	}
	addEventListener(type: string, handler: (event: any) => void) {
		this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler])
	}
	send(raw: string) {
		this.sent.push(JSON.parse(raw))
	}
	close() {
		this.readyState = 3
		this.emit('close', {})
	}
	emit(type: string, event: any) {
		for (const handler of this.handlers.get(type) ?? []) handler(event)
	}
}

const restStats = (symbol: string, markPx: number, prevDayPx = 90) => ({
	symbol,
	markPx,
	oraclePx: markPx,
	prevDayPx,
	dayChangePct: ((markPx - prevDayPx) / prevDayPx) * 100,
	dayNtlVlm: 1.81e9,
	openInterest: 3.55e9,
	funding: 0.0000125,
	fundingAprPct: 10.95,
	maxLeverage: 10
})

const cellText = (container: HTMLElement, label: string) =>
	[...container.querySelectorAll('dl > div')]
		.find((cell) => cell.querySelector('dt')?.textContent === label)
		?.querySelector('dd')?.textContent

async function waitUntil(check: () => boolean) {
	for (let i = 0; i < 50 && !check(); i++) await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
}

test('socket stats overwrite the cached REST numbers and keep the leverage only REST knows', async () => {
	const fetchFn = (async (url: string) =>
		Response.json(url.includes('BTC') ? restStats('BTC', 80_000, 79_000) : restStats('HYPE', 94))) as typeof fetch
	const container = document.createElement('div')
	root = createRoot(container)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const render = (symbol: string) =>
		act(async () => {
			root!.render(
				<QueryClientProvider client={client}>
					<TerminalMarketStrip symbol={symbol} fetchFn={fetchFn} />
				</QueryClientProvider>
			)
		})
	await render('HYPE')
	await waitUntil(() => FakeSocket.instances.length === 1)
	const socket = FakeSocket.instances[0]
	await act(async () => {
		socket.readyState = 1
		socket.emit('open', {})
	})
	expect(socket.sent).toEqual([{ op: 'sub', channel: 'stats', symbol: 'HYPE' }])
	await waitUntil(() => cellText(container, 'Mark') === '$94.000')
	expect(cellText(container, 'Mark')).toBe('$94.000')

	await act(async () => {
		socket.emit('message', {
			data: JSON.stringify({
				type: 'stats',
				symbol: 'HYPE',
				stats: { ...restStats('HYPE', 95.5), maxLeverage: undefined }
			})
		})
	})
	expect(cellText(container, 'Mark')).toBe('$95.500')
	expect(container.textContent).toContain('10x')

	await render('BTC')
	await waitUntil(() => cellText(container, 'Mark') === '$80,000')
	expect(FakeSocket.instances).toHaveLength(1)
	expect(socket.sent.slice(1)).toEqual([
		{ op: 'unsub', channel: 'stats', symbol: 'HYPE' },
		{ op: 'sub', channel: 'stats', symbol: 'BTC' }
	])
	await act(async () => {
		socket.emit('message', {
			data: JSON.stringify({ type: 'stats', symbol: 'HYPE', stats: restStats('HYPE', 99) })
		})
	})
	expect(cellText(container, 'Mark')).toBe('$80,000')
})

test('a socket that went quiet stops masking newer REST numbers', () => {
	const rest = restStats('HYPE', 94)
	const live = { stats: restStats('HYPE', 95), at: 1_000_000 }
	expect(mergeLiveStats(rest, 1_000_000 + 5000, live)?.markPx).toBe(95)
	expect(mergeLiveStats(rest, 1_000_000 + 31_000, live)?.markPx).toBe(94)
	expect(mergeLiveStats(null, 0, live)).toBeNull()
})

async function renderLiveStrip(fetchFn: typeof fetch) {
	const container = document.createElement('div')
	root = createRoot(container)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	await act(async () => {
		root!.render(
			<QueryClientProvider client={client}>
				<TerminalMarketStrip symbol="HYPE" fetchFn={fetchFn} />
			</QueryClientProvider>
		)
	})
	for (let i = 0; i < 20 && FakeSocket.instances.length === 0; i++) await act(() => vi.advanceTimersByTimeAsync(0))
	const socket = FakeSocket.instances[0]
	await act(async () => {
		socket.readyState = 1
		socket.emit('open', {})
	})
	const tick = (markPx: number) =>
		act(async () =>
			socket.emit('message', {
				data: JSON.stringify({ type: 'stats', symbol: 'HYPE', stats: restStats('HYPE', markPx) })
			})
		)
	return { container, client, tick }
}

// A quiet market repeats the same numbers, and a stream that repeats itself is still live: it must
// keep beating a REST snapshot taken later.
test('a live stream that repeats the same numbers still outranks a newer REST snapshot', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
	try {
		let restCalls = 0
		const fetchFn = (async () => {
			restCalls++
			return Response.json(restStats('HYPE', 94))
		}) as typeof fetch
		const { container, client, tick } = await renderLiveStrip(fetchFn)
		await tick(95)
		expect(cellText(container, 'Mark')).toBe('$95.000')

		await act(() => vi.advanceTimersByTimeAsync(40_000))
		await tick(95)
		await act(() => client.refetchQueries({ queryKey: ['llamaai-terminal-stats', 'HYPE'] }))
		await act(() => vi.advanceTimersByTimeAsync(0))
		expect(restCalls).toBe(2)

		expect(cellText(container, 'Mark')).toBe('$95.000')
	} finally {
		vi.useRealTimers()
	}
})

// While the socket streams, REST is only a slow backstop. Once it stops, REST is the only source
// again and has to go back to its normal pace instead of leaving the strip a minute stale.
test('a socket that went quiet puts the REST poll back on its normal pace', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
	try {
		let restCalls = 0
		const fetchFn = (async () => {
			restCalls++
			return Response.json(restStats('HYPE', 94))
		}) as typeof fetch
		const { tick } = await renderLiveStrip(fetchFn)
		await tick(95)
		const afterFirst = restCalls

		await act(() => vi.advanceTimersByTimeAsync(59_000))
		expect(restCalls).toBe(afterFirst)

		await act(() => vi.advanceTimersByTimeAsync(2000))
		expect(restCalls).toBe(afterFirst + 1)
		await act(() => vi.advanceTimersByTimeAsync(15_000))
		expect(restCalls).toBe(afterFirst + 2)
	} finally {
		vi.useRealTimers()
	}
})
