import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { HyperliquidCandle } from '~/pages/api/public/hyperliquid/candles'
import type { HlpFundingData } from '~/pages/api/public/hyperliquid/hlp-funding'
import type { HlpOpenOrder } from '~/pages/api/public/hyperliquid/hlp-open-orders'
import type { HlpPortfolioData } from '~/pages/api/public/hyperliquid/hlp-portfolio'
import type { HlpData, HlpFill, HlpPosition } from '~/pages/api/public/hyperliquid/hlp-positions'
import type { HyperliquidL2Book } from '~/pages/api/public/hyperliquid/l2-book'
import type { PerpMarket } from '~/pages/api/public/hyperliquid/perps'
import type { PredictedFunding } from '~/pages/api/public/hyperliquid/predicted-fundings'
import type { SpotMarket } from '~/pages/api/public/hyperliquid/spot'
import { readInvestorApiJson, type ApiUnixMilliseconds } from '../../api.types'

const HL_WS = 'wss://api.hyperliquid.xyz/ws'
const HEARTBEAT_TIMEOUT_MS = 20_000
const HEARTBEAT_CHECK_MS = 5000

export interface WsSubscription {
	type: string
	coin?: string
	interval?: string
	user?: string
	nSigFigs?: number
	mantissa?: number | null
}

export interface HyperliquidWsTrade {
	coin: string
	side: 'B' | 'A' | 'S'
	px: string
	sz: string
	// Hyperliquid websocket timestamps are Unix milliseconds.
	time: ApiUnixMilliseconds
	tid: number
}

export interface HyperliquidWsBookLevel {
	px: string
	sz: string
	n: number
}

interface HyperliquidWsDataMap {
	allMids: { mids: Record<string, string> }
	trades: Array<HyperliquidWsTrade>
	l2Book: {
		coin: string
		time: ApiUnixMilliseconds
		levels: [Array<HyperliquidWsBookLevel>, Array<HyperliquidWsBookLevel>]
	}
}

export type HyperliquidWsMessage<K extends keyof HyperliquidWsDataMap = keyof HyperliquidWsDataMap> =
	K extends keyof HyperliquidWsDataMap
		? {
				channel: K
				data?: HyperliquidWsDataMap[K]
				isSnapshot?: boolean
			}
		: never

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function isBookLevel(value: unknown): value is HyperliquidWsBookLevel {
	return isRecord(value) && typeof value.px === 'string' && typeof value.sz === 'string' && typeof value.n === 'number'
}

function isTrade(value: unknown): value is HyperliquidWsTrade {
	return (
		isRecord(value) &&
		typeof value.coin === 'string' &&
		(value.side === 'B' || value.side === 'A' || value.side === 'S') &&
		typeof value.px === 'string' &&
		typeof value.sz === 'string' &&
		typeof value.time === 'number' &&
		typeof value.tid === 'number'
	)
}

/** Validate the channel discriminator and its corresponding websocket payload before dispatch. */
export function parseHyperliquidWsMessage(value: unknown): HyperliquidWsMessage | null {
	if (!isRecord(value) || typeof value.channel !== 'string') return null
	const isSnapshot = typeof value.isSnapshot === 'boolean' ? value.isSnapshot : undefined

	if (value.channel === 'allMids') {
		if (!isRecord(value.data) || !isRecord(value.data.mids)) return null
		if (!Object.values(value.data.mids).every((mid) => typeof mid === 'string')) return null
		return { channel: 'allMids', data: { mids: value.data.mids as Record<string, string> }, isSnapshot }
	}
	if (value.channel === 'trades') {
		if (!Array.isArray(value.data) || !value.data.every(isTrade)) return null
		return { channel: 'trades', data: value.data, isSnapshot }
	}
	if (value.channel === 'l2Book') {
		if (
			!isRecord(value.data) ||
			typeof value.data.coin !== 'string' ||
			typeof value.data.time !== 'number' ||
			!Array.isArray(value.data.levels) ||
			value.data.levels.length !== 2 ||
			!value.data.levels.every((side) => Array.isArray(side) && side.every(isBookLevel))
		) {
			return null
		}
		return {
			channel: 'l2Book',
			data: {
				coin: value.data.coin,
				time: value.data.time,
				levels: value.data.levels as [Array<HyperliquidWsBookLevel>, Array<HyperliquidWsBookLevel>]
			},
			isSnapshot
		}
	}
	return null
}

function subscriptionKey(subscription: WsSubscription) {
	const sortedEntries = Object.entries(subscription).sort(([a], [b]) => a.localeCompare(b))
	return JSON.stringify(sortedEntries)
}

function toSubscriptionMap(subscriptions: Array<WsSubscription>) {
	return new Map(subscriptions.map((sub) => [subscriptionKey(sub), sub]))
}

