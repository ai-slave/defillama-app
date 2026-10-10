import { useQuery } from '@tanstack/react-query'
import { type RefObject, useEffect, useId, useRef, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { AI_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { focusRegionOnLeave } from '~/ui/focus'
import { Skeleton } from '~/ui/Skeleton'
import { InlineStatus } from '~/ui/Status'
import { InlineStatStrip, type InlineStatStripItem } from '~/ui/SummaryStats'
import { Tag } from '~/ui/Tag'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { subscribeTerminalStats, type TerminalLiveStats, unsubscribeTerminalListener } from './terminalSocket'

export interface TerminalStats {
	symbol: string
	markPx: number
	oraclePx?: number
	prevDayPx: number
	dayChangePct: number
	dayNtlVlm: number
	openInterest: number
	funding: number
	fundingAprPct: number
	maxLeverage: number
}

const REFRESH_MS = 15_000
const LIVE_REFRESH_MS = 60_000
const LIVE_GRACE_MS = 30_000
const HOUR_SECONDS = 3600

export async function fetchTerminalStats(symbol: string, fetchFn: typeof fetch): Promise<TerminalStats | null> {
	const res = await fetchFn(`${AI_SERVER}/terminal/stats?symbol=${encodeURIComponent(symbol)}`)
	if (res.status === 404) return null
	if (!res.ok) throw new Error(`Market stats failed with ${res.status}`)
	return res.json()
}

export function secondsToNextFunding(nowMs: number): number {
	return HOUR_SECONDS - 1 - (Math.floor(nowMs / 1000) % HOUR_SECONDS)
}

export function formatCountdown(seconds: number): string {
	const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
	const ss = String(seconds % 60).padStart(2, '0')
	return `${mm}:${ss}`
}

export function formatHourlyFunding(funding: number, aprPct: number) {
	return {
		rate: formatPercent(funding, { input: 'fraction', signDisplay: 'exceptZero', ...fixed(4) }),
		apr: `${formatPercent(aprPct, { input: 'percent', maximumFractionDigits: 1 })} APR`
	}
}

function FundingCountdown() {
	const [now, setNow] = useState<number | null>(null)
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>
		const tick = () => {
			const next = Date.now()
			setNow(next)
			timer = setTimeout(tick, 1000 - (next % 1000))
		}
		tick()
		return () => clearTimeout(timer)
	}, [])
	if (now == null) return <span className="tabular-nums">--:--</span>
	return <span className="tabular-nums">{formatCountdown(secondsToNextFunding(now))}</span>
}

const LABELS = ['Mark', 'Oracle', '24h change', '24h volume', 'Open interest', 'Funding / Countdown']

export function perpDex(symbol: string): string | null {
	const separator = symbol.indexOf(':')
	return separator > 0 ? symbol.slice(0, separator) : null
}

export function pairName(symbol: string): string {
	const dex = perpDex(symbol)
	return `${dex ? symbol.slice(dex.length + 1) : symbol}-USDC`
}

const coinIconUrl = (symbol: string) => `https://app.hyperliquid.xyz/coins/${encodeURIComponent(symbol)}.svg`

// Funding is coloured by who pays (positive: longs pay shorts), not as a movement.
const fundingClass = (value: number) => (value > 0 ? 'text-data-up' : value < 0 ? 'text-data-down' : '')

export function priceDecimals(referencePx: number): number {
	if (!Number.isFinite(referencePx) || referencePx <= 0) return 2
	return Math.min(8, Math.max(0, 4 - Math.floor(Math.log10(referencePx))))
}

const fixed = (digits: number) => ({ minimumFractionDigits: digits, maximumFractionDigits: digits })

export function formatPrice(value: number | undefined, decimals: number): string {
	return typeof value === 'number' && Number.isFinite(value) ? formatUsd(value, fixed(decimals)) : '—'
}

/** The 24h price move beside its percent, at the price's own precision (Change's usd unit is compact). */
export function formatDayMove(stats: Pick<TerminalStats, 'markPx' | 'prevDayPx'>): string {
	return formatUsd(stats.markPx - stats.prevDayPx, {
		signDisplay: 'exceptZero',
		...fixed(priceDecimals(stats.prevDayPx))
	})
}

function MarketIdentity({ symbol, maxLeverage }: { symbol: string; maxLeverage?: number }) {
	const dex = perpDex(symbol)
	return (
		<span className="flex items-center gap-2">
			<TokenLogo src={coinIconUrl(symbol)} size={20} />
			<span className="label-md">{pairName(symbol)}</span>
			{dex ? <Tag>{dex}</Tag> : null}
			{maxLeverage ? <Tag>{maxLeverage}x</Tag> : null}
		</span>
	)
}

