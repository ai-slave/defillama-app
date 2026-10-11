import { useEffect, useMemo, useState } from 'react'
import { Select } from '~/components/Select/Select'
import { VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import { Card } from '~/ui/Card'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatusDot } from '~/ui/StatusBadge'
import { formatUsd, formatCompactNumber, formatNumber, formatPercent } from '~/utils/numberFormat'
import {
	pushBounded,
	useHyperliquidL2Book,
	useHyperliquidPerps,
	useHyperliquidWsChannels,
	type HyperliquidWsBookLevel,
	type WsSubscription
} from './api'

interface Trade {
	coin: string
	side: 'B' | 'A' | 'S'
	px: number
	sz: number
	time: number
	tid: number
}

interface BookLevel {
	px: number
	sz: number
	n: number
}

const BOOK_LEVELS = 15
const MAX_TRADES = 300
const SIG_FIG_OPTIONS = ['2', '3', '4', '5']

function formatTime(ts: number) {
	const d = new Date(ts)
	return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function toBookLevel(level: { px: string | number; sz: string | number; n: number }): BookLevel {
	return {
		px: Number(level.px) || 0,
		sz: Number(level.sz) || 0,
		n: Number(level.n) || 0
	}
}

function LiveOrderBook({ bids, asks }: { bids: Array<BookLevel>; asks: Array<BookLevel> }) {
	const topBids = bids.slice(0, BOOK_LEVELS)
	const topAsks = asks.slice(0, BOOK_LEVELS)

	const maxSize = useMemo(() => {
		const allSizes = [...topBids, ...topAsks].map((level) => level.sz)
		return Math.max(...allSizes, 1)
	}, [topBids, topAsks])

	const bestBid = topBids[0]?.px ?? 0
	const bestAsk = topAsks[0]?.px ?? 0
	const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0
	const spread = bestBid && bestAsk && midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 100 : 0

	const reversedAsks = [...topAsks].reverse()

	return (
		<Card padding="md" className="flex flex-col">
			<h3 className="mb-3 label-md text-secondary">Order book</h3>

			<div className="mb-2 grid grid-cols-3 label-sm text-secondary">
				<span>Price</span>
				<span className="text-right">Size</span>
				<span className="text-right">Orders</span>
			</div>

			<div className="flex flex-col body-sm tabular-nums">
				{reversedAsks.map((level) => {
					const pct = (level.sz / maxSize) * 100
					return (
						<div key={`a-${level.px}`} className="relative grid grid-cols-3 py-0.75">
							<div className="absolute inset-y-0 right-0 bg-error-tint" style={{ width: `${pct}%` }} />
							<span className="relative text-error">{formatNumber(level.px)}</span>
							<span className="relative text-right text-primary">
								{formatCompactNumber(level.sz, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							</span>
							<span className="relative text-right text-secondary">{level.n}</span>
						</div>
					)
				})}

				{midPrice > 0 && (
					<div className="my-1 flex items-center justify-center gap-2 border-y border-subtle py-2">
						<span className="title-md text-primary">
							{formatUsd(midPrice, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</span>
						<span className="body-xs text-secondary">
							Spread:{' '}
							{formatPercent(spread, {
								input: 'percent',
								minimumFractionDigits: 4,
								maximumFractionDigits: 4,
								useGrouping: false
							})}
						</span>
					</div>
				)}

				{topBids.map((level) => {
					const pct = (level.sz / maxSize) * 100
					return (
						<div key={`b-${level.px}`} className="relative grid grid-cols-3 py-0.75">
							<div className="absolute inset-y-0 right-0 bg-success-tint" style={{ width: `${pct}%` }} />
							<span className="relative text-success">{formatNumber(level.px)}</span>
							<span className="relative text-right text-primary">
								{formatCompactNumber(level.sz, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							</span>
							<span className="relative text-right text-secondary">{level.n}</span>
						</div>
					)
				})}
			</div>

			{bids.length === 0 && asks.length === 0 ? (
				<SurfaceBodyLoadingStatus label="Waiting for order book data" className="min-h-[100px]" />
			) : null}
		</Card>
	)
}

function LiveTradeFeed({ trades }: { trades: Array<Trade> }) {
	return (
		<Card padding="md" className="flex max-h-[800px] flex-col">
			<h3 className="mb-3 shrink-0 label-md text-secondary">Recent trades</h3>

			<div className="mb-2 grid shrink-0 grid-cols-4 label-sm text-secondary">
				<span>Time</span>
				<span className="text-right">Price</span>
				<span className="text-right">Size</span>
				<span className="text-right">Side</span>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto body-sm tabular-nums">
				{trades.map((trade) => {
					const isBuy = trade.side === 'B'
					return (
						<div
							key={`${trade.tid}-${trade.time}`}
							className={`grid grid-cols-4 py-0.75 ${isBuy ? 'text-success' : 'text-error'}`}
						>
							<span className="text-secondary">{formatTime(trade.time)}</span>
							<span className="text-right">{formatNumber(trade.px)}</span>
							<span className="text-right">
								{formatCompactNumber(trade.sz, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							</span>
							<span className="text-right font-medium">{isBuy ? 'Buy' : 'Sell'}</span>
						</div>
					)
				})}
				{trades.length === 0 ? <SurfaceBodyLoadingStatus label="Waiting for trades" className="min-h-[100px]" /> : null}
			</div>
		</Card>
	)
}

function MetricStrip({
	spreadPct,
	buyRatio1m,
	buyRatio5m,
	cvd5m,
	depth025,
	depth1
}: {
	spreadPct: number
	buyRatio1m: number
	buyRatio5m: number
	cvd5m: number
	depth025: number
	depth1: number
}) {
	return (
		<Card padding="strip" className="grid grid-cols-2 gap-3 md:grid-cols-6">
			<div>
				<div className="body-sm text-secondary">Spread</div>
				<div className="body-md text-primary">
					{formatPercent(spreadPct, {
						input: 'percent',
						minimumFractionDigits: 4,
						maximumFractionDigits: 4,
						useGrouping: false
					})}
				</div>
			</div>
			<div>
				<div className="body-sm text-secondary">Buy Ratio 1m</div>
				<div className="body-md text-primary">
					{formatPercent(buyRatio1m, {
						input: 'fraction',
						minimumFractionDigits: 1,
						maximumFractionDigits: 1,
						useGrouping: false
					})}
				</div>
			</div>
			<div>
				<div className="body-sm text-secondary">Buy Ratio 5m</div>
				<div className="body-md text-primary">
					{formatPercent(buyRatio5m, {
						input: 'fraction',
						minimumFractionDigits: 1,
						maximumFractionDigits: 1,
						useGrouping: false
					})}
				</div>
			</div>
			<div>
				<div className="body-sm text-secondary">CVD 5m</div>
				<div className={cvd5m >= 0 ? 'body-md text-success' : 'body-md text-error'}>
					{formatCompactNumber(cvd5m, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</div>
			</div>
			<div>
				<div className="body-sm text-secondary">Depth ±0.25%</div>
				<div className="body-md text-primary">
					{formatUsd(depth025, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</div>
			</div>
			<div>
				<div className="body-sm text-secondary">Depth ±1%</div>
				<div className="body-md text-primary">
					{formatUsd(depth1, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</div>
			</div>
		</Card>
	)
}

export default function Trades() {
	const { markets } = useHyperliquidPerps()
	const [coin, setCoin] = useState('BTC')
	const [nSigFigs, setNSigFigs] = useState(5)
	const [trades, setTrades] = useState<Array<Trade>>([])
	const [book, setBook] = useState<{ bids: Array<BookLevel>; asks: Array<BookLevel> }>({ bids: [], asks: [] })
	const [now, setNow] = useState(() => Date.now())

	const { book: snapshotBook } = useHyperliquidL2Book(coin, nSigFigs)

	const coinOptions = useMemo(
		() =>
			(markets.length > 0
				? markets.toSorted((a, b) => b.dayNtlVlm - a.dayNtlVlm).map((market) => market.name)
				: ['BTC', 'ETH', 'SOL']
			).map((name) => ({ value: name, label: name })),
		[markets]
	)

	// A different market or precision starts with an empty tape and book.
	const marketKey = `${coin}|${nSigFigs}`
	const [syncedMarketKey, setSyncedMarketKey] = useState(marketKey)
	if (marketKey !== syncedMarketKey) {
		setSyncedMarketKey(marketKey)
		setTrades([])
		setBook({ bids: [], asks: [] })
	}
	// The REST snapshot seeds the book once per snapshot; websocket updates then replace it.
	const [syncedSnapshot, setSyncedSnapshot] = useState<typeof snapshotBook>(null)
	if (snapshotBook !== syncedSnapshot) {
		setSyncedSnapshot(snapshotBook)
		if (snapshotBook) setBook({ bids: snapshotBook.levels[0], asks: snapshotBook.levels[1] })
	}

	const subs: Array<WsSubscription> = useMemo(
		() => [
			{ type: 'trades', coin },
			{ type: 'l2Book', coin, nSigFigs }
		],
		[coin, nSigFigs]
	)

	const { isConnected } = useHyperliquidWsChannels(subs, {
		trades: (message) => {
			const incoming = message.data ?? []
			if (!Array.isArray(incoming) || incoming.length === 0) return
			const mapped = incoming.map((trade) => ({
				coin: trade.coin,
				side: trade.side,
				px: Number(trade.px) || 0,
				sz: Number(trade.sz) || 0,
				time: trade.time,
				tid: trade.tid
			}))
			setTrades((prev) => pushBounded(prev, mapped, MAX_TRADES))
		},
		l2Book: (message) => {
			const levels: [Array<HyperliquidWsBookLevel>, Array<HyperliquidWsBookLevel>] | undefined = message.data?.levels
			if (!levels) return
			setBook({
				bids: (levels[0] ?? []).map(toBookLevel),
				asks: (levels[1] ?? []).map(toBookLevel)
			})
		}
	})

	// The 1m and 5m windows move with the clock while the tape has trades. Keyed on the trade count, a trade
	// at least every second restarted the timer before it fired, so the windows stopped moving.
	const hasTrades = trades.length > 0
	useEffect(() => {
		if (!hasTrades) return
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [hasTrades])

	const metrics = useMemo(() => {
		const bestBid = book.bids[0]?.px ?? 0
		const bestAsk = book.asks[0]?.px ?? 0
		const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0
		const spreadPct = bestBid && bestAsk && mid > 0 ? ((bestAsk - bestBid) / mid) * 100 : 0

		const oneMinute = now - 60_000
		const fiveMinute = now - 5 * 60_000

		let buy1m = 0
		let sell1m = 0
		let buy5m = 0
		let sell5m = 0
		for (const trade of trades) {
			if (trade.time >= oneMinute) {
				if (trade.side === 'B') buy1m += trade.sz
				else sell1m += trade.sz
			}
			if (trade.time >= fiveMinute) {
				if (trade.side === 'B') buy5m += trade.sz
				else sell5m += trade.sz
			}
		}

		const buyRatio1m = buy1m + sell1m > 0 ? buy1m / (buy1m + sell1m) : 0
		const buyRatio5m = buy5m + sell5m > 0 ? buy5m / (buy5m + sell5m) : 0
		const cvd5m = buy5m - sell5m

		const depth = (bandPct: number) => {
			if (!mid) return 0
			const lower = mid * (1 - bandPct)
			const upper = mid * (1 + bandPct)
			const bidNotional = book.bids
				.filter((level) => level.px >= lower)
				.reduce((sum, level) => sum + level.px * level.sz, 0)
			const askNotional = book.asks
				.filter((level) => level.px <= upper)
				.reduce((sum, level) => sum + level.px * level.sz, 0)
			return bidNotional + askNotional
		}

		return {
			spreadPct,
			buyRatio1m,
			buyRatio5m,
			cvd5m,
			depth025: depth(0.0025),
			depth1: depth(0.01)
		}
	}, [book.asks, book.bids, now, trades])

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<VirtualizedSelect
					variant="chip"
					label="Market"
					options={coinOptions}
					selectedValue={coin}
					placeholder="Select market…"
					onChange={(option) => setCoin(option.value)}
				/>

				<Select
					label="Depth nSigFigs"
					allValues={SIG_FIG_OPTIONS}
					selectedValues={String(nSigFigs)}
					setSelectedValues={(value) => setNSigFigs(Number(value))}
					variant="filter"
					size="md"
				/>

				<div className="ml-auto flex items-center gap-1.5">
					<StatusDot status={isConnected ? 'good' : 'bad'} />
					<span className="body-sm text-secondary">{isConnected ? 'Connected' : 'Reconnecting…'}</span>
				</div>
			</div>

			<MetricStrip {...metrics} />

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<LiveOrderBook bids={book.bids} asks={book.asks} />
				<LiveTradeFeed trades={trades.slice(0, 120)} />
			</div>
		</div>
	)
}
