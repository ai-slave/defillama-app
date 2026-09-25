import { AI_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'

export interface TerminalBar {
	time: number
	open: number
	high: number
	low: number
	close: number
	volume: number
}

export interface TerminalLiveStats {
	symbol: string
	markPx: number
	oraclePx: number
	prevDayPx: number
	dayChangePct: number
	dayNtlVlm: number
	openInterest: number
	funding: number
	fundingAprPct: number
}

interface TerminalListener {
	key: string
	channel: 'bars' | 'stats'
	subscription: Record<string, string>
	onPayload: (payload: any) => void
}

const TICKET_URL = `${AI_SERVER}/terminal/ws-ticket`
const SOCKET_URL = `${AI_SERVER.replace(/^http/, 'ws')}/terminal/ws`
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10_000, 30_000]
const STALE_AFTER_MS = 60_000

const listeners = new Map<string, TerminalListener>()

let socket: WebSocket | null = null
let isConnecting = false
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let staleTimer: ReturnType<typeof setTimeout> | null = null
const currentSession = () => (pb.authStore.isValid ? (pb.authStore.record?.id ?? pb.authStore.token) : null)
let authSession = currentSession()
let sessionVersion = 0

const barsKey = (symbol: string, resolution: string) => JSON.stringify(['bars', symbol, resolution])
const statsKey = (symbol: string) => JSON.stringify(['stats', symbol])

const hasKey = (key: string) => {
	for (const listener of listeners.values()) if (listener.key === key) return true
	return false
}

const send = (op: 'sub' | 'unsub', listener: TerminalListener) => {
	if (socket?.readyState !== WebSocket.OPEN) return
	socket.send(JSON.stringify({ op, ...listener.subscription }))
}

function scheduleReconnect() {
	if (reconnectTimer || listeners.size === 0) return
	const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
	reconnectAttempt += 1
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null
		void connect()
	}, delay)
}

function clearStale() {
	if (staleTimer) clearTimeout(staleTimer)
	staleTimer = null
}

function armStale(current: WebSocket) {
	clearStale()
	staleTimer = setTimeout(() => drop(current), STALE_AFTER_MS)
}

function drop(current: WebSocket) {
	if (socket !== current) return
	socket = null
	clearStale()
	current.close()
	scheduleReconnect()
}

async function connect() {
	if (socket || isConnecting || listeners.size === 0 || !pb.authStore.isValid) return
	isConnecting = true
	const token = pb.authStore.token
	const version = sessionVersion
	try {
		const response = await fetch(TICKET_URL, { headers: { Authorization: `Bearer ${token}` } })
		if (!response.ok) throw new Error(`Terminal ticket ${response.status}`)
		const { ticket } = (await response.json()) as { ticket: string }
		if (listeners.size === 0 || version !== sessionVersion || !pb.authStore.isValid) return

		const next = new WebSocket(`${SOCKET_URL}?ticket=${encodeURIComponent(ticket)}`)
		socket = next
		armStale(next)

		next.addEventListener('open', () => {
			if (socket !== next) return
			reconnectAttempt = 0
			const sent = new Set<string>()
			for (const listener of listeners.values()) {
				if (sent.has(listener.key)) continue
				sent.add(listener.key)
				send('sub', listener)
			}
		})

		next.addEventListener('message', (event) => {
			if (socket !== next) return
			armStale(next)
			let payload: { type?: string; symbol?: string; resolution?: string; bar?: unknown; stats?: unknown }
			try {
				payload = JSON.parse(event.data)
			} catch {
				return
			}
			let key: string
			let data: unknown
			if (payload.type === 'candle' && payload.bar) {
				key = barsKey(String(payload.symbol), String(payload.resolution))
				data = payload.bar
			} else if (payload.type === 'stats' && payload.stats) {
				key = statsKey(String(payload.symbol))
				data = payload.stats
			} else return
			for (const listener of listeners.values()) if (listener.key === key) listener.onPayload(data)
		})

		next.addEventListener('error', () => next.close())

		next.addEventListener('close', () => drop(next))
	} catch {
		if (version === sessionVersion) scheduleReconnect()
	} finally {
		isConnecting = false
		if (version !== sessionVersion) void connect()
	}
}

export function subscribeTerminalBars(
	listenerGuid: string,
	symbol: string,
	resolution: string,
	onTick: (bar: TerminalBar) => void
) {
	addListener(listenerGuid, {
		key: barsKey(symbol, resolution),
		channel: 'bars',
		subscription: { symbol, resolution },
		onPayload: (bar: Record<string, number>) =>
			onTick({
				time: bar.timestamp,
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
				volume: bar.volume
			})
	})
}

export function subscribeTerminalStats(
	listenerGuid: string,
	symbol: string,
	onStats: (stats: TerminalLiveStats) => void
) {
	addListener(listenerGuid, {
		key: statsKey(symbol),
		channel: 'stats',
		subscription: { channel: 'stats', symbol },
		onPayload: onStats
	})
}

function addListener(listenerGuid: string, listener: TerminalListener) {
	const isFirstForKey = !hasKey(listener.key)
	listeners.set(listenerGuid, listener)
	if (isFirstForKey) send('sub', listener)
	void connect()
}

function removeListener(listenerGuid: string) {
	const listener = listeners.get(listenerGuid)
	if (!listener) return
	listeners.delete(listenerGuid)
	if (!hasKey(listener.key)) send('unsub', listener)
}

const closeWhenIdle = () =>
	queueMicrotask(() => {
		if (listeners.size === 0) closeTerminalSocket()
	})

export function unsubscribeTerminalListener(listenerGuid: string) {
	removeListener(listenerGuid)
	closeWhenIdle()
}

export function releaseTerminalBars() {
	for (const [listenerGuid, listener] of listeners) if (listener.channel === 'bars') removeListener(listenerGuid)
	closeWhenIdle()
}

export function closeTerminalSocket() {
	listeners.clear()
	if (reconnectTimer) clearTimeout(reconnectTimer)
	reconnectTimer = null
	reconnectAttempt = 0
	clearStale()
	const current = socket
	socket = null
	current?.close()
}

if (typeof window !== 'undefined')
	pb.authStore.onChange(() => {
		const nextSession = currentSession()
		if (authSession !== nextSession) {
			authSession = nextSession
			sessionVersion += 1
			if (reconnectTimer) clearTimeout(reconnectTimer)
			reconnectTimer = null
			reconnectAttempt = 0
			clearStale()
			const current = socket
			socket = null
			current?.close()
		}
		void connect()
	})