export function pushBounded<T>(prev: Array<T>, incoming: Array<T> | T, limit: number): Array<T> {
	const next = Array.isArray(incoming) ? [...incoming, ...prev] : [incoming, ...prev]
	return next.length <= limit ? next : next.slice(0, limit)
}

export function useHyperliquidWs(subscriptions: Array<WsSubscription>, onMessage: (msg: unknown) => void) {
	const [isConnected, setIsConnected] = useState(false)
	const wsRef = useRef<WebSocket | null>(null)
	const subsRef = useRef(subscriptions)
	const cbRef = useRef(onMessage)
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const lastMessageAtRef = useRef<number>(0)
	const backoffRef = useRef(1000)
	const mountedRef = useRef(true)
	const prevSubsRef = useRef<Map<string, WsSubscription>>(new Map())

	// Read by the socket's reconnect and message handlers, which run outside render.
	useLayoutEffect(() => {
		subsRef.current = subscriptions
		cbRef.current = onMessage
	})

	const sendMessage = useCallback((ws: WebSocket, method: 'subscribe' | 'unsubscribe', sub: WsSubscription) => {
		if (ws.readyState !== WebSocket.OPEN) return
		ws.send(JSON.stringify({ method, subscription: sub }))
	}, [])

	const syncSubscriptions = useCallback(
		(ws: WebSocket, nextSubs: Array<WsSubscription>) => {
			const prevMap = prevSubsRef.current
			const nextMap = toSubscriptionMap(nextSubs)

			for (const [key, sub] of prevMap) {
				if (!nextMap.has(key)) sendMessage(ws, 'unsubscribe', sub)
			}
			for (const [key, sub] of nextMap) {
				if (!prevMap.has(key)) sendMessage(ws, 'subscribe', sub)
			}

			prevSubsRef.current = nextMap
		},
		[sendMessage]
	)

	const clearTimers = useCallback(() => {
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current)
			reconnectTimerRef.current = null
		}
		if (heartbeatTimerRef.current) {
			clearInterval(heartbeatTimerRef.current)
			heartbeatTimerRef.current = null
		}
	}, [])

	useEffect(() => {
		mountedRef.current = true

		// A function declaration so the reconnect timer can call it by name.
		function connect() {
			if (!mountedRef.current) return
			if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return

			prevSubsRef.current = new Map()
			const ws = new WebSocket(HL_WS)
			wsRef.current = ws
			lastMessageAtRef.current = Date.now()

			ws.onopen = () => {
				if (!mountedRef.current) {
					ws.close()
					return
				}
				setIsConnected(true)
				backoffRef.current = 1000
				syncSubscriptions(ws, subsRef.current)

				heartbeatTimerRef.current = setInterval(() => {
					if (!mountedRef.current || ws.readyState !== WebSocket.OPEN) return
					if (Date.now() - lastMessageAtRef.current > HEARTBEAT_TIMEOUT_MS) {
						ws.close()
					}
				}, HEARTBEAT_CHECK_MS)
			}

			ws.onmessage = (event) => {
				lastMessageAtRef.current = Date.now()
				try {
					const message: unknown = JSON.parse(event.data)
					if (isRecord(message) && message.channel === 'subscriptionResponse') return
					cbRef.current(message)
				} catch {
					// ignore non-json frames
				}
			}

			ws.onclose = () => {
				clearTimers()
				if (!mountedRef.current) return
				setIsConnected(false)
				const jitter = 0.8 + Math.random() * 0.4
				const waitMs = Math.floor(backoffRef.current * jitter)
				reconnectTimerRef.current = setTimeout(() => {
					backoffRef.current = Math.min(backoffRef.current * 2, 15_000)
					connect()
				}, waitMs)
			}

			ws.onerror = () => {
				ws.close()
			}
		}

		connect()
		return () => {
			mountedRef.current = false
			clearTimers()
			if (wsRef.current) {
				wsRef.current.onclose = null
				wsRef.current.close()
				wsRef.current = null
			}
		}
	}, [clearTimers, syncSubscriptions])

	useEffect(() => {
		const ws = wsRef.current
		if (!ws || ws.readyState !== WebSocket.OPEN) return
		syncSubscriptions(ws, subscriptions)
	}, [subscriptions, syncSubscriptions])

	return { isConnected }
}

export function useHyperliquidWsChannels(
	subscriptions: Array<WsSubscription>,
	handlers: Partial<{
		[K in keyof HyperliquidWsDataMap]: (message: HyperliquidWsMessage<K>) => void
	}>
) {
	const handlersRef = useRef(handlers)
	useLayoutEffect(() => {
		handlersRef.current = handlers
	})

	return useHyperliquidWs(subscriptions, (message) => {
		const parsed = parseHyperliquidWsMessage(message)
		if (!parsed) return
		const handler = handlersRef.current[parsed.channel] as ((message: HyperliquidWsMessage) => void) | undefined
		handler?.(parsed)
	})
}

