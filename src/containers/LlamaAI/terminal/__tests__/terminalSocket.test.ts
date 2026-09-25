// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import {
	closeTerminalSocket,
	releaseTerminalBars,
	subscribeTerminalBars,
	subscribeTerminalStats,
	unsubscribeTerminalListener
} from '../terminalSocket'

/**
 * The mock this replaced opened one Hyperliquid socket per listener guid, and guids pile up because
 * unsubscribeBars arrives seconds after a symbol switch. These cases pin the multiplexing that fixes
 * it: one socket per page, one backend subscription per (symbol, resolution), and every live listener
 * re-subscribed after the socket drops.
 */

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
		const existing = this.handlers.get(type) ?? []
		existing.push(handler)
		this.handlers.set(type, existing)
	}

	send(raw: string) {
		this.sent.push(JSON.parse(raw))
	}

	close() {
		this.readyState = 3
		this.emit('close', {})
	}

	open() {
		this.readyState = 1
		this.emit('open', {})
	}

	emit(type: string, event: any) {
		for (const handler of this.handlers.get(type) ?? []) handler(event)
	}
}

const ops = (socket: FakeSocket) =>
	socket.sent.map((message) => `${message.op}:${message.symbol}:${message.resolution}`)

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let ticketRequests = 0
let fetchCalls = 0
const TOKEN = `e30.${btoa(JSON.stringify({ id: 'user', exp: 4_102_444_800 }))}.signature`

beforeEach(() => {
	FakeSocket.instances = []
	ticketRequests = 0
	fetchCalls = 0
	vi.stubGlobal('WebSocket', FakeSocket)
	pb.authStore.save(TOKEN, null)
	vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
		fetchCalls += 1
		if (new Headers(init?.headers).get('Authorization') !== `Bearer ${TOKEN}`)
			return Promise.resolve({ ok: false, status: 401 })
		ticketRequests += 1
		return Promise.resolve({ ok: true, json: () => Promise.resolve({ ticket: `ticket-${ticketRequests}` }) })
	})
})

afterEach(() => {
	closeTerminalSocket()
	vi.unstubAllGlobals()
})

describe('terminal socket multiplexing', () => {
	test('shares one socket and one backend subscription per symbol and resolution', async () => {
		subscribeTerminalBars('guid-a', 'BTC', '60', () => {})
		subscribeTerminalBars('guid-b', 'BTC', '60', () => {})
		subscribeTerminalBars('guid-c', 'ETH', '60', () => {})
		await flush()

		expect(FakeSocket.instances).toHaveLength(1)
		const socket = FakeSocket.instances[0]
		expect(socket.url).toContain('ticket=ticket-1')

		socket.open()
		expect(ops(socket)).toEqual(['sub:BTC:60', 'sub:ETH:60'])

		subscribeTerminalBars('guid-d', 'BTC', '60', () => {})
		subscribeTerminalBars('guid-e', 'BTC', '240', () => {})
		await flush()

		expect(FakeSocket.instances).toHaveLength(1)
		expect(ops(socket)).toEqual(['sub:BTC:60', 'sub:ETH:60', 'sub:BTC:240'])
	})

	test('a HIP-3 candle reaches the listener on its dex-prefixed coin, never one on the bare coin', async () => {
		const hip3 = vi.fn()
		const bare = vi.fn()
		subscribeTerminalBars('guid-a', 'xyz:TSLA', '60', hip3)
		subscribeTerminalBars('guid-b', 'TSLA', '60', bare)
		await flush()
		const socket = FakeSocket.instances[0]
		socket.open()
		expect(ops(socket)).toEqual(['sub:xyz:TSLA:60', 'sub:TSLA:60'])

		socket.emit('message', {
			data: JSON.stringify({
				type: 'candle',
				symbol: 'xyz:TSLA',
				resolution: '60',
				bar: { timestamp: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 }
			})
		})

		expect(hip3).toHaveBeenCalledTimes(1)
		expect(bare).not.toHaveBeenCalled()
	})

	test('unsubscribes a key only once its last listener is gone', async () => {
		subscribeTerminalBars('guid-a', 'BTC', '60', () => {})
		subscribeTerminalBars('guid-b', 'BTC', '60', () => {})
		subscribeTerminalBars('guid-c', 'ETH', '60', () => {})
		await flush()
		const socket = FakeSocket.instances[0]
		socket.open()
		socket.sent.length = 0

		unsubscribeTerminalListener('guid-a')
		expect(ops(socket)).toEqual([])

		unsubscribeTerminalListener('guid-b')
		expect(ops(socket)).toEqual(['unsub:BTC:60'])
	})

	test('fans a candle out to every listener on its key and to no other', async () => {
		const btc = vi.fn()
		const btcAlso = vi.fn()
		const eth = vi.fn()
		subscribeTerminalBars('guid-a', 'BTC', '60', btc)
		subscribeTerminalBars('guid-b', 'BTC', '60', btcAlso)
		subscribeTerminalBars('guid-c', 'ETH', '60', eth)
		await flush()
		const socket = FakeSocket.instances[0]
		socket.open()

		socket.emit('message', {
			data: JSON.stringify({
				type: 'candle',
				symbol: 'BTC',
				resolution: '60',
				bar: { timestamp: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 }
			})
		})

		expect(btc).toHaveBeenCalledWith({ time: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 })
		expect(btcAlso).toHaveBeenCalledTimes(1)
		expect(eth).not.toHaveBeenCalled()
	})

	test('reconnects with a fresh ticket and re-subscribes every live listener', async () => {
		vi.useFakeTimers()
		try {
			subscribeTerminalBars('guid-a', 'BTC', '60', () => {})
			subscribeTerminalBars('guid-b', 'ETH', '240', () => {})
			await vi.advanceTimersByTimeAsync(0)
			FakeSocket.instances[0].open()

			FakeSocket.instances[0].close()
			await vi.advanceTimersByTimeAsync(1000)
			await vi.advanceTimersByTimeAsync(0)

			expect(FakeSocket.instances).toHaveLength(2)
			const reconnected = FakeSocket.instances[1]
			expect(reconnected.url).toContain('ticket=ticket-2')

			reconnected.open()
			expect(ops(reconnected).sort()).toEqual(['sub:BTC:60', 'sub:ETH:240'])
		} finally {
			vi.useRealTimers()
		}
	})
})