function statItems(symbol: string, stats: TerminalStats | undefined): Array<InlineStatStripItem> {
	if (!stats) {
		return [
			{ label: 'Market', labelHidden: true, value: <MarketIdentity symbol={symbol} /> },
			...LABELS.map((label) => ({ label, value: <Skeleton className="h-4 w-16" /> }))
		]
	}
	const funding = formatHourlyFunding(stats.funding, stats.fundingAprPct)
	const decimals = priceDecimals(stats.prevDayPx)
	return [
		{
			label: 'Market',
			labelHidden: true,
			value: <MarketIdentity symbol={stats.symbol} maxLeverage={stats.maxLeverage} />
		},
		{
			label: 'Mark',
			value: <span className="tabular-nums">{formatPrice(stats.markPx, decimals)}</span>
		},
		{ label: 'Oracle', value: <span className="tabular-nums">{formatPrice(stats.oraclePx, decimals)}</span> },
		// The strip is stacked, so the label names the window and the change stays one line tall like its neighbours.
		{
			label: '24h change',
			value: (
				<span className="flex gap-1 tabular-nums">
					{formatDayMove(stats)}
					<Change value={stats.dayChangePct} />
				</span>
			)
		},
		{
			label: '24h volume',
			value: <span className="tabular-nums">{formatUsd(stats.dayNtlVlm, { compact: true, ...fixed(2) })}</span>
		},
		{
			label: 'Open interest',
			value: <span className="tabular-nums">{formatUsd(stats.openInterest, { compact: true, ...fixed(2) })}</span>
		},
		{
			label: 'Funding / Countdown',
			tooltip: `≈ ${funding.apr} · paid hourly`,
			value: (
				<span>
					<span className={`tabular-nums ${fundingClass(stats.funding)}`}>{funding.rate}</span>
					<span className="text-secondary"> / </span>
					<FundingCountdown />
				</span>
			)
		}
	]
}

interface LiveEntry {
	symbol: string
	stats: TerminalLiveStats
	at: number
}

export function mergeLiveStats(
	rest: TerminalStats | null | undefined,
	restAt: number,
	live: Pick<LiveEntry, 'stats' | 'at'> | null
): TerminalStats | null | undefined {
	if (!rest || !live || live.at + LIVE_GRACE_MS < restAt) return rest
	return { ...rest, ...live.stats }
}

function useLiveStats(symbol: string, enabled: boolean, lastLiveAtRef: RefObject<number>) {
	const listenerGuid = useId()
	const [live, setLive] = useState<LiveEntry | null>(null)
	useEffect(() => {
		if (!enabled) return
		subscribeTerminalStats(listenerGuid, symbol, (stats) => {
			const at = Date.now()
			lastLiveAtRef.current = at
			setLive({ symbol, stats, at })
		})
		return () => unsubscribeTerminalListener(listenerGuid)
	}, [listenerGuid, symbol, enabled, lastLiveAtRef])
	return live?.symbol === symbol ? live : null
}

export function TerminalMarketStrip({ symbol, fetchFn }: { symbol: string; fetchFn: typeof fetch }) {
	const lastLiveAtRef = useRef(0)
	const {
		data: rest,
		dataUpdatedAt,
		isError,
		isFetching,
		refetch
	} = useQuery({
		queryKey: ['llamaai-terminal-stats', symbol],
		queryFn: () => fetchTerminalStats(symbol, fetchFn),
		refetchInterval: () => (Date.now() - lastLiveAtRef.current < LIVE_GRACE_MS ? LIVE_REFRESH_MS : REFRESH_MS),
		staleTime: REFRESH_MS
	})
	const live = useLiveStats(symbol, rest !== null, lastLiveAtRef)
	const data = mergeLiveStats(rest, dataUpdatedAt, live)

	if (data === null) {
		return (
			<Card padding="strip">
				<p className="body-sm text-tertiary">{symbol} is not a Hyperliquid perp, so there is no market data for it.</p>
			</Card>
		)
	}
	if (data === undefined && isError) {
		return (
			<InlineStatus
				variant="error"
				action={
					<Button
						// The retry leaves once the read succeeds; the region keeps focus.
						ref={focusRegionOnLeave}
						size="sm"
						pendingLabel="Retrying…"
						pending={isFetching}
						onClick={() => void refetch()}
					>
						Try again
					</Button>
				}
			>
				Market data for {pairName(symbol)} could not be loaded.
			</InlineStatus>
		)
	}
	return <InlineStatStrip stacked items={statItems(symbol, data)} />
}