export type {
	HyperliquidCandle,
	HyperliquidL2Book,
	HlpData,
	HlpFill,
	HlpFundingData,
	HlpOpenOrder,
	HlpPortfolioData,
	HlpPosition,
	PerpMarket,
	PredictedFunding,
	SpotMarket
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`API ${response.status}`)
	return readInvestorApiJson<T>(response)
}

export function useHyperliquidPerps() {
	const query = useQuery<Array<PerpMarket>>({
		queryKey: ['hl-perps'],
		queryFn: () => fetchJson<Array<PerpMarket>>('/api/public/hyperliquid/perps'),
		staleTime: 60_000,
		refetchOnWindowFocus: false
	})

	return { ...query, markets: query.data ?? [] }
}

export function useHyperliquidSpot() {
	const query = useQuery<Array<SpotMarket>>({
		queryKey: ['hl-spot'],
		queryFn: () => fetchJson<Array<SpotMarket>>('/api/public/hyperliquid/spot'),
		staleTime: 60_000,
		refetchOnWindowFocus: false
	})

	return { ...query, markets: query.data ?? [] }
}

export function useHyperliquidPredictedFundings() {
	const query = useQuery<Array<PredictedFunding>>({
		queryKey: ['hl-predicted-fundings'],
		queryFn: () => fetchJson<Array<PredictedFunding>>('/api/public/hyperliquid/predicted-fundings'),
		staleTime: 60_000,
		refetchOnWindowFocus: false
	})

	return { ...query, fundings: query.data ?? [] }
}

export function useHyperliquidL2Book(coin: string, nSigFigs = 5) {
	const query = useQuery<HyperliquidL2Book>({
		queryKey: ['hl-l2-book', coin, nSigFigs],
		queryFn: () =>
			fetchJson<HyperliquidL2Book>(
				`/api/public/hyperliquid/l2-book?coin=${encodeURIComponent(coin)}&nSigFigs=${nSigFigs}`
			),
		staleTime: 10_000,
		refetchOnWindowFocus: false
	})

	return { ...query, book: query.data ?? null }
}
const DEFAULT_HLP_DATA = {
	summary: {
		accountValue: 0,
		totalNtlPos: 0,
		totalMarginUsed: 0,
		positionCount: 0,
		withdrawable: 0,
		crossMaintenanceMarginUsed: 0,
		snapshotTime: null
	},
	positions: [],
	recentFills: []
}

export function useHyperliquidHlpPositions() {
	const query = useQuery<HlpData>({
		queryKey: ['hl-hlp-positions'],
		queryFn: () => fetchJson<HlpData>('/api/public/hyperliquid/hlp-positions'),
		staleTime: 30_000,
		refetchInterval: 30_000,
		refetchOnWindowFocus: false
	})

	return { ...query, hlpData: query.data ?? DEFAULT_HLP_DATA }
}

export function useHyperliquidHlpOpenOrders() {
	const query = useQuery<Array<HlpOpenOrder>>({
		queryKey: ['hl-hlp-open-orders'],
		queryFn: () => fetchJson<Array<HlpOpenOrder>>('/api/public/hyperliquid/hlp-open-orders'),
		staleTime: 30_000,
		refetchInterval: 30_000,
		refetchOnWindowFocus: false
	})

	return { ...query, openOrders: query.data ?? [] }
}

export function useHyperliquidHlpFunding(window: '24h' | '7d' | '30d') {
	const query = useQuery<HlpFundingData>({
		queryKey: ['hl-hlp-funding', window],
		queryFn: () => fetchJson<HlpFundingData>(`/api/public/hyperliquid/hlp-funding?window=${window}`),
		staleTime: 30_000,
		refetchInterval: 30_000,
		refetchOnWindowFocus: false
	})

	return {
		...query,
		funding: query.data ?? { window, totalUsdc: 0, byVault: { A: 0, B: 0 }, events: [] }
	}
}

export function useHyperliquidHlpPortfolio(window: 'day' | 'week' | 'month' | 'allTime') {
	const query = useQuery<HlpPortfolioData>({
		queryKey: ['hl-hlp-portfolio', window],
		queryFn: () => fetchJson<HlpPortfolioData>(`/api/public/hyperliquid/hlp-portfolio?window=${window}`),
		staleTime: 30_000,
		refetchInterval: 60_000,
		refetchOnWindowFocus: false
	})

	return {
		...query,
		portfolio: query.data ?? { window, volume: 0, points: [], byVaultVolume: { A: 0, B: 0 } }
	}
}