const statsFrame = (symbol: string, markPx: number) => ({
	data: JSON.stringify({ type: 'stats', symbol, stats: { symbol, markPx } })
})
const candleFrame = (symbol: string, resolution: string) => ({
	data: JSON.stringify({
		type: 'candle',
		symbol,
		resolution,
		bar: { timestamp: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }
	})
})

describe('terminal socket market stats', () => {
	test('a stats listener rides the chart socket and only hears stats for its own symbol', async () => {
		const stats = vi.fn()
		const bars = vi.fn()
		subscribeTerminalStats('strip', 'HYPE', stats)
		subscribeTerminalBars('guid-a', 'HYPE', '60', bars)
		await flush()
		expect(FakeSocket.instances).toHaveLength(1)
		const socket = FakeSocket.instances[0]
		socket.open()
		expect(socket.sent).toEqual([
			{ op: 'sub', channel: 'stats', symbol: 'HYPE' },
			{ op: 'sub', symbol: 'HYPE', resolution: '60' }
		])

		socket.emit('message', statsFrame('HYPE', 94.05))
		socket.emit('message', statsFrame('BTC', 80_000))
		socket.emit('message', candleFrame('HYPE', '60'))

		expect(stats.mock.calls).toEqual([[{ symbol: 'HYPE', markPx: 94.05 }]])
		expect(bars).toHaveBeenCalledTimes(1)
	})

	test('the stats subscription is re-sent after the socket reconnects', async () => {
		vi.useFakeTimers()
		try {
			subscribeTerminalStats('strip', 'HYPE', () => {})
			await vi.advanceTimersByTimeAsync(0)
			FakeSocket.instances[0].open()
			FakeSocket.instances[0].close()
			await vi.advanceTimersByTimeAsync(1000)
			await vi.advanceTimersByTimeAsync(0)

			const reconnected = FakeSocket.instances[1]
			reconnected.open()
			expect(reconnected.sent).toEqual([{ op: 'sub', channel: 'stats', symbol: 'HYPE' }])
		} finally {
			vi.useRealTimers()
		}
	})

	test('tearing down the chart releases its bars but keeps the strip streaming on the same socket', async () => {
		const stats = vi.fn()
		subscribeTerminalStats('strip', 'HYPE', stats)
		subscribeTerminalBars('guid-a', 'HYPE', '60', () => {})
		await flush()
		const socket = FakeSocket.instances[0]
		socket.open()
		socket.sent.length = 0

		releaseTerminalBars()

		expect(socket.sent).toEqual([{ op: 'unsub', symbol: 'HYPE', resolution: '60' }])
		expect(socket.readyState).toBe(1)
		socket.emit('message', statsFrame('HYPE', 95))
		expect(stats).toHaveBeenCalledWith({ symbol: 'HYPE', markPx: 95 })

		subscribeTerminalBars('guid-b', 'HYPE', '60', () => {})
		expect(FakeSocket.instances).toHaveLength(1)
		expect(socket.sent.at(-1)).toEqual({ op: 'sub', symbol: 'HYPE', resolution: '60' })
	})

	test('a listener moving to another symbol in one step keeps the socket, so no new ticket or handshake', async () => {
		subscribeTerminalStats('strip', 'HYPE', () => {})
		await flush()
		const socket = FakeSocket.instances[0]
		socket.open()
		socket.sent.length = 0

		unsubscribeTerminalListener('strip')
		subscribeTerminalStats('strip', 'BTC', () => {})
		await flush()

		expect(FakeSocket.instances).toHaveLength(1)
		expect(socket.readyState).toBe(1)
		expect(socket.sent).toEqual([
			{ op: 'unsub', channel: 'stats', symbol: 'HYPE' },
			{ op: 'sub', channel: 'stats', symbol: 'BTC' }
		])
	})

	test('once the chart and strip are both gone the socket closes', async () => {
		subscribeTerminalStats('strip', 'HYPE', () => {})
		subscribeTerminalBars('guid-a', 'HYPE', '60', () => {})
		await flush()
		const socket = FakeSocket.instances[0]
		socket.open()

		releaseTerminalBars()
		unsubscribeTerminalListener('strip')
		await flush()

		expect(socket.readyState).toBe(3)
		expect(socket.sent.at(-1)).toEqual({ op: 'unsub', channel: 'stats', symbol: 'HYPE' })
	})
})

test('the ticket request carries the signed-in token, so a strip that subscribes first still connects', async () => {
	subscribeTerminalStats('strip', 'HYPE', () => {})
	await flush()
	expect(FakeSocket.instances[0].url).toContain('ticket=ticket-1')
})

test('a socket that goes silent is replaced, while one that keeps hearing the heartbeat is kept', async () => {
	vi.useFakeTimers()
	try {
		subscribeTerminalStats('strip', 'HYPE', () => {})
		await vi.advanceTimersByTimeAsync(0)
		const first = FakeSocket.instances[0]
		first.open()

		await vi.advanceTimersByTimeAsync(50_000)
		first.emit('message', { data: JSON.stringify({ type: 'heartbeat' }) })
		await vi.advanceTimersByTimeAsync(50_000)
		expect(FakeSocket.instances).toHaveLength(1)

		await vi.advanceTimersByTimeAsync(11_000)
		expect(first.readyState).toBe(3)
		expect(FakeSocket.instances).toHaveLength(2)
		const second = FakeSocket.instances[1]
		second.open()
		expect(second.sent).toEqual([{ op: 'sub', channel: 'stats', symbol: 'HYPE' }])
	} finally {
		vi.useRealTimers()
	}
})

test('signing in while the terminal is open connects without waiting for another subscription', async () => {
	pb.authStore.clear()
	subscribeTerminalStats('strip', 'HYPE', () => {})
	await flush()
	expect(fetchCalls).toBe(0)
	expect(FakeSocket.instances).toHaveLength(0)

	pb.authStore.save(TOKEN, null)
	await flush()
	expect(FakeSocket.instances).toHaveLength(1)
})

test('signing out closes the active socket before its old account can receive more data', async () => {
	const onStats = vi.fn()
	subscribeTerminalStats('strip', 'HYPE', onStats)
	await flush()
	const active = FakeSocket.instances[0]
	active.open()

	pb.authStore.clear()
	expect(active.readyState).toBe(3)
	active.emit('message', { data: JSON.stringify({ type: 'stats', symbol: 'HYPE', stats: { markPx: 1 } }) })
	expect(onStats).not.toHaveBeenCalled()
})

test('refreshing a token for the same user keeps the active socket and its subscriptions', async () => {
	const record = { id: 'user', collectionId: '_pb_users_auth_', collectionName: 'users' }
	const refreshedToken = `e30.${btoa(JSON.stringify({ id: 'user', exp: 4_102_444_801 }))}.signature`
	pb.authStore.save(TOKEN, record)
	const onStats = vi.fn()
	subscribeTerminalStats('strip', 'HYPE', onStats)
	await flush()
	const active = FakeSocket.instances[0]
	active.open()
	const requestsBeforeRefresh = ticketRequests

	pb.authStore.save(refreshedToken, record)
	await flush()
	active.emit('message', { data: JSON.stringify({ type: 'stats', symbol: 'HYPE', stats: { markPx: 1 } }) })

	expect(active.readyState).toBe(1)
	expect(FakeSocket.instances).toHaveLength(1)
	expect(ticketRequests).toBe(requestsBeforeRefresh)
	expect(onStats).toHaveBeenCalledWith({ markPx: 1 })
})

test('an old ticket response cannot open a socket after the account changes', async () => {
	const nextToken = `e30.${btoa(JSON.stringify({ id: 'next-user', exp: 4_102_444_800 }))}.signature`
	let resolveOldTicket: (response: Response) => void = () => {}
	const oldTicket = new Promise<Response>((resolve) => {
		resolveOldTicket = resolve
	})
	vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
		const token = new Headers(init?.headers).get('Authorization')
		return token === `Bearer ${TOKEN}` ? oldTicket : Promise.resolve(Response.json({ ticket: 'new-ticket' }))
	})

	subscribeTerminalStats('strip', 'HYPE', () => {})
	pb.authStore.save(nextToken, null)
	resolveOldTicket(Response.json({ ticket: 'old-ticket' }))
	await flush()

	expect(FakeSocket.instances).toHaveLength(1)
	expect(FakeSocket.instances[0].url).toContain('ticket=new-ticket')
})
